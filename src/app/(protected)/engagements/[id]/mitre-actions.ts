"use server";

import { redirect } from "next/navigation";
import { eq, and, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import {
  engagementMembers,
  engagementCategories,
  categoryPresets,
  categoryActions,
  categoryFindings,
  actionTags,
  findingTags,
  tags,
} from "@/db/schema";
import { getSession } from "@/lib/auth/session";

export interface CoverageOrigin {
  type: "action" | "finding";
  entityId: string;
  entityTitle: string;
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
}

export interface CoverageEntry {
  mitreId: string;
  origins: CoverageOrigin[];
}

export async function getEngagementMitreCoverage(
  engagementId: string
): Promise<CoverageEntry[]> {
  const session = await getSession();
  if (!session) redirect("/login");

  // Verify membership (read access is sufficient)
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

  if (!member) return [];

  // Fetch action-tag and finding-tag coverage in parallel
  const [actionCoverage, findingCoverage] = await Promise.all([
    db
      .select({
        mitreId: tags.mitreId,
        entityId: categoryActions.id,
        entityTitle: categoryActions.title,
        categoryId: engagementCategories.id,
        categoryName: engagementCategories.name,
        categoryIcon: categoryPresets.icon,
      })
      .from(actionTags)
      .innerJoin(tags, eq(actionTags.tagId, tags.id))
      .innerJoin(categoryActions, eq(actionTags.actionId, categoryActions.id))
      .innerJoin(
        engagementCategories,
        eq(categoryActions.categoryId, engagementCategories.id)
      )
      .innerJoin(
        categoryPresets,
        eq(engagementCategories.presetId, categoryPresets.id)
      )
      .where(
        and(
          eq(engagementCategories.engagementId, engagementId),
          isNotNull(tags.mitreId)
        )
      ),
    db
      .select({
        mitreId: tags.mitreId,
        entityId: categoryFindings.id,
        entityTitle: categoryFindings.title,
        categoryId: engagementCategories.id,
        categoryName: engagementCategories.name,
        categoryIcon: categoryPresets.icon,
      })
      .from(findingTags)
      .innerJoin(tags, eq(findingTags.tagId, tags.id))
      .innerJoin(
        categoryFindings,
        eq(findingTags.findingId, categoryFindings.id)
      )
      .innerJoin(
        engagementCategories,
        eq(categoryFindings.categoryId, engagementCategories.id)
      )
      .innerJoin(
        categoryPresets,
        eq(engagementCategories.presetId, categoryPresets.id)
      )
      .where(
        and(
          eq(engagementCategories.engagementId, engagementId),
          isNotNull(tags.mitreId)
        )
      ),
  ]);

  // Merge into coverage map
  const coverageMap = new Map<string, CoverageEntry>();

  for (const row of actionCoverage) {
    if (!row.mitreId) continue;
    let entry = coverageMap.get(row.mitreId);
    if (!entry) {
      entry = { mitreId: row.mitreId, origins: [] };
      coverageMap.set(row.mitreId, entry);
    }
    entry.origins.push({
      type: "action",
      entityId: row.entityId,
      entityTitle: row.entityTitle,
      categoryId: row.categoryId,
      categoryName: row.categoryName,
      categoryIcon: row.categoryIcon,
    });
  }

  for (const row of findingCoverage) {
    if (!row.mitreId) continue;
    let entry = coverageMap.get(row.mitreId);
    if (!entry) {
      entry = { mitreId: row.mitreId, origins: [] };
      coverageMap.set(row.mitreId, entry);
    }
    entry.origins.push({
      type: "finding",
      entityId: row.entityId,
      entityTitle: row.entityTitle,
      categoryId: row.categoryId,
      categoryName: row.categoryName,
      categoryIcon: row.categoryIcon,
    });
  }

  return Array.from(coverageMap.values());
}
