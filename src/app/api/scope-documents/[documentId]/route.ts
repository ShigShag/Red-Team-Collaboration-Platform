import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join, resolve } from "path";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { scopeDocuments, engagementMembers } from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { decryptFileBuffer } from "@/lib/crypto/resource-crypto";
import { logSecurityEvent, getRequestContext } from "@/lib/security-logger";

const RESOURCES_DIR = join(process.cwd(), "data", "resources");

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const { documentId } = await params;

  if (!UUID_RE.test(documentId)) {
    return new NextResponse(null, { status: 400 });
  }

  const session = await getSession();
  if (!session) {
    return new NextResponse(null, { status: 401 });
  }

  // Fetch document
  const [doc] = await db
    .select({
      diskPath: scopeDocuments.diskPath,
      originalFilename: scopeDocuments.originalFilename,
      mimeType: scopeDocuments.mimeType,
      engagementId: scopeDocuments.engagementId,
    })
    .from(scopeDocuments)
    .where(eq(scopeDocuments.id, documentId))
    .limit(1);

  if (!doc) {
    return new NextResponse(null, { status: 404 });
  }

  // Verify user is engagement member
  const [member] = await db
    .select({ role: engagementMembers.role })
    .from(engagementMembers)
    .where(
      and(
        eq(engagementMembers.engagementId, doc.engagementId),
        eq(engagementMembers.userId, session.userId)
      )
    )
    .limit(1);

  if (!member) {
    return new NextResponse(null, { status: 403 });
  }

  // Resolve path safely
  const diskFilename = doc.diskPath.split("/").pop();
  if (!diskFilename) {
    return new NextResponse(null, { status: 404 });
  }

  const filePath = join(RESOURCES_DIR, diskFilename);
  if (!resolve(filePath).startsWith(resolve(RESOURCES_DIR) + "/")) {
    return new NextResponse(null, { status: 400 });
  }

  try {
    const encryptedData = await readFile(filePath);
    const decryptedData = decryptFileBuffer(encryptedData, doc.engagementId);

    const safeName = doc.originalFilename.replace(/[^\w.\-() ]/g, "_");

    return new NextResponse(new Uint8Array(decryptedData), {
      headers: {
        "Content-Type": doc.mimeType,
        "Content-Disposition": `attachment; filename="${safeName}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return new NextResponse(null, { status: 404 });
    }

    if ((error as NodeJS.ErrnoException).code) {
      console.error(
        `Filesystem error serving scope document ${documentId}:`,
        (error as NodeJS.ErrnoException).code
      );
      return new NextResponse(null, { status: 500 });
    }

    const ctx = await getRequestContext();
    await logSecurityEvent({
      eventType: "file_decryption_failed",
      userId: session.userId,
      ...ctx,
      metadata: {
        documentId,
        engagementId: doc.engagementId,
        error: error instanceof Error ? error.message : "Unknown",
      },
    });
    return new NextResponse(null, { status: 500 });
  }
}
