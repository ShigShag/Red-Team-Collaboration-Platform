import { and, eq, sql, inArray, gte } from "drizzle-orm";
import { db } from "@/db";
import {
  engagements,
  engagementMembers,
  engagementCategories,
  categoryFindings,
  categoryActions,
  resources,
  engagementActivityLog,
} from "@/db/schema";
import type { DashboardAnalytics, SeverityDistribution, DayCount } from "./types";

const SEVERITIES = ["critical", "high", "medium", "low", "info", "fixed"] as const;

export async function getDashboardAnalytics(
  userId: string
): Promise<DashboardAnalytics> {
  // Get all engagements the user is a member of
  const userEngagements = await db
    .select({
      engagementId: engagementMembers.engagementId,
      name: engagements.name,
      status: engagements.status,
    })
    .from(engagementMembers)
    .innerJoin(engagements, eq(engagementMembers.engagementId, engagements.id))
    .where(eq(engagementMembers.userId, userId));

  const engagementIds = userEngagements.map((e) => e.engagementId);

  if (engagementIds.length === 0) {
    return {
      totalEngagements: 0,
      activeEngagements: 0,
      totalFindings: 0,
      severityAcrossAll: SEVERITIES.map((s) => ({ severity: s, count: 0 })),
      findingsPerEngagement: [],
      recentActivity: [],
      myContributions: {
        findingsCreated: 0,
        actionsCreated: 0,
        resourcesCreated: 0,
      },
    };
  }

  const activeEngagements = userEngagements.filter(
    (e) => e.status === "active" || e.status === "scoping" || e.status === "reporting"
  ).length;

  // Get all category IDs across user's engagements
  const allCategories = await db
    .select({
      id: engagementCategories.id,
      engagementId: engagementCategories.engagementId,
    })
    .from(engagementCategories)
    .where(inArray(engagementCategories.engagementId, engagementIds));

  const allCategoryIds = allCategories.map((c) => c.id);

  if (allCategoryIds.length === 0) {
    return {
      totalEngagements: engagementIds.length,
      activeEngagements,
      totalFindings: 0,
      severityAcrossAll: SEVERITIES.map((s) => ({ severity: s, count: 0 })),
      findingsPerEngagement: userEngagements.map((e) => ({
        name: e.name,
        count: 0,
        status: e.status,
      })),
      recentActivity: [],
      myContributions: {
        findingsCreated: 0,
        actionsCreated: 0,
        resourcesCreated: 0,
      },
    };
  }

  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  const [
    severityRows,
    findingsPerEngRows,
    recentActivityRows,
    myFindings,
    myActions,
    myResources,
  ] = await Promise.all([
    // Severity distribution across all engagements
    db
      .select({
        severity: categoryFindings.severity,
        count: sql<number>`count(*)::int`,
      })
      .from(categoryFindings)
      .where(inArray(categoryFindings.categoryId, allCategoryIds))
      .groupBy(categoryFindings.severity),

    // Findings per engagement
    db
      .select({
        engagementId: engagementCategories.engagementId,
        count: sql<number>`count(${categoryFindings.id})::int`,
      })
      .from(engagementCategories)
      .leftJoin(
        categoryFindings,
        eq(categoryFindings.categoryId, engagementCategories.id)
      )
      .where(inArray(engagementCategories.engagementId, engagementIds))
      .groupBy(engagementCategories.engagementId),

    // Recent activity (14 days) across all engagements
    db
      .select({
        date: sql<string>`date(${engagementActivityLog.createdAt})::text`,
        count: sql<number>`count(*)::int`,
      })
      .from(engagementActivityLog)
      .where(
        and(
          inArray(engagementActivityLog.engagementId, engagementIds),
          gte(engagementActivityLog.createdAt, fourteenDaysAgo)
        )
      )
      .groupBy(sql`date(${engagementActivityLog.createdAt})`)
      .orderBy(sql`date(${engagementActivityLog.createdAt})`),

    // My findings created
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(categoryFindings)
      .where(
        and(
          eq(categoryFindings.createdBy, userId),
          inArray(categoryFindings.categoryId, allCategoryIds)
        )
      ),

    // My actions created
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(categoryActions)
      .where(
        and(
          eq(categoryActions.createdBy, userId),
          inArray(categoryActions.categoryId, allCategoryIds)
        )
      ),

    // My resources created
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(resources)
      .where(
        and(
          eq(resources.createdBy, userId),
          inArray(resources.categoryId, allCategoryIds)
        )
      ),
  ]);

  // Build severity distribution
  const sevMap = new Map(severityRows.map((r) => [r.severity, r.count]));
  const severityAcrossAll: SeverityDistribution[] = SEVERITIES.map((s) => ({
    severity: s,
    count: sevMap.get(s) ?? 0,
  }));

  const totalFindings = severityAcrossAll.reduce((sum, s) => sum + s.count, 0);

  // Build findings per engagement
  const engagementMap = new Map(userEngagements.map((e) => [e.engagementId, e]));
  const findingsCountMap = new Map(
    findingsPerEngRows.map((r) => [r.engagementId, r.count])
  );

  const findingsPerEngagement = userEngagements
    .map((e) => ({
      name: e.name,
      count: findingsCountMap.get(e.engagementId) ?? 0,
      status: e.status,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    totalEngagements: engagementIds.length,
    activeEngagements,
    totalFindings,
    severityAcrossAll,
    findingsPerEngagement,
    recentActivity: recentActivityRows as DayCount[],
    myContributions: {
      findingsCreated: myFindings[0]?.count ?? 0,
      actionsCreated: myActions[0]?.count ?? 0,
      resourcesCreated: myResources[0]?.count ?? 0,
    },
  };
}
