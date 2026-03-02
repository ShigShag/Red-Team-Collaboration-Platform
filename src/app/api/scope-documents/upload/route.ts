import { NextRequest, NextResponse } from "next/server";
import { createWriteStream } from "fs";
import { mkdir, unlink } from "fs/promises";
import { join } from "path";
import { randomUUID, randomBytes, createCipheriv } from "crypto";
import { Readable } from "stream";
import Busboy from "busboy";
import { db } from "@/db";
import { scopeDocuments } from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import {
  deriveFileKey,
  IV_LENGTH,
  STREAMING_VERSION,
} from "@/lib/crypto/resource-crypto";
import { validateFileHeader } from "@/lib/file-validation";
import { MAX_FILE_SIZE } from "@/lib/file-validation";
import { revalidatePath } from "next/cache";
import {
  requireWriteAccessWithStatus,
  checkContentWritable,
} from "@/lib/engagement-access";
import { logActivity } from "@/lib/activity-log";

const RESOURCES_DIR = join(process.cwd(), "data", "resources");

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json(
      { error: "Expected multipart/form-data" },
      { status: 400 }
    );
  }

  if (!request.body) {
    return NextResponse.json({ error: "No body" }, { status: 400 });
  }

  await mkdir(RESOURCES_DIR, { recursive: true });

  const nodeStream = Readable.fromWeb(
    request.body as import("stream/web").ReadableStream
  );

  return new Promise<NextResponse>((resolve) => {
    const fields: Record<string, string> = {};
    let fileResult: {
      diskFilename: string;
      totalSize: number;
      mimeType: string;
    } | null = null;
    let fileError: string | null = null;

    const bb = Busboy({
      headers: { "content-type": contentType },
      limits: { fileSize: MAX_FILE_SIZE, files: 1 },
    });

    bb.on("field", (name: string, value: string) => {
      fields[name] = value;
    });

    bb.on(
      "file",
      (
        fieldname: string,
        fileStream: NodeJS.ReadableStream & { truncated?: boolean },
        info: { filename: string; encoding: string; mimeType: string }
      ) => {
        if (fieldname !== "file") {
          (fileStream as NodeJS.ReadableStream).resume();
          return;
        }

        const diskFilename = `${randomUUID()}.enc`;
        const diskPath = join(RESOURCES_DIR, diskFilename);

        const iv = randomBytes(IV_LENGTH);
        let key: Buffer;
        try {
          key = deriveFileKey(fields.engagementId);
        } catch {
          fileError = "Encryption key error";
          (fileStream as NodeJS.ReadableStream).resume();
          return;
        }

        const cipher = createCipheriv("aes-256-gcm", key, iv);
        const outStream = createWriteStream(diskPath);

        outStream.write(Buffer.from([STREAMING_VERSION]));
        outStream.write(iv);

        let totalSize = 0;
        let headerValidated = false;
        let headerBuffer = Buffer.alloc(0);
        let mimeType = "application/octet-stream";
        let aborted = false;

        const cleanup = () => {
          if (!aborted) {
            aborted = true;
            outStream.destroy();
            unlink(diskPath).catch(() => {});
          }
        };

        fileStream.on("data", (chunk: Buffer) => {
          if (aborted) return;

          totalSize += chunk.length;

          if (!headerValidated) {
            headerBuffer = Buffer.concat([headerBuffer, chunk]);
            if (headerBuffer.length >= 8) {
              const filename = fields.filename || info.filename || "unknown";
              const validation = validateFileHeader(headerBuffer, filename);
              if (!validation.valid) {
                fileError = validation.error;
                cleanup();
                (fileStream as NodeJS.ReadableStream).resume();
                return;
              }
              mimeType = validation.mimeType;
              headerValidated = true;
            }
          }

          const encrypted = cipher.update(chunk);
          if (encrypted.length > 0) {
            outStream.write(encrypted);
          }
        });

        fileStream.on("end", () => {
          if (aborted) return;

          if (!headerValidated && headerBuffer.length > 0) {
            const filename = fields.filename || info.filename || "unknown";
            const validation = validateFileHeader(headerBuffer, filename);
            if (!validation.valid) {
              fileError = validation.error;
              cleanup();
              return;
            }
            mimeType = validation.mimeType;
          }

          if (fileStream.truncated) {
            fileError = `File exceeds maximum size of ${MAX_FILE_SIZE / (1024 * 1024 * 1024)}GB`;
            cleanup();
            return;
          }

          const finalBlock = cipher.final();
          if (finalBlock.length > 0) {
            outStream.write(finalBlock);
          }

          const tag = cipher.getAuthTag();
          outStream.write(tag);
          outStream.end();

          fileResult = { diskFilename, totalSize, mimeType };
        });

        fileStream.on("error", () => {
          fileError = "File stream error";
          cleanup();
        });

        outStream.on("error", () => {
          fileError = "Disk write error";
          aborted = true;
          unlink(diskPath).catch(() => {});
        });
      }
    );

    bb.on("close", async () => {
      const { engagementId, documentType, name, description, referenceNumber } =
        fields;

      if (!engagementId) {
        if (fileResult) {
          unlink(join(RESOURCES_DIR, fileResult.diskFilename)).catch(() => {});
        }
        resolve(
          NextResponse.json(
            { error: "Missing engagementId" },
            { status: 400 }
          )
        );
        return;
      }

      // Auth check
      const access = await requireWriteAccessWithStatus(
        engagementId,
        session.userId
      );
      if (!access) {
        if (fileResult) {
          unlink(join(RESOURCES_DIR, fileResult.diskFilename)).catch(() => {});
        }
        resolve(
          NextResponse.json({ error: "Access denied" }, { status: 403 })
        );
        return;
      }

      const lockError = checkContentWritable(access);
      if (lockError) {
        if (fileResult) {
          unlink(join(RESOURCES_DIR, fileResult.diskFilename)).catch(() => {});
        }
        resolve(
          NextResponse.json({ error: lockError }, { status: 403 })
        );
        return;
      }

      if (fileError) {
        resolve(NextResponse.json({ error: fileError }, { status: 400 }));
        return;
      }

      if (!fileResult) {
        resolve(
          NextResponse.json({ error: "No file provided" }, { status: 400 })
        );
        return;
      }

      if (!name || !documentType) {
        unlink(join(RESOURCES_DIR, fileResult.diskFilename)).catch(() => {});
        resolve(
          NextResponse.json(
            { error: "Missing name or document type" },
            { status: 400 }
          )
        );
        return;
      }

      const sanitizedName = (fields.filename || "unknown")
        .replace(/[\\/]/g, "_")
        .replace(/[\x00-\x1f\x7f]/g, "");

      const [inserted] = await db
        .insert(scopeDocuments)
        .values({
          engagementId,
          documentType: documentType as
            | "authorization_letter"
            | "msa"
            | "sow"
            | "nda"
            | "other",
          name,
          description: description || null,
          referenceNumber: referenceNumber || null,
          diskPath: fileResult.diskFilename,
          originalFilename: sanitizedName,
          mimeType: fileResult.mimeType,
          fileSize: fileResult.totalSize,
          createdBy: session.userId,
        })
        .returning({ id: scopeDocuments.id });

      await logActivity({
        engagementId,
        actorId: session.userId,
        eventType: "scope_document_uploaded",
        metadata: {
          documentType,
          documentName: name,
        },
      });

      revalidatePath(`/engagements/${engagementId}/scope`);
      revalidatePath(`/engagements/${engagementId}`);

      resolve(
        NextResponse.json({ documentId: inserted.id, success: true })
      );
    });

    bb.on("error", (err: Error) => {
      console.error("Busboy error:", err);
      resolve(
        NextResponse.json({ error: "Upload failed" }, { status: 500 })
      );
    });

    nodeStream.pipe(bb);
  });
}
