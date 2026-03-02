import { eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  engagementCategories,
  categoryFindings,
  categoryActions,
  resources,
} from "@/db/schema";

export async function listCategories(
  engagementId: string
): Promise<string> {
  const cats = await db
    .select({
      id: engagementCategories.id,
      parentId: engagementCategories.parentId,
      name: engagementCategories.name,
      description: engagementCategories.description,
    })
    .from(engagementCategories)
    .where(eq(engagementCategories.engagementId, engagementId))
    .orderBy(engagementCategories.createdAt);

  if (cats.length === 0) return "No categories in this engagement.";

  // Count findings, actions, resources per category
  const catIds = cats.map((c) => c.id);

  const [findingCounts, actionCounts, resourceCounts] = await Promise.all([
    db
      .select({
        categoryId: categoryFindings.categoryId,
        count: sql<number>`count(*)::int`.as("count"),
      })
      .from(categoryFindings)
      .where(inArray(categoryFindings.categoryId, catIds))
      .groupBy(categoryFindings.categoryId),
    db
      .select({
        categoryId: categoryActions.categoryId,
        count: sql<number>`count(*)::int`.as("count"),
      })
      .from(categoryActions)
      .where(inArray(categoryActions.categoryId, catIds))
      .groupBy(categoryActions.categoryId),
    db
      .select({
        categoryId: resources.categoryId,
        count: sql<number>`count(*)::int`.as("count"),
      })
      .from(resources)
      .where(inArray(resources.categoryId, catIds))
      .groupBy(resources.categoryId),
  ]);

  const fMap = new Map(findingCounts.map((r) => [r.categoryId, r.count]));
  const aMap = new Map(actionCounts.map((r) => [r.categoryId, r.count]));
  const rMap = new Map(resourceCounts.map((r) => [r.categoryId, r.count]));

  // Build tree
  const catMap = new Map(cats.map((c) => [c.id, c]));
  const lines: string[] = [];

  function renderCat(catId: string, depth: number) {
    const c = catMap.get(catId);
    if (!c) return;
    const indent = "  ".repeat(depth);
    const f = fMap.get(c.id) ?? 0;
    const a = aMap.get(c.id) ?? 0;
    const r = rMap.get(c.id) ?? 0;
    const desc = c.description ? ` — ${c.description}` : "";
    lines.push(
      `${indent}- **${c.name}**${desc} (${f} findings, ${a} actions, ${r} resources)`
    );
    // Render children
    for (const child of cats) {
      if (child.parentId === c.id) renderCat(child.id, depth + 1);
    }
  }

  // Start with root categories
  for (const c of cats) {
    if (!c.parentId) renderCat(c.id, 0);
  }

  return `${cats.length} categories:\n\n${lines.join("\n")}`;
}
