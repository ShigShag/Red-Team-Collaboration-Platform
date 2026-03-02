import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join, resolve } from "path";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import {
  findingScreenshots,
  categoryFindings,
  engagementCategories,
  engagementMembers,
} from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { decryptFileBuffer } from "@/lib/crypto/resource-crypto";
import { logSecurityEvent, getRequestContext } from "@/lib/security-logger";

const RESOURCES_DIR = join(process.cwd(), "data", "resources");

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ screenshotId: string }> }
) {
  const { screenshotId } = await params;

  // Validate UUID to prevent path traversal
  if (!UUID_RE.test(screenshotId)) {
    return new NextResponse(null, { status: 400 });
  }

  // Require auth
  const session = await getSession();
  if (!session) {
    return new NextResponse(null, { status: 401 });
  }

  // Look up screenshot → finding → category → engagement
  const [file] = await db
    .select({
      diskPath: findingScreenshots.diskPath,
      originalFilename: findingScreenshots.originalFilename,
      mimeType: findingScreenshots.mimeType,
      engagementId: engagementCategories.engagementId,
    })
    .from(findingScreenshots)
    .innerJoin(
      categoryFindings,
      eq(categoryFindings.id, findingScreenshots.findingId)
    )
    .innerJoin(
      engagementCategories,
      eq(engagementCategories.id, categoryFindings.categoryId)
    )
    .where(eq(findingScreenshots.id, screenshotId))
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
    return new NextResponse(null, { status: 403 });
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

    return new NextResponse(new Uint8Array(decryptedData), {
      headers: {
        "Content-Type": file.mimeType,
        "Content-Disposition": "inline",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    // File not found on disk
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return new NextResponse(null, { status: 404 });
    }

    // Other filesystem error
    if ((error as NodeJS.ErrnoException).code) {
      console.error(
        `Filesystem error serving screenshot ${screenshotId}:`,
        (error as NodeJS.ErrnoException).code
      );
      return new NextResponse(null, { status: 500 });
    }

    // Decryption failure — security event
    const ctx = await getRequestContext();
    await logSecurityEvent({
      eventType: "file_decryption_failed",
      userId: session.userId,
      ...ctx,
      metadata: {
        screenshotId,
        engagementId: file.engagementId,
        error: error instanceof Error ? error.message : "Unknown",
      },
    });
    return new NextResponse(null, { status: 500 });
  }
}
