"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";
import { unlink } from "fs/promises";
import { join } from "path";
import { db } from "@/db";
import { generatedReports } from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { requireWriteAccessWithStatus } from "@/lib/engagement-access";

const REPORTS_DIR = join(process.cwd(), "data", "reports");

export type ReportState = {
  error?: string;
  success?: string;
};

export async function deleteGeneratedReport(
  _prev: ReportState,
  formData: FormData
): Promise<ReportState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const engagementId = formData.get("engagementId") as string;
  const reportId = formData.get("reportId") as string;
  if (!engagementId || !reportId) return { error: "Missing required fields" };

  const member = await requireWriteAccessWithStatus(engagementId, session.userId);
  if (!member) return { error: "Write access required" };

  // Get report to find disk path
  const [report] = await db
    .select({ diskPath: generatedReports.diskPath })
    .from(generatedReports)
    .where(
      and(
        eq(generatedReports.id, reportId),
        eq(generatedReports.engagementId, engagementId)
      )
    )
    .limit(1);

  if (report?.diskPath) {
    try {
      await unlink(join(REPORTS_DIR, report.diskPath));
    } catch {
      // File may already be deleted
    }
  }

  await db
    .delete(generatedReports)
    .where(
      and(
        eq(generatedReports.id, reportId),
        eq(generatedReports.engagementId, engagementId)
      )
    );

  revalidatePath(`/engagements/${engagementId}/reports`);
  return { success: "Report deleted" };
}
