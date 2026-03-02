import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join, resolve } from "path";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import {
  resourceFiles,
  resources,
  engagementCategories,
  engagementMembers,
} from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { getEffectiveAccess } from "@/lib/engagement-access";
import { decryptFileBuffer } from "@/lib/crypto/resource-crypto";
import { logSecurityEvent, getRequestContext } from "@/lib/security-logger";

const RESOURCES_DIR = join(process.cwd(), "data", "resources");

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/bmp",
]);

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  const { fileId } = await params;

  // Validate UUID to prevent path traversal
  if (!UUID_RE.test(fileId)) {
    return new NextResponse(null, { status: 400 });
  }

  // Require auth
  const session = await getSession();
  if (!session) {
    return new NextResponse(null, { status: 401 });
  }

  // Look up file → resource → category → engagement, verify membership
  const [file] = await db
    .select({
      diskPath: resourceFiles.diskPath,
      originalFilename: resourceFiles.originalFilename,
      mimeType: resourceFiles.mimeType,
      engagementId: engagementCategories.engagementId,
    })
    .from(resourceFiles)
    .innerJoin(resources, eq(resources.id, resourceFiles.resourceId))
    .innerJoin(
      engagementCategories,
      eq(engagementCategories.id, resources.categoryId)
    )
    .where(eq(resourceFiles.id, fileId))
    .limit(1);

  if (!file) {
    return new NextResponse(null, { status: 404 });
  }

  // Verify user is engagement member
  const [member] = await db
    .select({ role: engagementMembers.role })
    .from(engagementMembers)
    .where(
      and(
        eq(engagementMembers.engagementId, file.engagementId),
        eq(engagementMembers.userId, session.userId)
      )
    )
    .limit(1);

  if (!member) {
    // Check virtual coordinator access
    const access = await getEffectiveAccess(file.engagementId, session.userId, session.isCoordinator);
    if (!access) {
      return new NextResponse(null, { status: 403 });
    }
  }

  // Extract just the filename from diskPath to prevent path traversal
  const diskFilename = file.diskPath.split("/").pop();
  if (!diskFilename) {
    return new NextResponse(null, { status: 404 });
  }

  // Belt-and-suspenders: verify resolved path stays within RESOURCES_DIR
  const filePath = join(RESOURCES_DIR, diskFilename);
  if (!resolve(filePath).startsWith(resolve(RESOURCES_DIR) + "/")) {
    return new NextResponse(null, { status: 400 });
  }

  try {
    const encryptedData = await readFile(filePath);
    const decryptedData = decryptFileBuffer(
      encryptedData,
      file.engagementId
    );

    const isImage = IMAGE_MIMES.has(file.mimeType);
    const safeName = file.originalFilename.replace(/[^\w.\-() ]/g, "_");
    const disposition = isImage
      ? "inline"
      : `attachment; filename="${safeName}"`;

    return new NextResponse(new Uint8Array(decryptedData), {
      headers: {
        "Content-Type": file.mimeType,
        "Content-Disposition": disposition,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    // File not found on disk — genuine 404
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return new NextResponse(null, { status: 404 });
    }

    // Other filesystem error (permissions, disk I/O, etc.)
    if ((error as NodeJS.ErrnoException).code) {
      console.error(
        `Filesystem error serving resource file ${fileId}:`,
        (error as NodeJS.ErrnoException).code
      );
      return new NextResponse(null, { status: 500 });
    }

    // Decryption failure — security event (potential tampering)
    const ctx = await getRequestContext();
    await logSecurityEvent({
      eventType: "file_decryption_failed",
      userId: session.userId,
      ...ctx,
      metadata: {
        fileId,
        engagementId: file.engagementId,
        error: error instanceof Error ? error.message : "Unknown",
      },
    });
    return new NextResponse(null, { status: 500 });
  }
}
