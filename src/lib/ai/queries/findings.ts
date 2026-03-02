import { eq, and, inArray, desc, sql, ilike } from "drizzle-orm";
import { db } from "@/db";
import {
  categoryFindings,
  engagementCategories,
  findingTags,
  tags,
} from "@/db/schema";

export async function listFindings(
  engagementId: string,
  args: { severity?: string; categoryName?: string; limit?: number }
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

  const conditions = [inArray(categoryFindings.categoryId, filteredCatIds)];
  if (args.severity) {
    conditions.push(eq(categoryFindings.severity, args.severity as typeof categoryFindings.severity.enumValues[number]));
  }

  const findings = await db
    .select({
      id: categoryFindings.id,
      title: categoryFindings.title,
      severity: categoryFindings.severity,
      cvssScore: categoryFindings.cvssScore,
      categoryId: categoryFindings.categoryId,
    })
    .from(categoryFindings)
    .where(and(...conditions))
    .orderBy(
      sql`CASE ${categoryFindings.severity}
        WHEN 'critical' THEN 0
        WHEN 'high' THEN 1
        WHEN 'medium' THEN 2
        WHEN 'low' THEN 3
        WHEN 'info' THEN 4
        WHEN 'fixed' THEN 5
      END`,
      desc(categoryFindings.createdAt)
    )
    .limit(limit);

  if (findings.length === 0) return "No findings match the specified filters.";

  // Fetch tags
  const findingIds = findings.map((f) => f.id);
  const tagLinks = await db
    .select({
      findingId: findingTags.findingId,
      name: tags.name,
      mitreId: tags.mitreId,
      tactic: tags.tactic,
    })
    .from(findingTags)
    .innerJoin(tags, eq(findingTags.tagId, tags.id))
    .where(inArray(findingTags.findingId, findingIds));

  const tagsByFinding = new Map<string, string[]>();
  for (const tl of tagLinks) {
    const arr = tagsByFinding.get(tl.findingId) ?? [];
    arr.push(tl.mitreId ? `${tl.mitreId} — ${tl.name} [${tl.tactic}]` : tl.name);
    tagsByFinding.set(tl.findingId, arr);
  }

  const catMap = new Map(cats.map((c) => [c.id, c.name]));

  const lines = findings.map((f, i) => {
    const fTags = tagsByFinding.get(f.id);
    const tagStr = fTags?.length ? ` | Tags: ${fTags.join(", ")}` : "";
    const cvss = f.cvssScore ? ` (CVSS ${f.cvssScore})` : "";
    return `${i + 1}. [${f.severity.toUpperCase()}] ${f.title}${cvss} — ${catMap.get(f.categoryId) ?? "Unknown"}${tagStr}\n   ID: ${f.id}`;
  });

  return `Found ${findings.length} finding(s):\n\n${lines.join("\n")}`;
}

export async function getFindingDetail(
  engagementId: string,
  args: { findingId: string }
): Promise<string> {
  // Verify the finding belongs to this engagement
  const [finding] = await db
    .select({
      id: categoryFindings.id,
      title: categoryFindings.title,
      overview: categoryFindings.overview,
      impact: categoryFindings.impact,
      recommendation: categoryFindings.recommendation,
      severity: categoryFindings.severity,
      cvssScore: categoryFindings.cvssScore,
      cvssVector: categoryFindings.cvssVector,
      categoryId: categoryFindings.categoryId,
    })
    .from(categoryFindings)
    .innerJoin(
      engagementCategories,
      eq(categoryFindings.categoryId, engagementCategories.id)
    )
    .where(
      and(
        eq(categoryFindings.id, args.findingId),
        eq(engagementCategories.engagementId, engagementId)
      )
    )
    .limit(1);

  if (!finding) return "Finding not found in this engagement.";

  const fTags = await db
    .select({ name: tags.name, mitreId: tags.mitreId, tactic: tags.tactic })
    .from(findingTags)
    .innerJoin(tags, eq(findingTags.tagId, tags.id))
    .where(eq(findingTags.findingId, finding.id));

  const [cat] = await db
    .select({ name: engagementCategories.name })
    .from(engagementCategories)
    .where(eq(engagementCategories.id, finding.categoryId))
    .limit(1);

  const parts = [
    `**${finding.title}**`,
    `Severity: ${finding.severity.toUpperCase()}${finding.cvssScore ? ` (CVSS ${finding.cvssScore})` : ""}`,
    `Category: ${cat?.name ?? "Unknown"}`,
    finding.cvssVector ? `CVSS Vector: ${finding.cvssVector}` : null,
    fTags.length > 0
      ? `Tags: ${fTags.map((t) => (t.mitreId ? `${t.mitreId} - ${t.name} [${t.tactic}]` : t.name)).join(", ")}`
      : null,
    finding.overview ? `\nOverview:\n${finding.overview}` : null,
    finding.impact ? `\nImpact:\n${finding.impact}` : null,
    finding.recommendation
      ? `\nRecommendation:\n${finding.recommendation}`
      : null,
  ];

  return parts.filter(Boolean).join("\n");
}
