import { eq, and, inArray, ilike, or, sql, ne } from "drizzle-orm";
import { db } from "@/db";
import {
  categoryFindings,
  categoryActions,
  engagementCategories,
  resources,
  resourceFields,
} from "@/db/schema";

export async function searchContent(
  engagementId: string,
  args: { query: string; scope?: string }
): Promise<string> {
  const query = args.query?.trim();
  if (!query || query.length < 2) {
    return "Error: search query must be at least 2 characters.";
  }

  const pattern = `%${query}%`;
  const searchScope = args.scope ?? "all";

  // Get engagement categories for scoping
  const cats = await db
    .select({ id: engagementCategories.id, name: engagementCategories.name })
    .from(engagementCategories)
    .where(eq(engagementCategories.engagementId, engagementId));

  if (cats.length === 0) return "No data in this engagement.";
  const catIds = cats.map((c) => c.id);
  const catMap = new Map(cats.map((c) => [c.id, c.name]));

  const sections: string[] = [];

  // Search findings (title, overview, impact, recommendation)
  if (searchScope === "all" || searchScope === "findings") {
    const findings = await db
      .select({
        id: categoryFindings.id,
        title: categoryFindings.title,
        severity: categoryFindings.severity,
        overview: categoryFindings.overview,
        impact: categoryFindings.impact,
        recommendation: categoryFindings.recommendation,
        categoryId: categoryFindings.categoryId,
      })
      .from(categoryFindings)
      .where(
        and(
          inArray(categoryFindings.categoryId, catIds),
          or(
            ilike(categoryFindings.title, pattern),
            ilike(categoryFindings.overview, pattern),
            ilike(categoryFindings.impact, pattern),
            ilike(categoryFindings.recommendation, pattern)
          )
        )
      )
      .limit(15);

    if (findings.length > 0) {
      const lines = findings.map((f, i) => {
        // Show which field matched with a snippet
        const matchField = getMatchSnippet(query, {
          title: f.title,
          overview: f.overview,
          impact: f.impact,
          recommendation: f.recommendation,
        });
        return `${i + 1}. [${f.severity.toUpperCase()}] **${f.title}** — ${catMap.get(f.categoryId) ?? "Unknown"}\n   Match in ${matchField.field}: "...${matchField.snippet}..."\n   ID: ${f.id}`;
      });
      sections.push(`## Findings (${findings.length} match${findings.length > 1 ? "es" : ""})\n\n${lines.join("\n\n")}`);
    }
  }

  // Search actions (title, content)
  if (searchScope === "all" || searchScope === "actions") {
    const actions = await db
      .select({
        id: categoryActions.id,
        title: categoryActions.title,
        content: categoryActions.content,
        performedAt: categoryActions.performedAt,
        categoryId: categoryActions.categoryId,
      })
      .from(categoryActions)
      .where(
        and(
          inArray(categoryActions.categoryId, catIds),
          or(
            ilike(categoryActions.title, pattern),
            ilike(categoryActions.content, pattern)
          )
        )
      )
      .limit(15);

    if (actions.length > 0) {
      const lines = actions.map((a, i) => {
        const matchField = getMatchSnippet(query, {
          title: a.title,
          content: a.content,
        });
        const date = a.performedAt
          ? new Date(a.performedAt).toISOString().split("T")[0]
          : "No date";
        return `${i + 1}. **${a.title}** — ${date} [${catMap.get(a.categoryId) ?? "Unknown"}]\n   Match in ${matchField.field}: "...${matchField.snippet}..."`;
      });
      sections.push(`## Actions (${actions.length} match${actions.length > 1 ? "es" : ""})\n\n${lines.join("\n\n")}`);
    }
  }

  // Search resource fields (non-secret plain text values only)
  if (searchScope === "all" || searchScope === "resources") {
    const matchingFields = await db
      .select({
        resourceId: resourceFields.resourceId,
        label: resourceFields.label,
        value: resourceFields.value,
      })
      .from(resourceFields)
      .innerJoin(resources, eq(resourceFields.resourceId, resources.id))
      .where(
        and(
          inArray(resources.categoryId, catIds),
          ne(resourceFields.type, "secret"),
          ilike(resourceFields.value, pattern)
        )
      )
      .limit(15);

    if (matchingFields.length > 0) {
      // Get resource names
      const resourceIds = [...new Set(matchingFields.map((f) => f.resourceId))];
      const resourceRows = await db
        .select({ id: resources.id, name: resources.name, categoryId: resources.categoryId })
        .from(resources)
        .where(inArray(resources.id, resourceIds));
      const resourceMap = new Map(resourceRows.map((r) => [r.id, r]));

      const lines = matchingFields.map((f, i) => {
        const res = resourceMap.get(f.resourceId);
        const snippet = extractSnippet(query, f.value ?? "");
        return `${i + 1}. Resource **${res?.name ?? "Unknown"}** — field "${f.label}" [${catMap.get(res?.categoryId ?? "") ?? "Unknown"}]\n   "...${snippet}..."`;
      });
      sections.push(`## Resources (${matchingFields.length} match${matchingFields.length > 1 ? "es" : ""})\n\n${lines.join("\n\n")}`);
    }
  }

  if (sections.length === 0) {
    return `No results found for "${query}" in ${searchScope === "all" ? "findings, actions, or resources" : searchScope}.`;
  }

  return `Search results for "${query}":\n\n${sections.join("\n\n---\n\n")}`;
}

function getMatchSnippet(
  query: string,
  fields: Record<string, string | null>
): { field: string; snippet: string } {
  const lower = query.toLowerCase();
  for (const [field, value] of Object.entries(fields)) {
    if (!value) continue;
    const idx = value.toLowerCase().indexOf(lower);
    if (idx !== -1) {
      return {
        field,
        snippet: extractSnippet(query, value),
      };
    }
  }
  return { field: "content", snippet: "" };
}

function extractSnippet(query: string, text: string): string {
  const lower = text.toLowerCase();
  const idx = lower.indexOf(query.toLowerCase());
  if (idx === -1) return text.slice(0, 100);
  const start = Math.max(0, idx - 50);
  const end = Math.min(text.length, idx + query.length + 50);
  return text.slice(start, end).replace(/\n/g, " ");
}
