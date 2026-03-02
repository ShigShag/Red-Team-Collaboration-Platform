import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join, resolve } from "path";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { generatedReports, engagementMembers, engagements } from "@/db/schema";
import { getSession } from "@/lib/auth/session";

const REPORTS_DIR = join(process.cwd(), "data", "reports");

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ reportId: string }> }
) {
  const { reportId } = await params;

  // Validate UUID to prevent path traversal
  if (!UUID_RE.test(reportId)) {
    return new NextResponse(null, { status: 400 });
  }

  // Require auth
  const session = await getSession();
  if (!session) {
    return new NextResponse(null, { status: 401 });
  }

  // Look up report → engagement, verify membership
  const [report] = await db
    .select({
      diskPath: generatedReports.diskPath,
      format: generatedReports.format,
      status: generatedReports.status,
      engagementId: generatedReports.engagementId,
      engagementName: engagements.name,
    })
    .from(generatedReports)
    .innerJoin(engagements, eq(engagements.id, generatedReports.engagementId))
    .where(eq(generatedReports.id, reportId))
    .limit(1);

  if (!report || report.status !== "completed" || !report.diskPath) {
    return new NextResponse(null, { status: 404 });
  }

  // Verify user is engagement member
  const [member] = await db
    .select({ role: engagementMembers.role })
    .from(engagementMembers)
    .where(
      and(
        eq(engagementMembers.engagementId, report.engagementId),
        eq(engagementMembers.userId, session.userId)
      )
    )
    .limit(1);

  if (!member) {
    return new NextResponse(null, { status: 403 });
  }

  // Read file from disk — verify path stays within REPORTS_DIR
  const filePath = join(REPORTS_DIR, report.diskPath);
  if (!resolve(filePath).startsWith(resolve(REPORTS_DIR) + "/")) {
    return new NextResponse(null, { status: 400 });
  }

  try {
    const fileData = await readFile(filePath);

    const safeName = report.engagementName.replace(/[^\w.\-() ]/g, "_");
    const ext = report.format === "pdf" ? "pdf" : "docx";
    const mimeType =
      report.format === "pdf"
        ? "application/pdf"
        : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

    return new NextResponse(new Uint8Array(fileData), {
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `attachment; filename="${safeName}_Report.${ext}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return new NextResponse(null, { status: 404 });
    }

    console.error(
      `Filesystem error serving report ${reportId}:`,
      (error as NodeJS.ErrnoException).code
    );
    return new NextResponse(null, { status: 500 });
  }
}
