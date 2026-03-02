import { eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  engagements,
  engagementMembers,
  engagementCategories,
  categoryFindings,
  categoryActions,
  users,
} from "@/db/schema";

export async function getEngagementSummary(
  engagementId: string
): Promise<string> {
  const [engagement] = await db
    .select({
      name: engagements.name,
      description: engagements.description,
      status: engagements.status,
      startDate: engagements.startDate,
      endDate: engagements.endDate,
    })
    .from(engagements)
    .where(eq(engagements.id, engagementId))
    .limit(1);

  if (!engagement) return "Engagement not found.";

  // Parallel queries
  const [members, catIds, severityCounts, actionCount] = await Promise.all([
    db
      .select({
        username: users.username,
        displayName: users.displayName,
        role: engagementMembers.role,
      })
      .from(engagementMembers)
      .innerJoin(users, eq(engagementMembers.userId, users.id))
      .where(eq(engagementMembers.engagementId, engagementId)),

    db
      .select({ id: engagementCategories.id })
      .from(engagementCategories)
      .where(eq(engagementCategories.engagementId, engagementId)),

    db
      .select({
        severity: categoryFindings.severity,
        count: sql<number>`count(*)::int`.as("count"),
      })
      .from(categoryFindings)
      .innerJoin(
        engagementCategories,
        eq(categoryFindings.categoryId, engagementCategories.id)
      )
      .where(eq(engagementCategories.engagementId, engagementId))
      .groupBy(categoryFindings.severity),

    db
      .select({ count: sql<number>`count(*)::int`.as("count") })
      .from(categoryActions)
      .innerJoin(
        engagementCategories,
        eq(categoryActions.categoryId, engagementCategories.id)
      )
      .where(eq(engagementCategories.engagementId, engagementId)),
  ]);

  const sevMap: Record<string, number> = {};
  let totalFindings = 0;
  for (const s of severityCounts) {
    sevMap[s.severity] = s.count;
    totalFindings += s.count;
  }

  const dateRange =
    engagement.startDate && engagement.endDate
      ? `${engagement.startDate} to ${engagement.endDate}`
      : engagement.startDate ?? "Not set";

  const memberList = members
    .map((m) => `${m.displayName ?? m.username} (${m.role})`)
    .join(", ");

  return [
    `**${engagement.name}**`,
    engagement.description ? `${engagement.description}` : null,
    `Status: ${engagement.status}`,
    `Date Range: ${dateRange}`,
    `Categories: ${catIds.length}`,
    `Team: ${memberList}`,
    "",
    `**Findings (${totalFindings} total):**`,
    `Critical: ${sevMap.critical ?? 0} | High: ${sevMap.high ?? 0} | Medium: ${sevMap.medium ?? 0} | Low: ${sevMap.low ?? 0} | Info: ${sevMap.info ?? 0} | Fixed: ${sevMap.fixed ?? 0}`,
    "",
    `**Actions:** ${actionCount[0]?.count ?? 0} total`,
  ]
    .filter((l) => l !== null)
    .join("\n");
}

export async function getEngagementStats(
  engagementId: string
): Promise<string> {
  const cats = await db
    .select({ id: engagementCategories.id, name: engagementCategories.name })
    .from(engagementCategories)
    .where(eq(engagementCategories.engagementId, engagementId));

  if (cats.length === 0) return "No categories in this engagement.";

  const catIds = cats.map((c) => c.id);

  const [findings, actionCountResult] = await Promise.all([
    db
      .select({
        severity: categoryFindings.severity,
        cvssScore: categoryFindings.cvssScore,
        categoryId: categoryFindings.categoryId,
      })
      .from(categoryFindings)
      .where(inArray(categoryFindings.categoryId, catIds)),

    db
      .select({ count: sql<number>`count(*)::int`.as("count") })
      .from(categoryActions)
      .where(inArray(categoryActions.categoryId, catIds)),
  ]);

  const bySeverity: Record<string, number> = {};
  const byCategory = new Map<string, number>();
  let cvssSum = 0;
  let cvssCount = 0;

  for (const f of findings) {
    bySeverity[f.severity] = (bySeverity[f.severity] ?? 0) + 1;
    byCategory.set(f.categoryId, (byCategory.get(f.categoryId) ?? 0) + 1);
    if (f.cvssScore) {
      cvssSum += parseFloat(f.cvssScore);
      cvssCount++;
    }
  }

  const catMap = new Map(cats.map((c) => [c.id, c.name]));

  const catLines = Array.from(byCategory.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([id, count]) => `  ${catMap.get(id) ?? "Unknown"}: ${count}`)
    .join("\n");

  const avgCvss = cvssCount > 0 ? (cvssSum / cvssCount).toFixed(1) : "N/A";

  return [
    `**Findings:** ${findings.length} total`,
    `Severity: Critical ${bySeverity.critical ?? 0} | High ${bySeverity.high ?? 0} | Medium ${bySeverity.medium ?? 0} | Low ${bySeverity.low ?? 0} | Info ${bySeverity.info ?? 0} | Fixed ${bySeverity.fixed ?? 0}`,
    `Average CVSS: ${avgCvss}`,
    "",
    `**By Category:**`,
    catLines || "  No findings yet",
    "",
    `**Actions:** ${actionCountResult[0]?.count ?? 0} total`,
    `**Categories:** ${cats.length}`,
  ].join("\n");
}
