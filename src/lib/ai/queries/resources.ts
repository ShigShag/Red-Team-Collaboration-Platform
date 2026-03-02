import { eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  resources,
  resourceFields,
  engagementCategories,
} from "@/db/schema";

export async function listResources(
  engagementId: string,
  args: { categoryName?: string }
): Promise<string> {
  const cats = await db
    .select({ id: engagementCategories.id, name: engagementCategories.name })
    .from(engagementCategories)
    .where(eq(engagementCategories.engagementId, engagementId));

  if (cats.length === 0) return "No categories in this engagement.";

  let filteredCatIds = cats.map((c) => c.id);
  if (args.categoryName) {
    const lower = args.categoryName.toLowerCase();
    const matched = cats.filter((c) => c.name.toLowerCase().includes(lower));
    if (matched.length === 0)
      return `No categories matching "${args.categoryName}".`;
    filteredCatIds = matched.map((c) => c.id);
  }

  const resourceRows = await db
    .select({
      id: resources.id,
      name: resources.name,
      description: resources.description,
      categoryId: resources.categoryId,
    })
    .from(resources)
    .where(inArray(resources.categoryId, filteredCatIds))
    .orderBy(resources.createdAt)
    .limit(50);

  if (resourceRows.length === 0) return "No resources found.";

  // Fetch field types (but NOT values — never expose secrets)
  const resourceIds = resourceRows.map((r) => r.id);
  const fields = await db
    .select({
      resourceId: resourceFields.resourceId,
      label: resourceFields.label,
      fieldType: resourceFields.type,
    })
    .from(resourceFields)
    .where(inArray(resourceFields.resourceId, resourceIds))
    .orderBy(resourceFields.sortOrder);

  const fieldsByResource = new Map<
    string,
    { label: string; fieldType: string }[]
  >();
  for (const f of fields) {
    const arr = fieldsByResource.get(f.resourceId) ?? [];
    arr.push({ label: f.label, fieldType: f.fieldType });
    fieldsByResource.set(f.resourceId, arr);
  }

  const catMap = new Map(cats.map((c) => [c.id, c.name]));

  const lines = resourceRows.map((r, i) => {
    const rFields = fieldsByResource.get(r.id) ?? [];
    const fieldStr = rFields.length
      ? ` | Fields: ${rFields.map((f) => `${f.label} (${f.fieldType})`).join(", ")}`
      : "";
    const desc = r.description ? ` — ${r.description}` : "";
    return `${i + 1}. **${r.name}**${desc} [${catMap.get(r.categoryId) ?? "Unknown"}]${fieldStr}`;
  });

  return `${resourceRows.length} resource(s):\n\n${lines.join("\n")}`;
}
