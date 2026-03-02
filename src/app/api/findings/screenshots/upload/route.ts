import { NextRequest, NextResponse } from "next/server";
import { createWriteStream } from "fs";
import { mkdir, unlink } from "fs/promises";
import { join } from "path";
import { randomUUID, randomBytes, createCipheriv } from "crypto";
import { Readable } from "stream";
import Busboy from "busboy";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import {
  findingScreenshots,
  categoryFindings,
  engagementCategories,
} from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import {
  deriveFileKey,
  IV_LENGTH,
  TAG_LENGTH,
  STREAMING_VERSION,
} from "@/lib/crypto/resource-crypto";
import { validateFileHeader } from "@/lib/file-validation";
import { MAX_FILE_SIZE } from "@/lib/file-validation";
import { revalidatePath } from "next/cache";
import {
  requireWriteAccessWithStatus,
  checkContentWritable,
} from "@/lib/engagement-access";

const RESOURCES_DIR = join(process.cwd(), "data", "resources");

const ALLOWED_IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

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
    let authChecked = false;
    let authPassed = false;

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

        // Write v3 header: version + iv
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

          // Validate magic bytes from the first chunk(s)
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

              // Reject non-image files
              if (!ALLOWED_IMAGE_MIMES.has(mimeType)) {
                fileError = "Only image files (JPEG, PNG, WebP, GIF) are allowed for screenshots";
                cleanup();
                (fileStream as NodeJS.ReadableStream).resume();
                return;
              }

              headerValidated = true;
            }
          }

          // Encrypt and write
          const encrypted = cipher.update(chunk);
          if (encrypted.length > 0) {
            outStream.write(encrypted);
          }
        });

        fileStream.on("end", () => {
          if (aborted) return;

          // If we never got 8 bytes, validate what we have
          if (!headerValidated && headerBuffer.length > 0) {
            const filename = fields.filename || info.filename || "unknown";
            const validation = validateFileHeader(headerBuffer, filename);
            if (!validation.valid) {
              fileError = validation.error;
              cleanup();
              return;
            }
            mimeType = validation.mimeType;

            if (!ALLOWED_IMAGE_MIMES.has(mimeType)) {
              fileError = "Only image files (JPEG, PNG, WebP, GIF) are allowed for screenshots";
              cleanup();
              return;
            }
          }

          // Check if busboy truncated the file (exceeded limit)
          if (fileStream.truncated) {
            fileError = `File exceeds maximum size of ${MAX_FILE_SIZE / (1024 * 1024 * 1024)}GB`;
            cleanup();
            return;
          }

          // Finalize cipher
          const finalBlock = cipher.final();
          if (finalBlock.length > 0) {
            outStream.write(finalBlock);
          }

          // Append auth tag at the end (v3 format)
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
      // Validate required fields
      const { engagementId, findingId, filename } = fields;
      if (!engagementId || !findingId) {
        if (fileResult) {
          unlink(join(RESOURCES_DIR, fileResult.diskFilename)).catch(() => {});
        }
        resolve(
          NextResponse.json(
            { error: "Missing engagementId or findingId" },
            { status: 400 }
          )
        );
        return;
      }

      // Auth + engagement status check
      if (!authChecked) {
        authChecked = true;
        const access = await requireWriteAccessWithStatus(engagementId, session.userId);
        if (access) {
          const lockError = checkContentWritable(access);
          authPassed = !lockError;
          if (lockError) {
            if (fileResult) {
              unlink(join(RESOURCES_DIR, fileResult.diskFilename)).catch(() => {});
            }
            resolve(
              NextResponse.json({ error: lockError }, { status: 403 })
            );
            return;
          }
        }
      }

      if (!authPassed) {
        if (fileResult) {
          unlink(join(RESOURCES_DIR, fileResult.diskFilename)).catch(() => {});
        }
        resolve(
          NextResponse.json({ error: "Access denied" }, { status: 403 })
        );
        return;
      }

      // Check for file errors
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

      // Verify finding exists and belongs to the engagement
      const [finding] = await db
        .select({ id: categoryFindings.id, categoryId: categoryFindings.categoryId })
        .from(categoryFindings)
        .innerJoin(
          engagementCategories,
          eq(engagementCategories.id, categoryFindings.categoryId)
        )
        .where(
          and(
            eq(categoryFindings.id, findingId),
            eq(engagementCategories.engagementId, engagementId)
          )
        )
        .limit(1);

      if (!finding) {
        unlink(join(RESOURCES_DIR, fileResult.diskFilename)).catch(() => {});
        resolve(
          NextResponse.json({ error: "Finding not found" }, { status: 404 })
        );
        return;
      }

      // Get current max sort order
      const existingScreenshots = await db
        .select({ sortOrder: findingScreenshots.sortOrder })
        .from(findingScreenshots)
        .where(eq(findingScreenshots.findingId, findingId));
      const maxOrder = existingScreenshots.reduce(
        (m, s) => Math.max(m, s.sortOrder),
        -1
      );

      // Sanitize filename
      const sanitizedName = (filename || "unknown")
        .replace(/[\\/]/g, "_")
        .replace(/[\x00-\x1f\x7f]/g, "");

      // Insert DB record
      const [inserted] = await db
        .insert(findingScreenshots)
        .values({
          findingId,
          diskPath: fileResult.diskFilename,
          originalFilename: sanitizedName,
          mimeType: fileResult.mimeType,
          fileSize: fileResult.totalSize,
          sortOrder: maxOrder + 1,
          createdBy: session.userId,
        })
        .returning({ id: findingScreenshots.id });

      // Revalidate pages
      revalidatePath(`/engagements/${engagementId}`);
      revalidatePath(
        `/engagements/${engagementId}/categories/${finding.categoryId}`
      );

      resolve(
        NextResponse.json({ screenshotId: inserted.id, success: true })
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
