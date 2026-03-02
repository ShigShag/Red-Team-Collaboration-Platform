import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { BackLink } from "./back-link";
import { eq, and, inArray, notInArray, sql, desc, asc } from "drizzle-orm";
import { db } from "@/db";
import {
  users,
  engagements,
  engagementMembers,
  engagementCategories,
  categoryAssignments,
  categoryPresets,
  resources,
  categoryActions,
  categoryFindings,
  engagementActivityLog,
  scopeTargets,
  scopeExclusions,
  scopeConstraints,
  contacts,
  scopeDocuments,
  coordinatorExclusions,
} from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { MemberSidebar } from "./member-sidebar";
import { ScopeOverview } from "./scope-overview";
import { CategoryGrid } from "./categories/category-grid";
import { ActivityTimeline } from "./activity-timeline";
import { MitreMatrixButton } from "./mitre-matrix-button";
import { ExportButton } from "./export-button";
import { DuplicateButton } from "./duplicate-button";
import { ViewSwitcher } from "./view-switcher";
import { EngagementTimeline } from "./timeline/engagement-timeline";
import {
  isContentLocked,
  STATUS_META,
  type EngagementStatus,
} from "@/lib/engagement-status";
import { getEffectiveAccess } from "@/lib/engagement-access";

const ACTIVITY_PAGE_SIZE = 20;
const TIMELINE_EVENT_LIMIT = 5000;

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ activityPage?: string; warning?: string; view?: string }>;
}

export default async function EngagementDetailPage({ params, searchParams }: Props) {
  const { id: engagementId } = await params;
  const { activityPage: activityPageParam, warning, view } = await searchParams;
  const isTimelineView = view === "timeline";
  const session = await getSession();
  if (!session) redirect("/login");

  // Fetch engagement
  const [engagement] = await db
    .select()
    .from(engagements)
    .where(eq(engagements.id, engagementId))
    .limit(1);

  if (!engagement) notFound();

  // Verify membership (explicit or virtual coordinator)
  const access = await getEffectiveAccess(engagementId, session.userId, session.isCoordinator);
  if (!access) notFound();

  const currentMember = { role: access.role };
  const isVirtualCoordinator = access.isVirtualCoordinator ?? false;
  const isOwner = access.role === "owner";
  const status = (engagement.status ?? "scoping") as EngagementStatus;
  const statusMeta = STATUS_META[status];
  const readOnly = isContentLocked(status, isOwner) || isVirtualCoordinator;

  // Fetch all members
  const members = await db
    .select({
      userId: engagementMembers.userId,
      role: engagementMembers.role,
      username: users.username,
      displayName: users.displayName,
      avatarPath: users.avatarPath,
    })
    .from(engagementMembers)
    .innerJoin(users, eq(engagementMembers.userId, users.id))
    .where(eq(engagementMembers.engagementId, engagementId))
    .orderBy(engagementMembers.createdAt);

  // Fetch virtual coordinators (coordinator users not explicitly in this engagement, not excluded)
  let virtualCoordinators: Array<{
    userId: string;
    username: string;
    displayName: string | null;
    avatarPath: string | null;
  }> = [];

  if (!engagement.excludeCoordinators) {
    const explicitMemberIds = members.map((m) => m.userId);

    const excludedUserIds = db
      .select({ userId: coordinatorExclusions.userId })
      .from(coordinatorExclusions)
      .where(eq(coordinatorExclusions.engagementId, engagementId));

    virtualCoordinators = await db
      .select({
        userId: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarPath: users.avatarPath,
      })
      .from(users)
      .where(
        and(
          eq(users.isCoordinator, true),
          notInArray(users.id, excludedUserIds),
          ...(explicitMemberIds.length > 0
            ? [notInArray(users.id, explicitMemberIds)]
            : [])
        )
      );
  }

  // Fetch all categories for this engagement (join preset for icon)
  const allCategories = await db
    .select({
      id: engagementCategories.id,
      parentId: engagementCategories.parentId,
      name: engagementCategories.name,
      typeName: categoryPresets.name,
      icon: categoryPresets.icon,
      color: engagementCategories.color,
      description: engagementCategories.description,
      locked: engagementCategories.locked,
      createdAt: engagementCategories.createdAt,
    })
    .from(engagementCategories)
    .innerJoin(categoryPresets, eq(engagementCategories.presetId, categoryPresets.id))
    .where(eq(engagementCategories.engagementId, engagementId))
    .orderBy(engagementCategories.createdAt);

  // Fetch assignments for all categories
  const categoryIds = allCategories.map((c) => c.id);
  let assignments: Array<{
    categoryId: string;
    userId: string;
    username: string;
    displayName: string | null;
    avatarPath: string | null;
  }> = [];

  // Fetch resource and action counts per category
  let resourceCounts: Array<{ categoryId: string; count: number }> = [];
  let actionCounts: Array<{ categoryId: string; count: number }> = [];
  let findingCounts: Array<{ categoryId: string; count: number }> = [];

  if (categoryIds.length > 0) {
    [assignments, resourceCounts, actionCounts, findingCounts] = await Promise.all([
      db
        .select({
          categoryId: categoryAssignments.categoryId,
          userId: categoryAssignments.userId,
          username: users.username,
          displayName: users.displayName,
          avatarPath: users.avatarPath,
        })
        .from(categoryAssignments)
        .innerJoin(users, eq(categoryAssignments.userId, users.id))
        .where(inArray(categoryAssignments.categoryId, categoryIds)),
      db
        .select({
          categoryId: resources.categoryId,
          count: sql<number>`count(*)::int`,
        })
        .from(resources)
        .where(inArray(resources.categoryId, categoryIds))
        .groupBy(resources.categoryId),
      db
        .select({
          categoryId: categoryActions.categoryId,
          count: sql<number>`count(*)::int`,
        })
        .from(categoryActions)
        .where(inArray(categoryActions.categoryId, categoryIds))
        .groupBy(categoryActions.categoryId),
      db
        .select({
          categoryId: categoryFindings.categoryId,
          count: sql<number>`count(*)::int`,
        })
        .from(categoryFindings)
        .where(inArray(categoryFindings.categoryId, categoryIds))
        .groupBy(categoryFindings.categoryId),
    ]);
  }

  // Fetch activity — paginated for overview, full for timeline
  let recentActivity: Array<{
    id: string;
    eventType: string;
    metadata: unknown;
    createdAt: Date;
    actorId: string;
    actorUsername: string;
    actorDisplayName: string | null;
    actorAvatarPath: string | null;
  }> = [];
  let activityTotalCount = 0;
  let activityTotalPages = 1;
  let safeActivityPage = 1;

  if (isTimelineView) {
    // Timeline: fetch all events chronologically (capped)
    recentActivity = await db
      .select({
        id: engagementActivityLog.id,
        eventType: engagementActivityLog.eventType,
        metadata: engagementActivityLog.metadata,
        createdAt: engagementActivityLog.createdAt,
        actorId: engagementActivityLog.actorId,
        actorUsername: users.username,
        actorDisplayName: users.displayName,
        actorAvatarPath: users.avatarPath,
      })
      .from(engagementActivityLog)
      .innerJoin(users, eq(engagementActivityLog.actorId, users.id))
      .where(eq(engagementActivityLog.engagementId, engagementId))
      .orderBy(asc(engagementActivityLog.createdAt))
      .limit(TIMELINE_EVENT_LIMIT);
    activityTotalCount = recentActivity.length;
  } else {
    // Overview: paginated, newest first
    const activityPage = Math.max(1, parseInt(activityPageParam ?? "1", 10) || 1);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(engagementActivityLog)
      .where(eq(engagementActivityLog.engagementId, engagementId));

    activityTotalCount = count;
    activityTotalPages = Math.max(1, Math.ceil(activityTotalCount / ACTIVITY_PAGE_SIZE));
    safeActivityPage = Math.min(activityPage, activityTotalPages);
    const activityOffset = (safeActivityPage - 1) * ACTIVITY_PAGE_SIZE;

    recentActivity = await db
      .select({
        id: engagementActivityLog.id,
        eventType: engagementActivityLog.eventType,
        metadata: engagementActivityLog.metadata,
        createdAt: engagementActivityLog.createdAt,
        actorId: engagementActivityLog.actorId,
        actorUsername: users.username,
        actorDisplayName: users.displayName,
        actorAvatarPath: users.avatarPath,
      })
      .from(engagementActivityLog)
      .innerJoin(users, eq(engagementActivityLog.actorId, users.id))
      .where(eq(engagementActivityLog.engagementId, engagementId))
      .orderBy(desc(engagementActivityLog.createdAt))
      .limit(ACTIVITY_PAGE_SIZE)
      .offset(activityOffset);
  }

  // Fetch scope data for sidebar overview
  const [scopeTargetList, scopeExclusionCount, scopeConstraintCount, scopeContactCount, scopeDocumentCount] =
    await Promise.all([
      db
        .select({ type: scopeTargets.type, value: scopeTargets.value })
        .from(scopeTargets)
        .where(eq(scopeTargets.engagementId, engagementId))
        .orderBy(scopeTargets.type, scopeTargets.value),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(scopeExclusions)
        .where(eq(scopeExclusions.engagementId, engagementId))
        .then((r) => r[0]?.count ?? 0),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(scopeConstraints)
        .where(eq(scopeConstraints.engagementId, engagementId))
        .then((r) => r[0]?.count ?? 0),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(contacts)
        .where(eq(contacts.engagementId, engagementId))
        .then((r) => r[0]?.count ?? 0),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(scopeDocuments)
        .where(eq(scopeDocuments.engagementId, engagementId))
        .then((r) => r[0]?.count ?? 0),
    ]);

  // Build lookup maps
  const resourceCountMap = new Map(resourceCounts.map((r) => [r.categoryId, r.count]));
  const actionCountMap = new Map(actionCounts.map((a) => [a.categoryId, a.count]));
  const findingCountMap = new Map(findingCounts.map((f) => [f.categoryId, f.count]));

  // Build category objects with assignments and counts
  interface CategoryData {
    id: string;
    parentId: string | null;
    name: string;
    typeName: string;
    icon: string;
    color: string | null;
    description: string | null;
    locked: boolean;
    createdAt: string;
    resourceCount: number;
    actionCount: number;
    findingCount: number;
    assignments: { userId: string; username: string; displayName: string | null; avatarUrl: string | null }[];
    children: CategoryData[];
  }

  function buildCategoryData(c: (typeof allCategories)[number]): CategoryData {
    return {
      id: c.id,
      parentId: c.parentId,
      name: c.name,
      typeName: c.typeName,
      icon: c.icon,
      color: c.color,
      description: c.description,
      locked: c.locked,
      createdAt: c.createdAt.toISOString(),
      resourceCount: resourceCountMap.get(c.id) || 0,
      actionCount: actionCountMap.get(c.id) || 0,
      findingCount: findingCountMap.get(c.id) || 0,
      assignments: assignments
        .filter((a) => a.categoryId === c.id)
        .map((a) => ({
          userId: a.userId,
          username: a.username,
          displayName: a.displayName,
          avatarUrl: a.avatarPath ? `/api/avatar/${a.userId}` : null,
        })),
      children: [],
    };
  }

  // Build tree: top-level categories with nested children
  const categoryDataMap = new Map(
    allCategories.map((c) => [c.id, buildCategoryData(c)])
  );

  const topLevelCategories: CategoryData[] = [];
  for (const cat of categoryDataMap.values()) {
    if (cat.parentId && categoryDataMap.has(cat.parentId)) {
      categoryDataMap.get(cat.parentId)!.children.push(cat);
    } else if (!cat.parentId) {
      topLevelCategories.push(cat);
    }
  }

  return (
    <div className="animate-fade-in-up">
      {warning === "file_copy_failed" && (
        <div className="mb-4 px-4 py-3 text-sm bg-warning/10 border border-warning/30 rounded text-warning">
          Some files could not be copied during duplication. Affected attachments and screenshots may be unavailable.
        </div>
      )}
      {/* Top bar: back link + settings */}
      <div className="flex items-center justify-between mb-6">
        <BackLink href="/engagements" label="Back to Engagements" />

        <div className="flex items-center gap-2">
          <MitreMatrixButton engagementId={engagementId} />
          <Link
            href={`/engagements/${engagementId}/scope`}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-text-muted hover:text-text-primary border border-border-default hover:border-accent/30 rounded transition-all duration-100 hover:bg-bg-elevated/50"
            title="Scope & Rules of Engagement"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M7.5 3.75H6A2.25 2.25 0 003.75 6v1.5M16.5 3.75H18A2.25 2.25 0 0120.25 6v1.5M20.25 16.5V18A2.25 2.25 0 0118 20.25h-1.5M3.75 16.5V18A2.25 2.25 0 006 20.25h1.5M12 9v6m3-3H9"
              />
            </svg>
            Scope
          </Link>
          <Link
            href={`/engagements/${engagementId}/credentials`}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-text-muted hover:text-text-primary border border-border-default hover:border-accent/30 rounded transition-all duration-100 hover:bg-bg-elevated/50"
            title="Credentials"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z"
              />
            </svg>
            Credentials
          </Link>
          <Link
            href={`/engagements/${engagementId}/ips`}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-text-muted hover:text-text-primary border border-border-default hover:border-accent/30 rounded transition-all duration-100 hover:bg-bg-elevated/50"
            title="Manage IP geolocations"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418"
              />
            </svg>
            IPs
          </Link>
          <Link
            href={`/engagements/${engagementId}/reports`}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-text-muted hover:text-text-primary border border-border-default hover:border-accent/30 rounded transition-all duration-100 hover:bg-bg-elevated/50"
            title="Generate reports"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
              />
            </svg>
            Reports
          </Link>
          <Link
            href={`/engagements/${engagementId}/analytics`}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-text-muted hover:text-text-primary border border-border-default hover:border-accent/30 rounded transition-all duration-100 hover:bg-bg-elevated/50"
            title="Analytics & Metrics"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
              />
            </svg>
            Analytics
          </Link>
          <Link
            href={`/engagements/${engagementId}/audit`}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-text-muted hover:text-text-primary border border-border-default hover:border-accent/30 rounded transition-all duration-100 hover:bg-bg-elevated/50"
            title="Audit log"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z"
              />
            </svg>
            Audit Log
          </Link>
          <ExportButton
            engagementId={engagementId}
            categories={allCategories
              .filter((c) => !c.parentId)
              .map((c) => ({
                id: c.id,
                name: c.name,
                icon: c.icon,
                color: c.color,
              }))}
          />
          <DuplicateButton
            engagementId={engagementId}
            engagementName={engagement.name}
            categories={allCategories
              .filter((c) => !c.parentId)
              .map((c) => ({
                id: c.id,
                name: c.name,
                icon: c.icon,
                color: c.color,
              }))}
            members={members.map((m) => ({
              userId: m.userId,
              username: m.username,
              displayName: m.displayName,
              role: m.role,
            }))}
          />
          {isOwner && (
            <Link
              href={`/engagements/${engagementId}/settings`}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-text-muted hover:text-text-primary border border-border-default hover:border-accent/30 rounded transition-all duration-100 hover:bg-bg-elevated/50"
              title="Engagement settings"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              Settings
            </Link>
          )}
        </div>
      </div>

      {/* Two-column layout */}
      <div className="flex gap-8">
        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-px w-8 bg-accent/50" />
              <span className="text-[10px] font-medium text-accent tracking-[0.2em] uppercase">
                Engagement
              </span>
            </div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold text-text-primary tracking-tight">
                {engagement.name}
              </h1>
              <span
                className={`inline-flex items-center px-2 py-0.5 text-[10px] font-mono font-medium uppercase tracking-wider rounded border ${statusMeta.color} ${statusMeta.bgColor} ${statusMeta.borderColor}`}
              >
                {statusMeta.label}
              </span>
            </div>
            {engagement.description && (
              <p className="text-sm text-text-secondary mt-1">
                {engagement.description}
              </p>
            )}
            <div className="flex items-center flex-wrap gap-x-4 gap-y-1 mt-2">
              <p className="text-xs text-text-muted">
                Created{" "}
                {new Date(engagement.createdAt).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
              {(engagement.startDate || engagement.endDate) && (
                <span className="flex items-center gap-1 text-xs text-text-muted">
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
                    />
                  </svg>
                  {engagement.startDate ? formatDateShort(engagement.startDate) : "?"}
                  {" – "}
                  {engagement.endDate ? formatDateShort(engagement.endDate) : "?"}
                </span>
              )}
              {(() => {
                const status = getTimeStatus(engagement.startDate, engagement.endDate);
                if (!status) return null;
                return (
                  <span className={`inline-flex items-center gap-1 text-xs font-medium ${status.color}`}>
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    {status.label}
                  </span>
                );
              })()}
            </div>
          </div>

          {/* Lock banner */}
          {readOnly && (
            <div className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border mb-6 ${isVirtualCoordinator ? "bg-purple-500/5 border-purple-500/20" : `${statusMeta.bgColor} ${statusMeta.borderColor}`}`}>
              <svg
                className={`w-4 h-4 flex-shrink-0 ${isVirtualCoordinator ? "text-purple-400" : statusMeta.color}`}
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                />
              </svg>
              <span className={`text-xs ${isVirtualCoordinator ? "text-purple-400" : statusMeta.color}`}>
                {isVirtualCoordinator
                  ? "You are viewing this engagement as a coordinator. Content is read-only."
                  : status === "reporting"
                    ? "This engagement is in reporting mode. Content is read-only."
                    : status === "archived"
                      ? "This engagement is archived. All content is read-only."
                      : "This engagement is closed. All content is read-only."}
              </span>
            </div>
          )}

          {/* View Switcher */}
          <ViewSwitcher />

          {isTimelineView ? (
            /* Timeline View */
            <EngagementTimeline
              data={{
                events: recentActivity.map((e) => ({
                  id: e.id,
                  eventType: e.eventType,
                  metadata: e.metadata as Record<string, string | null>,
                  createdAt: e.createdAt.toISOString(),
                  actorId: e.actorId,
                  actorUsername: e.actorUsername,
                  actorDisplayName: e.actorDisplayName,
                  actorAvatarPath: e.actorAvatarPath,
                })),
                engagement: {
                  id: engagementId,
                  name: engagement.name,
                  status: status,
                  createdAt: engagement.createdAt.toISOString(),
                  startDate: engagement.startDate,
                  endDate: engagement.endDate,
                },
                categories: allCategories
                  .filter((c) => !c.parentId)
                  .map((c) => ({
                    id: c.id,
                    name: c.name,
                    icon: c.icon,
                    color: c.color,
                  })),
              }}
            />
          ) : (
            <>
              {/* Categories */}
              <CategoryGrid
                categories={topLevelCategories}
                engagementId={engagementId}
                currentUserId={session.userId}
                currentUserRole={currentMember.role}
                members={members.map((m) => ({
                  userId: m.userId,
                  username: m.username,
                  displayName: m.displayName,
                  avatarUrl: m.avatarPath
                    ? `/api/avatar/${m.userId}`
                    : null,
                }))}
                readOnly={readOnly}
              />

              {/* Activity Timeline */}
              <div className="mt-10">
                <ActivityTimeline
                  events={recentActivity.map((e) => ({
                    ...e,
                    metadata: e.metadata as Record<string, string | null>,
                  }))}
                  page={safeActivityPage}
                  totalPages={activityTotalPages}
                  totalCount={activityTotalCount}
                  baseUrl={`/engagements/${engagementId}`}
                  engagementId={engagementId}
                  categoryIds={categoryIds}
                />
              </div>
            </>
          )}
        </div>

        {/* Right sidebar - members */}
        <div className="w-56 flex-shrink-0 hidden lg:block">
          <div className="sticky top-6">
            <div className="bg-bg-surface/80 border border-border-default rounded-lg p-4">
              <MemberSidebar
                members={members.map((m) => ({
                  userId: m.userId,
                  username: m.username,
                  displayName: m.displayName,
                  avatarUrl: m.avatarPath
                    ? `/api/avatar/${m.userId}`
                    : null,
                  role: m.role,
                }))}
                coordinators={virtualCoordinators.map((c) => ({
                  userId: c.userId,
                  username: c.username,
                  displayName: c.displayName,
                  avatarUrl: c.avatarPath
                    ? `/api/avatar/${c.userId}`
                    : null,
                  role: "coordinator",
                }))}
                currentUserId={session.userId}
              />
            </div>
            <div className="bg-bg-surface/80 border border-border-default rounded-lg p-4 mt-3">
              <ScopeOverview
                engagementId={engagementId}
                targets={scopeTargetList}
                exclusionCount={scopeExclusionCount}
                constraintCount={scopeConstraintCount}
                contactCount={scopeContactCount}
                documentCount={scopeDocumentCount}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function getTimeStatus(startDate: string | null, endDate: string | null): { label: string; color: string } | null {
  const now = new Date();

  if (startDate) {
    const start = new Date(startDate + "T00:00:00");
    if (start.getTime() > now.getTime()) {
      const days = Math.ceil((start.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (days <= 1) return { label: "Starts tomorrow", color: "text-blue-400" };
      return { label: `Starts in ${days}d`, color: "text-blue-400" };
    }
  }

  if (!endDate) return null;
  const end = new Date(endDate + "T23:59:59");
  const diffMs = end.getTime() - now.getTime();

  if (diffMs < 0) return { label: "Ended", color: "text-text-muted" };

  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (days <= 3) return { label: `${days}d left`, color: "text-red-400" };
  if (days <= 7) return { label: `${days}d left`, color: "text-amber-400" };
  return { label: `${days}d left`, color: "text-green-400" };
}
