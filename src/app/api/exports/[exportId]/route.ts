import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join, resolve } from "path";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { engagementMembers, engagements } from "@/db/schema";
import { getSession } from "@/lib/auth/session";

const EXPORTS_DIR = join(process.cwd(), "data", "exports");

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ exportId: string }> }
) {
  const { exportId } = await params;

  // Validate UUID format
  if (!UUID_RE.test(exportId)) {
    return new NextResponse(null, { status: 400 });
  }

  // engagementId is required as a query param for membership verification
  const engagementId = request.nextUrl.searchParams.get("engagementId");
  if (!engagementId || !UUID_RE.test(engagementId)) {
    return new NextResponse(null, { status: 400 });
  }

  // Auth
  const session = await getSession();
  if (!session) {
    return new NextResponse(null, { status: 401 });
  }

  // Verify membership
  const [member] = await db
    .select({ role: engagementMembers.role })
    .from(engagementMembers)
    .where(
      and(
        eq(engagementMembers.engagementId, engagementId),
        eq(engagementMembers.userId, session.userId)
      )
    )
    .limit(1);

  if (!member) {
    return new NextResponse(null, { status: 403 });
  }

  // Get engagement name for filename
  const [engagement] = await db
    .select({ name: engagements.name })
    .from(engagements)
    .where(eq(engagements.id, engagementId))
    .limit(1);

  if (!engagement) {
    return new NextResponse(null, { status: 404 });
  }

  // Build file path and verify it stays within EXPORTS_DIR
  const filePath = join(EXPORTS_DIR, engagementId, `${exportId}.zip`);
  if (!resolve(filePath).startsWith(resolve(EXPORTS_DIR) + "/")) {
    return new NextResponse(null, { status: 400 });
  }

  try {
    const fileData = await readFile(filePath);

    const safeName = engagement.name.replace(/[^\w.\-() ]/g, "_");

    return new NextResponse(new Uint8Array(fileData), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${safeName}_Export.zip"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return new NextResponse(null, { status: 404 });
    }
    console.error(
      `Filesystem error serving export ${exportId}:`,
      (error as NodeJS.ErrnoException).code
    );
    return new NextResponse(null, { status: 500 });
  }
}
