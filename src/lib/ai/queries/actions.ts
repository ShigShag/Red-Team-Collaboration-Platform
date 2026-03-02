import { eq, and, inArray, desc } from "drizzle-orm";
import { db } from "@/db";
import {
  categoryActions,
  engagementCategories,
  actionTags,
  tags,
  users,
} from "@/db/schema";

export async function listActions(
  engagementId: string,
  args: { categoryName?: string; limit?: number }
): Promise<string> {
  const limit = Math.min(args.limit ?? 20, 50);

  const cats = await db
    .select({ id: engagementCategories.id, name: engagementCategories.name })
    .from(engagementCategories)
    .where(eq(engagementCategories.engagementId, engagementId));

  if (cats.length === 0) return "No categories found in this engagement.";

  let filteredCatIds = cats.map((c) => c.id);
  if (args.categoryName) {
    const lower = args.categoryName.toLowerCase();
    const matched = cats.filter((c) => c.name.toLowerCase().includes(lower));
    if (matched.length === 0) return `No categories matching "${args.categoryName}".`;
    filteredCatIds = matched.map((c) => c.id);
  }

  const actions = await db
    .select({
      id: categoryActions.id,
      title: categoryActions.title,
      performedAt: categoryActions.performedAt,
      categoryId: categoryActions.categoryId,
      createdByName: users.displayName,
      createdByUsername: users.username,
    })
    .from(categoryActions)
    .innerJoin(users, eq(categoryActions.createdBy, users.id))
    .where(inArray(categoryActions.categoryId, filteredCatIds))
    .orderBy(desc(categoryActions.performedAt))
    .limit(limit);

  if (actions.length === 0) return "No actions match the specified filters.";

  // Fetch tags
  const actionIds = actions.map((a) => a.id);
  const tagLinks = await db
    .select({
      actionId: actionTags.actionId,
      name: tags.name,
      mitreId: tags.mitreId,
      tactic: tags.tactic,
    })
    .from(actionTags)
    .innerJoin(tags, eq(actionTags.tagId, tags.id))
    .where(inArray(actionTags.actionId, actionIds));

  const tagsByAction = new Map<string, string[]>();
  for (const tl of tagLinks) {
    const arr = tagsByAction.get(tl.actionId) ?? [];
    arr.push(tl.mitreId ? `${tl.mitreId} — ${tl.name} [${tl.tactic}]` : tl.name);
    tagsByAction.set(tl.actionId, arr);
  }

  const catMap = new Map(cats.map((c) => [c.id, c.name]));

  const lines = actions.map((a, i) => {
    const aTags = tagsByAction.get(a.id);
    const tagStr = aTags?.length ? ` | Tags: ${aTags.join(", ")}` : "";
    const date = a.performedAt
      ? new Date(a.performedAt).toISOString().split("T")[0]
      : "No date";
    const operator = a.createdByName ?? a.createdByUsername;
    return `${i + 1}. ${a.title} — ${date} by ${operator} [${catMap.get(a.categoryId) ?? "Unknown"}]${tagStr}`;
  });

  return `Found ${actions.length} action(s):\n\n${lines.join("\n")}`;
}
