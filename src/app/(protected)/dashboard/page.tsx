import { redirect } from "next/navigation";
import Link from "next/link";
import { eq, desc, sql, inArray } from "drizzle-orm";
import { db } from "@/db";
import { engagements, engagementMembers, engagementActivityLog, engagementCategories, notifications, users } from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { ActivityTimeline } from "../engagements/[id]/activity-timeline";
import { NotificationList } from "./notification-list";
import { getDashboardAnalytics } from "@/lib/analytics/dashboard-analytics";
import { DashboardAnalyticsSection } from "./dashboard-analytics";

const ACTIVITY_PAGE_SIZE = 20;

interface Props {
  searchParams: Promise<{ activityPage?: string }>;
}

export default async function DashboardPage({ searchParams }: Props) {
  const { activityPage: activityPageParam } = await searchParams;
  const session = await getSession();
  if (!session) redirect("/login");

  // Fetch recent engagements
  const recentEngagements = await db
    .select({
      id: engagements.id,
      name: engagements.name,
      role: engagementMembers.role,
      createdAt: engagements.createdAt,
    })
    .from(engagementMembers)
    .innerJoin(engagements, eq(engagementMembers.engagementId, engagements.id))
    .where(eq(engagementMembers.userId, session.userId))
    .orderBy(desc(engagements.createdAt))
    .limit(5);

  // Fetch recent notifications for this user
  const recentNotifications = await db
    .select({
      id: notifications.id,
      type: notifications.type,
      engagementId: notifications.engagementId,
      actorId: notifications.actorId,
      actorUsername: users.username,
      actorDisplayName: users.displayName,
      actorAvatarPath: users.avatarPath,
      metadata: notifications.metadata,
      read: notifications.read,
      createdAt: notifications.createdAt,
    })
    .from(notifications)
    .leftJoin(users, eq(notifications.actorId, users.id))
    .where(eq(notifications.userId, session.userId))
    .orderBy(desc(notifications.createdAt))
    .limit(10);

  // Fetch this user's activity across all engagements with pagination
  const activityPage = Math.max(1, parseInt(activityPageParam ?? "1", 10) || 1);

  const [{ count: activityTotalCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(engagementActivityLog)
    .where(eq(engagementActivityLog.actorId, session.userId));

  const activityTotalPages = Math.max(1, Math.ceil(activityTotalCount / ACTIVITY_PAGE_SIZE));
  const safeActivityPage = Math.min(activityPage, activityTotalPages);
  const activityOffset = (safeActivityPage - 1) * ACTIVITY_PAGE_SIZE;

  const myActivity = await db
    .select({
      id: engagementActivityLog.id,
      eventType: engagementActivityLog.eventType,
      metadata: engagementActivityLog.metadata,
      createdAt: engagementActivityLog.createdAt,
      actorId: engagementActivityLog.actorId,
      actorUsername: users.username,
      actorDisplayName: users.displayName,
      actorAvatarPath: users.avatarPath,
      engagementId: engagementActivityLog.engagementId,
      engagementName: engagements.name,
    })
    .from(engagementActivityLog)
    .innerJoin(users, eq(engagementActivityLog.actorId, users.id))
    .innerJoin(engagements, eq(engagementActivityLog.engagementId, engagements.id))
    .where(eq(engagementActivityLog.actorId, session.userId))
    .orderBy(desc(engagementActivityLog.createdAt))
    .limit(ACTIVITY_PAGE_SIZE)
    .offset(activityOffset);

  // Fetch category IDs across engagements referenced in activity for link resolution
  const activityEngagementIds = [...new Set(myActivity.map((e) => e.engagementId))];
  let allCategoryIds: string[] = [];
  if (activityEngagementIds.length > 0) {
    const cats = await db
      .select({ id: engagementCategories.id })
      .from(engagementCategories)
      .where(inArray(engagementCategories.engagementId, activityEngagementIds));
    allCategoryIds = cats.map((c) => c.id);
  }

  // Fetch dashboard analytics
  const dashboardAnalytics = await getDashboardAnalytics(session.userId);

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* Welcome header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <div className="h-px w-8 bg-accent/50" />
          <span className="text-[10px] font-medium text-accent tracking-[0.2em] uppercase">
            Dashboard
          </span>
        </div>
        <h1 className="text-2xl font-semibold text-text-primary tracking-tight">
          Welcome back, {session.displayName ?? session.username}
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          Operator console ready
        </p>
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Account status */}
        <div className="relative bg-bg-surface/80 border border-border-default rounded-lg p-5">
          <div className="absolute top-0 left-5 right-5 h-px bg-gradient-to-r from-transparent via-border-default to-transparent" />
          <h2 className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-4">
            Account Status
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-muted">Username</span>
              <span className="text-sm font-mono text-text-primary">
                {session.username}
              </span>
            </div>
            {session.displayName && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-muted">Display Name</span>
                <span className="text-sm font-medium text-text-primary">
                  {session.displayName}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-muted">2FA Status</span>
              {session.totpEnabled ? (
                <span className="flex items-center gap-1.5 text-sm text-accent font-medium">
                  <div className="w-1.5 h-1.5 rounded-full bg-accent" />
                  Enabled
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-sm text-warning font-medium">
                  <div className="w-1.5 h-1.5 rounded-full bg-warning" />
                  Disabled
                </span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-muted">Session</span>
              <span className="text-sm text-accent font-medium">Active</span>
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="relative bg-bg-surface/80 border border-border-default rounded-lg p-5">
          <div className="absolute top-0 left-5 right-5 h-px bg-gradient-to-r from-transparent via-border-default to-transparent" />
          <h2 className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-4">
            Quick Actions
          </h2>
          <div className="space-y-2">
            {!session.totpEnabled && (
              <Link
                href="/setup-2fa"
                className="flex items-center gap-3 px-3 py-2.5 rounded bg-warning/5 border border-warning/20 hover:bg-warning/10 active:scale-[0.98] transition-all duration-100 group"
              >
                <svg
                  className="w-4 h-4 text-warning"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v3.75m0-10.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
                  />
                </svg>
                <div>
                  <span className="text-sm text-text-primary group-hover:text-warning transition-colors duration-150">
                    Enable Two-Factor Authentication
                  </span>
                  <p className="text-[10px] text-text-muted mt-0.5">
                    Strongly recommended for operational security
                  </p>
                </div>
              </Link>
            )}

            <Link
              href="/engagements"
              className="flex items-center gap-3 px-3 py-2.5 rounded border border-border-default hover:bg-bg-elevated active:scale-[0.98] transition-all duration-100 group"
            >
              <svg
                className="w-4 h-4 text-text-muted group-hover:text-text-primary transition-colors duration-100"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z"
                />
              </svg>
              <span className="text-sm text-text-primary group-hover:text-text-secondary transition-colors duration-100">
                View Engagements
              </span>
            </Link>

            <Link
              href="/settings"
              className="flex items-center gap-3 px-3 py-2.5 rounded border border-border-default hover:bg-bg-elevated active:scale-[0.98] transition-all duration-100 group"
            >
              <svg
                className="w-4 h-4 text-text-muted group-hover:text-text-primary transition-colors duration-100"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <span className="text-sm text-text-primary group-hover:text-text-secondary transition-colors duration-100">
                Account Settings
              </span>
            </Link>
          </div>
        </div>
      </div>

      {/* Analytics overview */}
      <div>
        <h2 className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-4">
          Analytics Overview
        </h2>
        <DashboardAnalyticsSection analytics={dashboardAnalytics} />
      </div>

      {/* Notifications */}
      <NotificationList
        notifications={recentNotifications.map((n) => ({
          ...n,
          metadata: n.metadata as Record<string, string | null>,
          createdAt: typeof n.createdAt === "string" ? n.createdAt : n.createdAt.toISOString(),
        }))}
      />

      {/* Recent engagements */}
      <div className="relative bg-bg-surface/80 border border-border-default rounded-lg p-5">
        <div className="absolute top-0 left-5 right-5 h-px bg-gradient-to-r from-transparent via-border-default to-transparent" />
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-medium text-text-secondary uppercase tracking-wider">
            Recent Engagements
          </h2>
          <Link
            href="/engagements"
            className="text-[10px] font-medium text-accent hover:text-accent-bright transition-colors duration-100"
          >
            View All
          </Link>
        </div>

        {recentEngagements.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-sm text-text-muted mb-2">
              No engagements yet
            </p>
            <Link
              href="/engagements"
              className="inline-flex items-center gap-1.5 text-xs text-accent hover:text-accent-bright transition-colors duration-100"
            >
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
                  d="M12 4.5v15m7.5-7.5h-15"
                />
              </svg>
              Create your first engagement
            </Link>
          </div>
        ) : (
          <div className="space-y-1">
            {recentEngagements.map((engagement) => (
              <Link
                key={engagement.id}
                href={`/engagements/${engagement.id}`}
                className="flex items-center justify-between px-3 py-2.5 rounded hover:bg-bg-elevated/50 active:scale-[0.99] transition-all duration-100 group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-accent/50 shrink-0" />
                  <span className="text-sm text-text-primary group-hover:text-accent truncate transition-colors duration-100">
                    {engagement.name}
                  </span>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-3">
                  <RoleBadge role={engagement.role} />
                  <span className="text-[10px] text-text-muted">
                    {new Date(engagement.createdAt).toLocaleDateString(
                      "en-US",
                      { month: "short", day: "numeric" }
                    )}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Your recent activity */}
      <ActivityTimeline
        title="Your Activity"
        emptyMessage="Your actions across engagements will appear here"
        events={myActivity.map((e) => ({
          ...e,
          metadata: e.metadata as Record<string, string | null>,
        }))}
        page={safeActivityPage}
        totalPages={activityTotalPages}
        totalCount={activityTotalCount}
        baseUrl="/dashboard"
        categoryIds={allCategoryIds}
      />
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, string> = {
    owner: "text-accent",
    write: "text-green-500",
    read: "text-text-muted",
  };

  return (
    <span
      className={`text-[9px] font-mono font-medium uppercase tracking-wider ${styles[role] ?? styles.read}`}
    >
      {role}
    </span>
  );
}
