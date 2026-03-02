import { eq, sql, and, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  engagements,
  engagementMembers,
  engagementCategories,
  categoryFindings,
  categoryActions,
  resources,
  categoryAssignments,
  engagementActivityLog,
  users,
} from "@/db/schema";
import type {
  EngagementAnalytics,
  SeverityDistribution,
  CategoryProgress,
  OperatorContribution,
  TeamMember,
  DayCount,
} from "./types";

const SEVERITIES = ["critical", "high", "medium", "low", "info", "fixed"] as const;

export async function getEngagementAnalytics(
  engagementId: string
): Promise<EngagementAnalytics> {
  // Fetch engagement info
  const [engagement] = await db
    .select({
      name: engagements.name,
      status: engagements.status,
    })
    .from(engagements)
    .where(eq(engagements.id, engagementId))
    .limit(1);

  if (!engagement) throw new Error("Engagement not found");

  // Get all category IDs for this engagement
  const categories = await db
    .select({
      id: engagementCategories.id,
      name: engagementCategories.name,
      color: engagementCategories.color,
    })
    .from(engagementCategories)
    .where(eq(engagementCategories.engagementId, engagementId));

  const categoryIds = categories.map((c) => c.id);

  if (categoryIds.length === 0) {
    // No categories = empty analytics
    const earlyMembers = await db
      .select({
        userId: engagementMembers.userId,
        username: users.username,
        displayName: users.displayName,
        avatarPath: users.avatarPath,
        role: engagementMembers.role,
      })
      .from(engagementMembers)
      .innerJoin(users, eq(engagementMembers.userId, users.id))
      .where(eq(engagementMembers.engagementId, engagementId));

    return {
      engagementId,
      engagementName: engagement.name,
      status: engagement.status,
      totalFindings: 0,
      totalActions: 0,
      totalResources: 0,
      avgCvss: null,
      cvssCount: 0,
      highestCvss: null,
      severity: SEVERITIES.map((s) => ({ severity: s, count: 0 })),
      categoryProgress: [],
      categoriesTotal: 0,
      categoriesWithActivity: 0,
      operators: [],
      members: earlyMembers,
      activityByDay: [],
      findingsByDay: [],
      totalActivityEvents: 0,
    };
  }

  // Parallel fetch all aggregate data
  const [
    severityRows,
    cvssRow,
    findingCountsByCat,
    actionCountsByCat,
    resourceCountsByCat,
    findingsByCreator,
    actionsByCreator,
    resourcesByCreator,
    memberRows,
    activityByDayRows,
    findingsByDayRows,
  ] = await Promise.all([
    // Severity distribution
    db
      .select({
        severity: categoryFindings.severity,
        count: sql<number>`count(*)::int`,
      })
      .from(categoryFindings)
      .where(inArray(categoryFindings.categoryId, categoryIds))
      .groupBy(categoryFindings.severity),

    // CVSS stats (avg, count, max)
    db
      .select({
        avg: sql<string | null>`round(avg(${categoryFindings.cvssScore})::numeric, 1)::text`,
        total: sql<number>`count(*)::int`,
        max: sql<string | null>`max(${categoryFindings.cvssScore})::text`,
      })
      .from(categoryFindings)
      .where(
        and(
          inArray(categoryFindings.categoryId, categoryIds),
          sql`${categoryFindings.cvssScore} IS NOT NULL`
        )
      ),

    // Findings per category
    db
      .select({
        categoryId: categoryFindings.categoryId,
        count: sql<number>`count(*)::int`,
      })
      .from(categoryFindings)
      .where(inArray(categoryFindings.categoryId, categoryIds))
      .groupBy(categoryFindings.categoryId),

    // Actions per category
    db
      .select({
        categoryId: categoryActions.categoryId,
        count: sql<number>`count(*)::int`,
      })
      .from(categoryActions)
      .where(inArray(categoryActions.categoryId, categoryIds))
      .groupBy(categoryActions.categoryId),

    // Resources per category
    db
      .select({
        categoryId: resources.categoryId,
        count: sql<number>`count(*)::int`,
      })
      .from(resources)
      .where(inArray(resources.categoryId, categoryIds))
      .groupBy(resources.categoryId),

    // Findings per creator
    db
      .select({
        userId: categoryFindings.createdBy,
        count: sql<number>`count(*)::int`,
      })
      .from(categoryFindings)
      .where(inArray(categoryFindings.categoryId, categoryIds))
      .groupBy(categoryFindings.createdBy),

    // Actions per creator
    db
      .select({
        userId: categoryActions.createdBy,
        count: sql<number>`count(*)::int`,
      })
      .from(categoryActions)
      .where(inArray(categoryActions.categoryId, categoryIds))
      .groupBy(categoryActions.createdBy),

    // Resources per creator
    db
      .select({
        userId: resources.createdBy,
        count: sql<number>`count(*)::int`,
      })
      .from(resources)
      .where(inArray(resources.categoryId, categoryIds))
      .groupBy(resources.createdBy),

    // Members with user info + role + avatar
    db
      .select({
        userId: engagementMembers.userId,
        username: users.username,
        displayName: users.displayName,
        avatarPath: users.avatarPath,
        role: engagementMembers.role,
      })
      .from(engagementMembers)
      .innerJoin(users, eq(engagementMembers.userId, users.id))
      .where(eq(engagementMembers.engagementId, engagementId)),

    // Activity by day
    db
      .select({
        date: sql<string>`date(${engagementActivityLog.createdAt})::text`,
        count: sql<number>`count(*)::int`,
      })
      .from(engagementActivityLog)
      .where(eq(engagementActivityLog.engagementId, engagementId))
      .groupBy(sql`date(${engagementActivityLog.createdAt})`)
      .orderBy(sql`date(${engagementActivityLog.createdAt})`),

    // Findings by day
    db
      .select({
        date: sql<string>`date(${categoryFindings.createdAt})::text`,
        count: sql<number>`count(*)::int`,
      })
      .from(categoryFindings)
      .where(inArray(categoryFindings.categoryId, categoryIds))
      .groupBy(sql`date(${categoryFindings.createdAt})`)
      .orderBy(sql`date(${categoryFindings.createdAt})`),
  ]);

  // Build severity distribution (ensure all 5 severities present)
  const sevMap = new Map(severityRows.map((r) => [r.severity, r.count]));
  const severity: SeverityDistribution[] = SEVERITIES.map((s) => ({
    severity: s,
    count: sevMap.get(s) ?? 0,
  }));

  const totalFindings = severity.reduce((sum, s) => sum + s.count, 0);
  const avgCvss = cvssRow[0]?.avg ? parseFloat(cvssRow[0].avg) : null;
  const cvssCount = cvssRow[0]?.total ?? 0;
  const highestCvss = cvssRow[0]?.max ? parseFloat(cvssRow[0].max) : null;

  // Build category progress
  const findingMap = new Map(findingCountsByCat.map((r) => [r.categoryId, r.count]));
  const actionMap = new Map(actionCountsByCat.map((r) => [r.categoryId, r.count]));
  const resourceMap = new Map(resourceCountsByCat.map((r) => [r.categoryId, r.count]));

  const categoryProgress: CategoryProgress[] = categories.map((cat) => ({
    categoryId: cat.id,
    categoryName: cat.name,
    color: cat.color,
    findingCount: findingMap.get(cat.id) ?? 0,
    actionCount: actionMap.get(cat.id) ?? 0,
    resourceCount: resourceMap.get(cat.id) ?? 0,
  }));

  const categoriesWithActivity = categoryProgress.filter(
    (c) => c.findingCount > 0 || c.actionCount > 0 || c.resourceCount > 0
  ).length;

  // Build operator contributions
  const findingCreatorMap = new Map(findingsByCreator.map((r) => [r.userId, r.count]));
  const actionCreatorMap = new Map(actionsByCreator.map((r) => [r.userId, r.count]));
  const resourceCreatorMap = new Map(resourcesByCreator.map((r) => [r.userId, r.count]));

  const operators: OperatorContribution[] = memberRows
    .map((m) => ({
      userId: m.userId,
      username: m.username,
      displayName: m.displayName,
      findingsCreated: findingCreatorMap.get(m.userId) ?? 0,
      actionsCreated: actionCreatorMap.get(m.userId) ?? 0,
      resourcesCreated: resourceCreatorMap.get(m.userId) ?? 0,
    }))
    .filter((o) => o.findingsCreated > 0 || o.actionsCreated > 0 || o.resourcesCreated > 0)
    .sort(
      (a, b) =>
        b.findingsCreated + b.actionsCreated + b.resourcesCreated -
        (a.findingsCreated + a.actionsCreated + a.resourcesCreated)
    );

  const totalActions = actionCountsByCat.reduce((sum, r) => sum + r.count, 0);
  const totalResources = resourceCountsByCat.reduce((sum, r) => sum + r.count, 0);
  const totalActivityEvents = activityByDayRows.reduce((sum, r) => sum + r.count, 0);

  return {
    engagementId,
    engagementName: engagement.name,
    status: engagement.status,
    totalFindings,
    totalActions,
    totalResources,
    avgCvss,
    cvssCount,
    highestCvss,
    severity,
    categoryProgress,
    categoriesTotal: categories.length,
    categoriesWithActivity,
    operators,
    members: memberRows as TeamMember[],
    activityByDay: activityByDayRows as DayCount[],
    findingsByDay: findingsByDayRows as DayCount[],
    totalActivityEvents,
  };
}
