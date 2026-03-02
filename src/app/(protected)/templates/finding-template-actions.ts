"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq, ilike, and, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { findingTemplates, findingTemplateTags } from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import {
  createFindingTemplateSchema,
  updateFindingTemplateSchema,
  deleteFindingTemplateSchema,
} from "@/lib/validations";

export type FindingTemplateState = {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string[]>;
};

export type FindingTemplateData = {
  id: string;
  title: string;
  category: string;
  overview: string;
  overviewFormat: string;
  impact: string | null;
  impactFormat: string;
  recommendation: string | null;
  recommendationFormat: string;
  severity: string;
  cvssScore: string | null;
  cvssVector: string | null;
  isSystem: boolean;
  createdBy: string | null;
  createdAt: Date;
  tagIds: string[];
};

/**
 * Generate a unique template name by appending (N) if a duplicate exists.
 */
async function getUniqueTemplateName(baseName: string): Promise<string> {
  const [existing] = await db
    .select({ id: findingTemplates.id })
    .from(findingTemplates)
    .where(eq(findingTemplates.title, baseName))
    .limit(1);

  if (!existing) return baseName;

  // Find all "baseName (N)" entries
  const matches = await db
    .select({ title: findingTemplates.title })
    .from(findingTemplates)
    .where(
      or(
        eq(findingTemplates.title, baseName),
        ilike(findingTemplates.title, `${baseName} (%)`)
      )
    );

  let maxN = 0;
  const re = /\((\d+)\)$/;
  for (const m of matches) {
    const match = m.title.match(re);
    if (match) maxN = Math.max(maxN, parseInt(match[1]));
  }

  return `${baseName} (${maxN + 1})`;
}

export async function createFindingTemplate(
  _prev: FindingTemplateState,
  formData: FormData
): Promise<FindingTemplateState> {
  const session = await getSession();
  if (!session) redirect("/login");

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
    title: formData.get("title") as string,
    category: (formData.get("category") as string) || "general",
    overview: formData.get("overview") as string,
    overviewFormat: (formData.get("overviewFormat") as string) || "text",
    impact: (formData.get("impact") as string) || undefined,
    impactFormat: (formData.get("impactFormat") as string) || "text",
    recommendation: (formData.get("recommendation") as string) || undefined,
    recommendationFormat: (formData.get("recommendationFormat") as string) || "text",
    severity: (formData.get("severity") as string) || "medium",
    cvssScore: isNaN(cvssScore as number) ? null : cvssScore,
    cvssVector: (formData.get("cvssVector") as string) || null,
    tagIds,
  };

  const parsed = createFindingTemplateSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  await db.transaction(async (tx) => {
    const [created] = await tx.insert(findingTemplates).values({
      title: parsed.data.title.trim(),
      category: parsed.data.category,
      overview: parsed.data.overview.trim(),
      overviewFormat: parsed.data.overviewFormat,
      impact: parsed.data.impact?.trim() || null,
      impactFormat: parsed.data.impactFormat,
      recommendation: parsed.data.recommendation?.trim() || null,
      recommendationFormat: parsed.data.recommendationFormat,
      severity: parsed.data.severity,
      cvssScore: parsed.data.cvssScore != null ? String(parsed.data.cvssScore) : null,
      cvssVector: parsed.data.cvssVector || null,
      isSystem: false,
      createdBy: session.userId,
    }).returning({ id: findingTemplates.id });

    if (parsed.data.tagIds && parsed.data.tagIds.length > 0) {
      await tx.insert(findingTemplateTags).values(
        parsed.data.tagIds.map((tagId) => ({
          templateId: created.id,
          tagId,
        }))
      );
    }
  });

  revalidatePath("/templates");
  return { success: "Template created" };
}

export async function updateFindingTemplate(
  _prev: FindingTemplateState,
  formData: FormData
): Promise<FindingTemplateState> {
  const session = await getSession();
  if (!session) redirect("/login");

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
    templateId: formData.get("templateId") as string,
    title: formData.get("title") as string,
    category: (formData.get("category") as string) || "general",
    overview: formData.get("overview") as string,
    overviewFormat: (formData.get("overviewFormat") as string) || "text",
    impact: (formData.get("impact") as string) || undefined,
    impactFormat: (formData.get("impactFormat") as string) || "text",
    recommendation: (formData.get("recommendation") as string) || undefined,
    recommendationFormat: (formData.get("recommendationFormat") as string) || "text",
    severity: (formData.get("severity") as string) || "medium",
    cvssScore: isNaN(cvssScore as number) ? null : cvssScore,
    cvssVector: (formData.get("cvssVector") as string) || null,
    tagIds,
  };

  const parsed = updateFindingTemplateSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const [existing] = await db
    .select({ isSystem: findingTemplates.isSystem })
    .from(findingTemplates)
    .where(eq(findingTemplates.id, parsed.data.templateId))
    .limit(1);

  if (!existing) return { error: "Template not found" };
  if (existing.isSystem) return { error: "System templates cannot be edited" };

  await db.transaction(async (tx) => {
    await tx
      .update(findingTemplates)
      .set({
        title: parsed.data.title.trim(),
        category: parsed.data.category,
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
      .where(eq(findingTemplates.id, parsed.data.templateId));

    // Replace tag links
    await tx
      .delete(findingTemplateTags)
      .where(eq(findingTemplateTags.templateId, parsed.data.templateId));

    if (parsed.data.tagIds && parsed.data.tagIds.length > 0) {
      await tx.insert(findingTemplateTags).values(
        parsed.data.tagIds.map((tagId) => ({
          templateId: parsed.data.templateId,
          tagId,
        }))
      );
    }
  });

  revalidatePath("/templates");
  return { success: "Template updated" };
}

export async function deleteFindingTemplate(
  _prev: FindingTemplateState,
  formData: FormData
): Promise<FindingTemplateState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const raw = {
    templateId: formData.get("templateId") as string,
  };

  const parsed = deleteFindingTemplateSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const [existing] = await db
    .select({ isSystem: findingTemplates.isSystem })
    .from(findingTemplates)
    .where(eq(findingTemplates.id, parsed.data.templateId))
    .limit(1);

  if (!existing) return { error: "Template not found" };
  if (existing.isSystem) return { error: "System templates cannot be deleted" };

  await db
    .delete(findingTemplates)
    .where(eq(findingTemplates.id, parsed.data.templateId));

  revalidatePath("/templates");
  return { success: "Template deleted" };
}

/**
 * Save a finding as a template (called from createFinding action).
 * Handles duplicate name resolution by appending (N).
 */
export async function saveFindingAsTemplate(params: {
  title: string;
  category: string;
  overview: string;
  overviewFormat: string;
  impact: string | null;
  impactFormat: string;
  recommendation: string | null;
  recommendationFormat: string;
  severity: string;
  cvssScore: string | null;
  cvssVector: string | null;
  tagIds?: string[];
  userId: string;
}): Promise<void> {
  const uniqueTitle = await getUniqueTemplateName(params.title.trim());

  await db.transaction(async (tx) => {
    const [created] = await tx.insert(findingTemplates).values({
      title: uniqueTitle,
      category: params.category as typeof findingTemplates.$inferInsert.category,
      overview: params.overview.trim(),
      overviewFormat: params.overviewFormat,
      impact: params.impact?.trim() || null,
      impactFormat: params.impactFormat,
      recommendation: params.recommendation?.trim() || null,
      recommendationFormat: params.recommendationFormat,
      severity: params.severity as typeof findingTemplates.$inferInsert.severity,
      cvssScore: params.cvssScore,
      cvssVector: params.cvssVector || null,
      isSystem: false,
      createdBy: params.userId,
    }).returning({ id: findingTemplates.id });

    if (params.tagIds && params.tagIds.length > 0) {
      await tx.insert(findingTemplateTags).values(
        params.tagIds.map((tagId) => ({
          templateId: created.id,
          tagId,
        }))
      );
    }
  });

  revalidatePath("/templates");
}

/**
 * Search/list finding templates with optional filters.
 * Used by the template picker in FindingModal.
 */
export async function searchFindingTemplates(
  query?: string,
  category?: string,
  severity?: string
): Promise<FindingTemplateData[]> {
  const conditions = [];

  if (query && query.trim()) {
    const q = `%${query.trim()}%`;
    conditions.push(
      or(
        ilike(findingTemplates.title, q),
        ilike(findingTemplates.overview, q)
      )
    );
  }

  if (category && category !== "all") {
    conditions.push(eq(findingTemplates.category, category as "web" | "network" | "cloud" | "mobile" | "wireless" | "social_engineering" | "physical" | "api" | "active_directory" | "code_review" | "general"));
  }

  if (severity && severity !== "all") {
    conditions.push(eq(findingTemplates.severity, severity as "critical" | "high" | "medium" | "low" | "info" | "fixed"));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const templates = await db
    .select({
      id: findingTemplates.id,
      title: findingTemplates.title,
      category: findingTemplates.category,
      overview: findingTemplates.overview,
      overviewFormat: findingTemplates.overviewFormat,
      impact: findingTemplates.impact,
      impactFormat: findingTemplates.impactFormat,
      recommendation: findingTemplates.recommendation,
      recommendationFormat: findingTemplates.recommendationFormat,
      severity: findingTemplates.severity,
      cvssScore: findingTemplates.cvssScore,
      cvssVector: findingTemplates.cvssVector,
      isSystem: findingTemplates.isSystem,
      createdBy: findingTemplates.createdBy,
      createdAt: findingTemplates.createdAt,
    })
    .from(findingTemplates)
    .where(whereClause)
    .orderBy(findingTemplates.title);

  // Fetch tag IDs for each template
  const templateIds = templates.map((t) => t.id);
  let tagLinks: { templateId: string; tagId: string }[] = [];

  if (templateIds.length > 0) {
    tagLinks = await db
      .select({
        templateId: findingTemplateTags.templateId,
        tagId: findingTemplateTags.tagId,
      })
      .from(findingTemplateTags)
      .where(
        sql`${findingTemplateTags.templateId} IN ${templateIds}`
      );
  }

  const tagMap = new Map<string, string[]>();
  for (const link of tagLinks) {
    const existing = tagMap.get(link.templateId) || [];
    existing.push(link.tagId);
    tagMap.set(link.templateId, existing);
  }

  return templates.map((t) => ({
    ...t,
    tagIds: tagMap.get(t.id) || [],
  }));
}
