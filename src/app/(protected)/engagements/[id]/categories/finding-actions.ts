"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";
import { unlink } from "fs/promises";
import { join } from "path";
import { db } from "@/db";
import {
  engagementCategories,
  categoryFindings,
  findingResources,
  findingTags,
  findingScreenshots,
  ipGeolocationSources,
  domainResolutionSources,
} from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import {
  createFindingSchema,
  updateFindingSchema,
  linkFindingResourceSchema,
  linkFindingTagSchema,
} from "@/lib/validations";
import { logActivity } from "@/lib/activity-log";
import { syncIpGeolocations } from "@/lib/ip-geolocation-sync";
import {
  requireWriteAccessWithStatus,
  checkContentWritable,
} from "@/lib/engagement-access";


export type FindingState = {
  error?: string;
  success?: string;
  findingId?: string;
  fieldErrors?: Record<string, string[]>;
};

/** Direct call variant (no prevState) for use outside useActionState */
export async function createFindingDirect(
  formData: FormData
): Promise<FindingState> {
  return createFinding({}, formData);
}

export async function createFinding(
  _prev: FindingState,
  formData: FormData
): Promise<FindingState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const engagementId = formData.get("engagementId") as string;
  if (!engagementId) return { error: "Missing engagement ID" };

  const access = await requireWriteAccessWithStatus(engagementId, session.userId);
  if (!access) return { error: "You need write access to add findings" };
  const lockError = checkContentWritable(access);
  if (lockError) return { error: lockError };

  let resourceIds: string[] | undefined;
  const resourceIdsRaw = formData.get("resourceIds") as string | null;
  if (resourceIdsRaw) {
    try {
      resourceIds = JSON.parse(resourceIdsRaw);
    } catch {
      return { error: "Invalid resource IDs" };
    }
  }

  let tagIds: string[] | undefined;
  const tagIdsRaw = formData.get("tagIds") as string | null;
  if (tagIdsRaw) {
    try {
      tagIds = JSON.parse(tagIdsRaw);
    } catch {
      return { error: "Invalid tag IDs" };
    }
  }

  const cvssScoreRaw = formData.get("cvssScore") as string | null;
  const cvssScore = cvssScoreRaw ? parseFloat(cvssScoreRaw) : null;

  const raw = {
    categoryId: formData.get("categoryId") as string,
    title: formData.get("title") as string,
    overview: formData.get("overview") as string,
    overviewFormat: (formData.get("overviewFormat") as string) || "text",
    impact: (formData.get("impact") as string) || undefined,
    impactFormat: (formData.get("impactFormat") as string) || "text",
    recommendation: (formData.get("recommendation") as string) || undefined,
    recommendationFormat: (formData.get("recommendationFormat") as string) || "text",
    severity: (formData.get("severity") as string) || "medium",
    cvssScore: isNaN(cvssScore as number) ? null : cvssScore,
    cvssVector: (formData.get("cvssVector") as string) || null,
    resourceIds,
    tagIds,
  };

  const parsed = createFindingSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  // Verify category belongs to this engagement
  const [category] = await db
    .select({ id: engagementCategories.id, name: engagementCategories.name })
    .from(engagementCategories)
    .where(
      and(
        eq(engagementCategories.id, parsed.data.categoryId),
        eq(engagementCategories.engagementId, engagementId)
      )
    )
    .limit(1);

  if (!category) return { error: "Category not found" };

  const [newFinding] = await db.transaction(async (tx) => {
    const result = await tx.insert(categoryFindings).values({
      categoryId: parsed.data.categoryId,
      title: parsed.data.title.trim(),
      overview: parsed.data.overview.trim(),
      overviewFormat: parsed.data.overviewFormat,
      impact: parsed.data.impact?.trim() || null,
      impactFormat: parsed.data.impactFormat,
      recommendation: parsed.data.recommendation?.trim() || null,
      recommendationFormat: parsed.data.recommendationFormat,
      severity: parsed.data.severity,
      cvssScore: parsed.data.cvssScore != null ? String(parsed.data.cvssScore) : null,
      cvssVector: parsed.data.cvssVector || null,
      createdBy: session.userId,
    }).returning({ id: categoryFindings.id });

    if (parsed.data.resourceIds && parsed.data.resourceIds.length > 0) {
      await tx.insert(findingResources).values(
        parsed.data.resourceIds.map((resourceId) => ({
          findingId: result[0].id,
          resourceId,
        }))
      );
    }

    if (parsed.data.tagIds && parsed.data.tagIds.length > 0) {
      await tx.insert(findingTags).values(
        parsed.data.tagIds.map((tagId) => ({
          findingId: result[0].id,
          tagId,
        }))
      );
    }

    return result;
  });

  // Extract IPs/domains from finding text fields
  await syncIpGeolocations({
    engagementId,
    sourceType: "finding",
    sourceId: newFinding.id,
    texts: [parsed.data.title, parsed.data.overview, parsed.data.impact, parsed.data.recommendation],
  });

  await logActivity({
    engagementId,
    actorId: session.userId,
    eventType: "finding_created",
    metadata: {
      findingTitle: parsed.data.title.trim(),
      categoryName: category.name,
      findingId: newFinding.id,
      categoryId: parsed.data.categoryId,
      severity: parsed.data.severity,
    },
  });

  revalidatePath(`/engagements/${engagementId}`);
  revalidatePath(`/engagements/${engagementId}/categories/${parsed.data.categoryId}`);

  // Optionally save as template (fire-and-forget)
  const saveAsTemplate = formData.get("saveAsTemplate") as string;
  if (saveAsTemplate === "true") {
    import("@/app/(protected)/templates/finding-template-actions")
      .then(({ saveFindingAsTemplate }) =>
        saveFindingAsTemplate({
          title: parsed.data.title.trim(),
          category: (formData.get("templateCategory") as string) || "general",
          overview: parsed.data.overview.trim(),
          overviewFormat: parsed.data.overviewFormat,
          impact: parsed.data.impact?.trim() || null,
          impactFormat: parsed.data.impactFormat,
          recommendation: parsed.data.recommendation?.trim() || null,
          recommendationFormat: parsed.data.recommendationFormat,
          severity: parsed.data.severity,
          cvssScore: parsed.data.cvssScore != null ? String(parsed.data.cvssScore) : null,
          cvssVector: parsed.data.cvssVector || null,
          tagIds: parsed.data.tagIds,
          userId: session.userId,
        })
      )
      .catch(console.error);
  }

  return { success: "Finding added", findingId: newFinding.id };
}

export async function updateFinding(
  _prev: FindingState,
  formData: FormData
): Promise<FindingState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const engagementId = formData.get("engagementId") as string;
  if (!engagementId) return { error: "Missing engagement ID" };

  const access = await requireWriteAccessWithStatus(engagementId, session.userId);
  if (!access) return { error: "You need write access to edit findings" };
  const lockError = checkContentWritable(access);
  if (lockError) return { error: lockError };

  let resourceIds: string[] | undefined;
  const resourceIdsRaw = formData.get("resourceIds") as string | null;
  if (resourceIdsRaw) {
    try {
      resourceIds = JSON.parse(resourceIdsRaw);
    } catch {
      return { error: "Invalid resource IDs" };
    }
  }

  let tagIds: string[] | undefined;
  const tagIdsRaw = formData.get("tagIds") as string | null;
  if (tagIdsRaw) {
    try {
      tagIds = JSON.parse(tagIdsRaw);
    } catch {
      return { error: "Invalid tag IDs" };
    }
  }

  const cvssScoreRaw = formData.get("cvssScore") as string | null;
  const cvssScore = cvssScoreRaw ? parseFloat(cvssScoreRaw) : null;

  const raw = {
    findingId: formData.get("findingId") as string,
    title: formData.get("title") as string,
    overview: formData.get("overview") as string,
    overviewFormat: (formData.get("overviewFormat") as string) || "text",
    impact: (formData.get("impact") as string) || undefined,
    impactFormat: (formData.get("impactFormat") as string) || "text",
    recommendation: (formData.get("recommendation") as string) || undefined,
    recommendationFormat: (formData.get("recommendationFormat") as string) || "text",
    severity: (formData.get("severity") as string) || "medium",
    cvssScore: isNaN(cvssScore as number) ? null : cvssScore,
    cvssVector: (formData.get("cvssVector") as string) || null,
    resourceIds,
    tagIds,
  };

  const parsed = updateFindingSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  // Verify finding exists and belongs to this engagement
  const [finding] = await db
    .select({
      id: categoryFindings.id,
      categoryId: categoryFindings.categoryId,
      categoryName: engagementCategories.name,
    })
    .from(categoryFindings)
    .innerJoin(
      engagementCategories,
      eq(categoryFindings.categoryId, engagementCategories.id)
    )
    .where(eq(categoryFindings.id, parsed.data.findingId))
    .limit(1);

  if (!finding) return { error: "Finding not found" };

  await db.transaction(async (tx) => {
    await tx
      .update(categoryFindings)
      .set({
        title: parsed.data.title.trim(),
        overview: parsed.data.overview.trim(),
        overviewFormat: parsed.data.overviewFormat,
        impact: parsed.data.impact?.trim() || null,
        impactFormat: parsed.data.impactFormat,
        recommendation: parsed.data.recommendation?.trim() || null,
        recommendationFormat: parsed.data.recommendationFormat,
        severity: parsed.data.severity,
        cvssScore: parsed.data.cvssScore != null ? String(parsed.data.cvssScore) : null,
        cvssVector: parsed.data.cvssVector || null,
        updatedAt: new Date(),
      })
      .where(eq(categoryFindings.id, parsed.data.findingId));

    if (parsed.data.resourceIds !== undefined) {
      await tx
        .delete(findingResources)
        .where(eq(findingResources.findingId, parsed.data.findingId));

      if (parsed.data.resourceIds.length > 0) {
        await tx.insert(findingResources).values(
          parsed.data.resourceIds.map((resourceId) => ({
            findingId: parsed.data.findingId,
            resourceId,
          }))
        );
      }
    }

    if (parsed.data.tagIds !== undefined) {
      await tx
        .delete(findingTags)
        .where(eq(findingTags.findingId, parsed.data.findingId));

      if (parsed.data.tagIds.length > 0) {
        await tx.insert(findingTags).values(
          parsed.data.tagIds.map((tagId) => ({
            findingId: parsed.data.findingId,
            tagId,
          }))
        );
      }
    }
  });

  // Re-sync IP geolocations: clear old source links, then re-extract
  await db
    .delete(ipGeolocationSources)
    .where(
      and(
        eq(ipGeolocationSources.sourceType, "finding"),
        eq(ipGeolocationSources.sourceId, parsed.data.findingId)
      )
    );
  await db
    .delete(domainResolutionSources)
    .where(
      and(
        eq(domainResolutionSources.sourceType, "finding"),
        eq(domainResolutionSources.sourceId, parsed.data.findingId)
      )
    );
  await syncIpGeolocations({
    engagementId,
    sourceType: "finding",
    sourceId: parsed.data.findingId,
    texts: [parsed.data.title, parsed.data.overview, parsed.data.impact, parsed.data.recommendation],
  });

  await logActivity({
    engagementId,
    actorId: session.userId,
    eventType: "finding_updated",
    metadata: {
      findingTitle: parsed.data.title.trim(),
      categoryName: finding.categoryName,
      findingId: parsed.data.findingId,
      categoryId: finding.categoryId,
    },
  });

  revalidatePath(`/engagements/${engagementId}`);
  revalidatePath(`/engagements/${engagementId}/categories/${finding.categoryId}`);
  return { success: "Finding updated" };
}

export async function removeFinding(
  _prev: FindingState,
  formData: FormData
): Promise<FindingState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const engagementId = formData.get("engagementId") as string;
  const findingId = formData.get("findingId") as string;
  if (!engagementId || !findingId) return { error: "Missing required fields" };

  const access = await requireWriteAccessWithStatus(engagementId, session.userId);
  if (!access) return { error: "You need write access to remove findings" };
  const lockError = checkContentWritable(access);
  if (lockError) return { error: lockError };

  // Look up finding details before deleting
  const [finding] = await db
    .select({
      title: categoryFindings.title,
      categoryId: categoryFindings.categoryId,
      categoryName: engagementCategories.name,
    })
    .from(categoryFindings)
    .innerJoin(
      engagementCategories,
      eq(categoryFindings.categoryId, engagementCategories.id)
    )
    .where(eq(categoryFindings.id, findingId))
    .limit(1);

  // Clean up screenshot disk files before CASCADE delete removes the DB rows
  const screenshotsToDelete = await db
    .select({ diskPath: findingScreenshots.diskPath })
    .from(findingScreenshots)
    .where(eq(findingScreenshots.findingId, findingId));

  const screenshotsDir = join(process.cwd(), "data", "resources");
  for (const s of screenshotsToDelete) {
    const diskFilename = s.diskPath.split("/").pop();
    if (diskFilename) {
      try { await unlink(join(screenshotsDir, diskFilename)); } catch { /* file may already be gone */ }
    }
  }

  // Clean up IP/domain source links before deleting the finding
  await db
    .delete(ipGeolocationSources)
    .where(
      and(
        eq(ipGeolocationSources.sourceType, "finding"),
        eq(ipGeolocationSources.sourceId, findingId)
      )
    );
  await db
    .delete(domainResolutionSources)
    .where(
      and(
        eq(domainResolutionSources.sourceType, "finding"),
        eq(domainResolutionSources.sourceId, findingId)
      )
    );

  await db.delete(categoryFindings).where(eq(categoryFindings.id, findingId));

  if (finding) {
    await logActivity({
      engagementId,
      actorId: session.userId,
      eventType: "finding_deleted",
      metadata: {
        findingTitle: finding.title,
        categoryName: finding.categoryName,
        findingId,
        categoryId: finding.categoryId,
      },
    });
  }

  revalidatePath(`/engagements/${engagementId}`);
  if (finding) {
    revalidatePath(`/engagements/${engagementId}/categories/${finding.categoryId}`);
  }
  return { success: "Finding removed" };
}

export async function linkFindingResource(
  _prev: FindingState,
  formData: FormData
): Promise<FindingState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const engagementId = formData.get("engagementId") as string;
  if (!engagementId) return { error: "Missing engagement ID" };

  const access = await requireWriteAccessWithStatus(engagementId, session.userId);
  if (!access) return { error: "You need write access to link resources" };
  const lockError = checkContentWritable(access);
  if (lockError) return { error: lockError };

  const raw = {
    findingId: formData.get("findingId") as string,
    resourceId: formData.get("resourceId") as string,
  };

  const parsed = linkFindingResourceSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  await db.insert(findingResources).values({
    findingId: parsed.data.findingId,
    resourceId: parsed.data.resourceId,
  });

  const [findingRow] = await db
    .select({ categoryId: categoryFindings.categoryId })
    .from(categoryFindings)
    .where(eq(categoryFindings.id, parsed.data.findingId))
    .limit(1);

  revalidatePath(`/engagements/${engagementId}`);
  if (findingRow) {
    revalidatePath(`/engagements/${engagementId}/categories/${findingRow.categoryId}`);
  }
  return { success: "Resource linked" };
}

export async function unlinkFindingResource(
  _prev: FindingState,
  formData: FormData
): Promise<FindingState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const engagementId = formData.get("engagementId") as string;
  if (!engagementId) return { error: "Missing engagement ID" };

  const access = await requireWriteAccessWithStatus(engagementId, session.userId);
  if (!access) return { error: "You need write access to unlink resources" };
  const lockError = checkContentWritable(access);
  if (lockError) return { error: lockError };

  const raw = {
    findingId: formData.get("findingId") as string,
    resourceId: formData.get("resourceId") as string,
  };

  const parsed = linkFindingResourceSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const [findingRow] = await db
    .select({ categoryId: categoryFindings.categoryId })
    .from(categoryFindings)
    .where(eq(categoryFindings.id, parsed.data.findingId))
    .limit(1);

  await db
    .delete(findingResources)
    .where(
      and(
        eq(findingResources.findingId, parsed.data.findingId),
        eq(findingResources.resourceId, parsed.data.resourceId)
      )
    );

  revalidatePath(`/engagements/${engagementId}`);
  if (findingRow) {
    revalidatePath(`/engagements/${engagementId}/categories/${findingRow.categoryId}`);
  }
  return { success: "Resource unlinked" };
}

export async function tagFinding(
  _prev: FindingState,
  formData: FormData
): Promise<FindingState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const engagementId = formData.get("engagementId") as string;
  if (!engagementId) return { error: "Missing engagement ID" };

  const access = await requireWriteAccessWithStatus(engagementId, session.userId);
  if (!access) return { error: "You need write access to tag findings" };
  const lockError = checkContentWritable(access);
  if (lockError) return { error: lockError };

  const raw = {
    findingId: formData.get("findingId") as string,
    tagId: formData.get("tagId") as string,
  };

  const parsed = linkFindingTagSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  await db.insert(findingTags).values({
    findingId: parsed.data.findingId,
    tagId: parsed.data.tagId,
  });

  const [findingRow] = await db
    .select({ categoryId: categoryFindings.categoryId })
    .from(categoryFindings)
    .where(eq(categoryFindings.id, parsed.data.findingId))
    .limit(1);

  revalidatePath(`/engagements/${engagementId}`);
  if (findingRow) {
    revalidatePath(`/engagements/${engagementId}/categories/${findingRow.categoryId}`);
  }
  return { success: "Tag added" };
}

export async function untagFinding(
  _prev: FindingState,
  formData: FormData
): Promise<FindingState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const engagementId = formData.get("engagementId") as string;
  if (!engagementId) return { error: "Missing engagement ID" };

  const access = await requireWriteAccessWithStatus(engagementId, session.userId);
  if (!access) return { error: "You need write access to untag findings" };
  const lockError = checkContentWritable(access);
  if (lockError) return { error: lockError };

  const raw = {
    findingId: formData.get("findingId") as string,
    tagId: formData.get("tagId") as string,
  };

  const parsed = linkFindingTagSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const [findingRow] = await db
    .select({ categoryId: categoryFindings.categoryId })
    .from(categoryFindings)
    .where(eq(categoryFindings.id, parsed.data.findingId))
    .limit(1);

  await db
    .delete(findingTags)
    .where(
      and(
        eq(findingTags.findingId, parsed.data.findingId),
        eq(findingTags.tagId, parsed.data.tagId)
      )
    );

  revalidatePath(`/engagements/${engagementId}`);
  if (findingRow) {
    revalidatePath(`/engagements/${engagementId}/categories/${findingRow.categoryId}`);
  }
  return { success: "Tag removed" };
}

export async function removeScreenshot(
  _prev: FindingState,
  formData: FormData
): Promise<FindingState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const engagementId = formData.get("engagementId") as string;
  const screenshotId = formData.get("screenshotId") as string;
  if (!engagementId || !screenshotId) return { error: "Missing required fields" };

  const access = await requireWriteAccessWithStatus(engagementId, session.userId);
  if (!access) return { error: "You need write access to remove screenshots" };
  const lockError = checkContentWritable(access);
  if (lockError) return { error: lockError };

  // Look up screenshot and verify it belongs to this engagement
  const [screenshot] = await db
    .select({
      id: findingScreenshots.id,
      diskPath: findingScreenshots.diskPath,
      categoryId: categoryFindings.categoryId,
    })
    .from(findingScreenshots)
    .innerJoin(categoryFindings, eq(categoryFindings.id, findingScreenshots.findingId))
    .innerJoin(engagementCategories, eq(engagementCategories.id, categoryFindings.categoryId))
    .where(
      and(
        eq(findingScreenshots.id, screenshotId),
        eq(engagementCategories.engagementId, engagementId)
      )
    )
    .limit(1);

  if (!screenshot) return { error: "Screenshot not found" };

  // Delete DB row
  await db.delete(findingScreenshots).where(eq(findingScreenshots.id, screenshotId));

  // Clean up disk file
  const screenshotsDir = join(process.cwd(), "data", "resources");
  const diskFilename = screenshot.diskPath.split("/").pop();
  if (diskFilename) {
    try { await unlink(join(screenshotsDir, diskFilename)); } catch { /* file may already be gone */ }
  }

  revalidatePath(`/engagements/${engagementId}`);
  revalidatePath(`/engagements/${engagementId}/categories/${screenshot.categoryId}`);
  return { success: "Screenshot removed" };
}

const VALID_FINDING_FIELDS = new Set(["overview", "impact", "recommendation"]);

export async function updateFindingField(
  engagementId: string,
  findingId: string,
  field: string,
  value: string
): Promise<FindingState> {
  const session = await getSession();
  if (!session) redirect("/login");

  if (!VALID_FINDING_FIELDS.has(field)) return { error: "Invalid field" };
  if (!engagementId || !findingId) return { error: "Missing required fields" };

  const access = await requireWriteAccessWithStatus(engagementId, session.userId);
  if (!access) return { error: "You need write access to edit findings" };
  const lockError = checkContentWritable(access);
  if (lockError) return { error: lockError };

  // Verify finding belongs to this engagement
  const [finding] = await db
    .select({
      id: categoryFindings.id,
      title: categoryFindings.title,
      overview: categoryFindings.overview,
      impact: categoryFindings.impact,
      recommendation: categoryFindings.recommendation,
      categoryId: categoryFindings.categoryId,
      categoryName: engagementCategories.name,
    })
    .from(categoryFindings)
    .innerJoin(
      engagementCategories,
      eq(categoryFindings.categoryId, engagementCategories.id)
    )
    .where(
      and(
        eq(categoryFindings.id, findingId),
        eq(engagementCategories.engagementId, engagementId)
      )
    )
    .limit(1);

  if (!finding) return { error: "Finding not found" };

  const trimmed = value.trim();
  if (field === "overview" && !trimmed) return { error: "Overview cannot be empty" };

  // Update only the specified field
  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  updateData[field] = trimmed || null;

  await db
    .update(categoryFindings)
    .set(updateData)
    .where(eq(categoryFindings.id, findingId));

  // Re-sync IP geolocations with updated text
  await db
    .delete(ipGeolocationSources)
    .where(
      and(
        eq(ipGeolocationSources.sourceType, "finding"),
        eq(ipGeolocationSources.sourceId, findingId)
      )
    );
  await db
    .delete(domainResolutionSources)
    .where(
      and(
        eq(domainResolutionSources.sourceType, "finding"),
        eq(domainResolutionSources.sourceId, findingId)
      )
    );

  // Build updated text array for geolocation sync
  const updatedTexts = {
    overview: field === "overview" ? trimmed : finding.overview,
    impact: field === "impact" ? trimmed : finding.impact,
    recommendation: field === "recommendation" ? trimmed : finding.recommendation,
  };

  await syncIpGeolocations({
    engagementId,
    sourceType: "finding",
    sourceId: findingId,
    texts: [finding.title, updatedTexts.overview, updatedTexts.impact, updatedTexts.recommendation],
  });

  await logActivity({
    engagementId,
    actorId: session.userId,
    eventType: "finding_updated",
    metadata: {
      findingTitle: finding.title,
      categoryName: finding.categoryName,
      findingId,
      categoryId: finding.categoryId,
    },
  });

  revalidatePath(`/engagements/${engagementId}`);
  revalidatePath(`/engagements/${engagementId}/categories/${finding.categoryId}`);
  return { success: "Finding updated" };
}
