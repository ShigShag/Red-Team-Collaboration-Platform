import { NextRequest, NextResponse } from "next/server";
import { readFile, writeFile, rm } from "fs/promises";
import { join, resolve } from "path";
import { eq, and, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  engagementMembers,
  findingScreenshots,
  categoryFindings,
  engagementCategories,
} from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { getEffectiveAccess } from "@/lib/engagement-access";
import { decryptFileBuffer } from "@/lib/crypto/resource-crypto";
import {
  generatePdfFromJson,
  createTempEvidenceDir,
} from "@/lib/reports/python-bridge";
import type { PythonReportJson } from "@/lib/reports/report-json-types";

const RESOURCES_DIR = join(process.cwd(), "data", "resources");

/**
 * POST /api/reports/preview
 * Accepts { engagementId, reportJson }, generates PDF via Python engine,
 * returns the PDF bytes for live preview.
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

  // Verify engagement membership (read access is sufficient for preview)
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
    // Check virtual coordinator access
    const access = await getEffectiveAccess(engagementId, session.userId, session.isCoordinator);
    if (!access) {
      return new NextResponse(null, { status: 403 });
    }
  }

  let evidenceDir: string | undefined;

  try {
    // Handle evidence images: decrypt screenshots to temp dir
    const evidenceImages = (reportJson.findings ?? [])
      .map((f) => f.evidence_image)
      .filter((img): img is string => !!img);

    if (evidenceImages.length > 0) {
      evidenceDir = await createTempEvidenceDir();

      // Look up all finding screenshots for this engagement
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

        // Decrypt only the referenced screenshots
        const referencedScreenshots = screenshots.filter((s) =>
          evidenceImages.includes(s.originalFilename)
        );

        await Promise.all(
          referencedScreenshots.map(async (s) => {
            const diskFilename = s.diskPath.split("/").pop();
            if (!diskFilename) return;

            const filePath = join(RESOURCES_DIR, diskFilename);
            if (
              !resolve(filePath).startsWith(resolve(RESOURCES_DIR) + "/")
            ) {
              return;
            }

            try {
              const encrypted = await readFile(filePath);
              const decrypted = decryptFileBuffer(encrypted, engagementId);
              await writeFile(
                join(evidenceDir!, s.originalFilename),
                decrypted
              );
            } catch {
              // Skip screenshots that fail to decrypt
            }
          })
        );
      }
    }

    // Generate PDF via Python engine
    const pdfBuffer = await generatePdfFromJson(reportJson, {
      evidenceDir,
    });

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    console.error("Report preview generation failed:", message);
    return NextResponse.json(
      { error: `Preview generation failed: ${message}` },
      { status: 500 }
    );
  } finally {
    // Cleanup temp evidence directory
    if (evidenceDir) {
      await rm(evidenceDir, { recursive: true, force: true }).catch(
        () => {}
      );
    }
  }
}
