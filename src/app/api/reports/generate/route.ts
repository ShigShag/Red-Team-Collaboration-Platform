import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile, readFile, rm } from "fs/promises";
import { join, resolve } from "path";
import { eq, and, inArray, desc } from "drizzle-orm";
import { db } from "@/db";
import {
  reportConfigs,
  generatedReports,
  engagementMembers,
  findingScreenshots,
  categoryFindings,
  engagementCategories,
} from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { decryptFileBuffer } from "@/lib/crypto/resource-crypto";
import {
  generatePdfFromJson,
  createTempEvidenceDir,
} from "@/lib/reports/python-bridge";
import type { PythonReportJson } from "@/lib/reports/report-json-types";

const REPORTS_DIR = join(process.cwd(), "data", "reports");
const RESOURCES_DIR = join(process.cwd(), "data", "resources");

/**
 * POST /api/reports/generate
 * Generates a final PDF report and stores it on disk.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return new NextResponse(null, { status: 401 });
  }

  let body: { engagementId: string; reportJson: PythonReportJson };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { engagementId, reportJson } = body;
  if (!engagementId || !reportJson) {
    return NextResponse.json(
      { error: "Missing engagementId or reportJson" },
      { status: 400 }
    );
  }

  // Verify write access
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

  if (!member || member.role === "read") {
    return NextResponse.json(
      { error: "Write access required" },
      { status: 403 }
    );
  }

  // Find or create config
  let [config] = await db
    .select({ id: reportConfigs.id })
    .from(reportConfigs)
    .where(eq(reportConfigs.engagementId, engagementId))
    .orderBy(desc(reportConfigs.updatedAt))
    .limit(1);

  if (!config) {
    [config] = await db
      .insert(reportConfigs)
      .values({
        engagementId,
        name: "Report",
        templateType: "pentest",
        reportJson,
        createdBy: session.userId,
      })
      .returning({ id: reportConfigs.id });
  } else {
    // Save latest JSON
    await db
      .update(reportConfigs)
      .set({ reportJson, updatedAt: new Date() })
      .where(eq(reportConfigs.id, config.id));
  }

  // Create generated report record
  const [report] = await db
    .insert(generatedReports)
    .values({
      configId: config.id,
      engagementId,
      format: "pdf",
      status: "generating",
      generatedBy: session.userId,
    })
    .returning({ id: generatedReports.id });

  let evidenceDir: string | undefined;

  try {
    // Handle evidence images
    const evidenceImages = (reportJson.findings ?? [])
      .map((f) => f.evidence_image)
      .filter((img): img is string => !!img);

    if (evidenceImages.length > 0) {
      evidenceDir = await createTempEvidenceDir();

      const findingIds = await db
        .select({ id: categoryFindings.id })
        .from(categoryFindings)
        .innerJoin(
          engagementCategories,
          eq(categoryFindings.categoryId, engagementCategories.id)
        )
        .where(eq(engagementCategories.engagementId, engagementId))
        .then((rows) => rows.map((r) => r.id));

      if (findingIds.length > 0) {
        const screenshots = await db
          .select({
            diskPath: findingScreenshots.diskPath,
            originalFilename: findingScreenshots.originalFilename,
          })
          .from(findingScreenshots)
          .where(inArray(findingScreenshots.findingId, findingIds));

        const referenced = screenshots.filter((s) =>
          evidenceImages.includes(s.originalFilename)
        );

        await Promise.all(
          referenced.map(async (s) => {
            const diskFilename = s.diskPath.split("/").pop();
            if (!diskFilename) return;
            const filePath = join(RESOURCES_DIR, diskFilename);
            if (
              !resolve(filePath).startsWith(resolve(RESOURCES_DIR) + "/")
            )
              return;
            try {
              const encrypted = await readFile(filePath);
              const decrypted = decryptFileBuffer(
                encrypted,
                engagementId
              );
              await writeFile(
                join(evidenceDir!, s.originalFilename),
                decrypted
              );
            } catch {
              // Skip failures
            }
          })
        );
      }
    }

    // Generate PDF
    const pdfBuffer = await generatePdfFromJson(reportJson, {
      evidenceDir,
    });

    // Write to disk
    const reportDir = join(REPORTS_DIR, engagementId);
    await mkdir(reportDir, { recursive: true });
    const filename = `${report.id}.pdf`;
    const diskPath = join(reportDir, filename);
    await writeFile(diskPath, pdfBuffer);

    // Update record
    await db
      .update(generatedReports)
      .set({
        status: "completed",
        diskPath: `${engagementId}/${filename}`,
        fileSize: pdfBuffer.length,
      })
      .where(eq(generatedReports.id, report.id));

    return NextResponse.json({
      success: true,
      reportId: report.id,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    await db
      .update(generatedReports)
      .set({ status: "failed", errorMessage: message })
      .where(eq(generatedReports.id, report.id));

    return NextResponse.json(
      { error: `Report generation failed: ${message}` },
      { status: 500 }
    );
  } finally {
    if (evidenceDir) {
      await rm(evidenceDir, { recursive: true, force: true }).catch(
        () => {}
      );
    }
  }
}
