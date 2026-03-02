"use server";

import { redirect } from "next/navigation";
import { randomUUID } from "crypto";
import { mkdir, readdir, stat, unlink } from "fs/promises";
import { join } from "path";
import { getSession } from "@/lib/auth/session";
import { db } from "@/db";
import { engagementMembers, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { exportEngagementSchema } from "@/lib/validations";
import { collectExportData } from "@/lib/exports/export-collector";
import { buildExportZip } from "@/lib/exports/zip-builder";
import { logActivity } from "@/lib/activity-log";

const EXPORTS_DIR = join(process.cwd(), "data", "exports");
const EXPORT_TTL_MS = 60 * 60 * 1000; // 1 hour

interface ExportResult {
  error?: string;
  exportId?: string;
  engagementId?: string;
}

export async function exportEngagement(
  engagementId: string,
  formData: FormData
): Promise<ExportResult> {
  const session = await getSession();
  if (!session) redirect("/login");

  // Verify membership (any role can export)
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
    return { error: "You are not a member of this engagement" };
  }

  // Parse form data
  const raw = {
    format: formData.get("format") ?? "full",
    categoryIds: formData.get("categoryIds")
      ? JSON.parse(formData.get("categoryIds") as string)
      : undefined,
    includeScope: formData.get("includeScope") === "true",
    includeIPs: formData.get("includeIPs") === "true",
    includeAuditLog: formData.get("includeAuditLog") === "true",
    includeComments: formData.get("includeComments") === "true",
  };

  const parsed = exportEngagementSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: "Invalid export options" };
  }

  const options = {
    engagementId,
    ...parsed.data,
  };

  // Clean up old exports (non-blocking best effort)
  cleanupOldExports().catch(() => {});

  // Ensure export directory exists
  const engExportDir = join(EXPORTS_DIR, engagementId);
  await mkdir(engExportDir, { recursive: true });

  const exportId = randomUUID();
  const outputPath = join(engExportDir, `${exportId}.zip`);

  try {
    // Get exporter username
    const [user] = await db
      .select({ username: users.username })
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1);

    // Collect data
    const data = await collectExportData(options);

    // Build zip
    const stats = await buildExportZip(
      data,
      outputPath,
      engagementId,
      options,
      user?.username ?? "unknown"
    );

    // Log activity
    await logActivity({
      engagementId,
      actorId: session.userId,
      eventType: "engagement_exported",
      metadata: {
        categoryCount: String(stats.categoryCount),
        findingCount: String(stats.findingCount),
        actionCount: String(stats.actionCount),
        resourceCount: String(stats.resourceCount),
        fileCount: String(stats.fileCount),
      },
    });

    return { exportId, engagementId };
  } catch (error) {
    console.error("Export failed:", error);
    // Clean up partial file
    unlink(outputPath).catch(() => {});
    return { error: "Export failed. Please try again." };
  }
}

async function cleanupOldExports(): Promise<void> {
  try {
    const entries = await readdir(EXPORTS_DIR, { withFileTypes: true });
    const now = Date.now();

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const subDir = join(EXPORTS_DIR, entry.name);
      const files = await readdir(subDir);

      for (const file of files) {
        if (!file.endsWith(".zip")) continue;
        const filePath = join(subDir, file);
        const fileStat = await stat(filePath);
        if (now - fileStat.mtimeMs > EXPORT_TTL_MS) {
          await unlink(filePath);
        }
      }
    }
  } catch {
    // EXPORTS_DIR may not exist yet — that's fine
  }
}
