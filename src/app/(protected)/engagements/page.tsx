import { redirect } from "next/navigation";
import Link from "next/link";
import { eq, desc, sql, and, notInArray } from "drizzle-orm";
import { db } from "@/db";
import { engagements, engagementMembers, coordinatorExclusions } from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { CreateEngagementForm } from "./create-engagement-form";
import { ImportButton } from "./import-button";
import { EngagementsViewSwitcher } from "./engagements-view-switcher";
import { EngagementsTimeline } from "./engagements-timeline";
import {
  STATUS_META,
  type EngagementStatus,
} from "@/lib/engagement-status";

interface Props {
  searchParams: Promise<{ archived?: string; view?: string }>;
}

export default async function EngagementsPage({ searchParams }: Props) {
  const { archived: archivedParam, view } = await searchParams;
  const showArchived = archivedParam === "true";
  const isTimelineView = view === "timeline";
  const session = await getSession();
  if (!session) redirect("/login");

  const baseQuery = db
    .select({
      id: engagements.id,
      name: engagements.name,
      description: engagements.description,
      startDate: engagements.startDate,
      endDate: engagements.endDate,
      status: engagements.status,
      role: engagementMembers.role,
      createdAt: engagements.createdAt,
      memberCount: sql<number>`(
        select count(*)::int from engagement_members
        where engagement_members.engagement_id = ${engagements.id}
      )`,
    })
    .from(engagementMembers)
    .innerJoin(engagements, eq(engagementMembers.engagementId, engagements.id))
    .where(eq(engagementMembers.userId, session.userId))
    .orderBy(desc(engagements.createdAt));

  const allExplicit = await baseQuery;

  type EngagementRow = {
    id: string;
    name: string;
    description: string | null;
    startDate: string | null;
    endDate: string | null;
    status: string;
    role: string;
    createdAt: Date;
    memberCount: number;
    isVirtualCoordinator?: boolean;
  };

  // If coordinator, also fetch coordinator-visible engagements
  let allEngagements: EngagementRow[] = allExplicit;

  if (session.isCoordinator) {
    const explicitIds = allExplicit.map((e) => e.id);

    const userExclusions = db
      .select({ engagementId: coordinatorExclusions.engagementId })
      .from(coordinatorExclusions)
      .where(eq(coordinatorExclusions.userId, session.userId));

    const coordinatorVisible = await db
      .select({
        id: engagements.id,
        name: engagements.name,
        description: engagements.description,
        startDate: engagements.startDate,
        endDate: engagements.endDate,
        status: engagements.status,
        createdAt: engagements.createdAt,
        memberCount: sql<number>`(
          select count(*)::int from engagement_members
          where engagement_members.engagement_id = ${engagements.id}
        )`,
      })
      .from(engagements)
      .where(
        and(
          eq(engagements.excludeCoordinators, false),
          notInArray(engagements.id, userExclusions),
          ...(explicitIds.length > 0
            ? [notInArray(engagements.id, explicitIds)]
            : [])
        )
      )
      .orderBy(desc(engagements.createdAt));

    allEngagements = [
      ...allExplicit,
      ...coordinatorVisible.map((e) => ({
        ...e,
        role: "coordinator" as const,
        isVirtualCoordinator: true,
      })),
    ];

    // Re-sort by createdAt descending
    allEngagements.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  const archivedCount = allEngagements.filter((e) => e.status === "archived").length;
  const myEngagements = showArchived
    ? allEngagements
    : allEngagements.filter((e) => e.status !== "archived");

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="h-px w-8 bg-accent/50" />
            <span className="text-[10px] font-medium text-accent tracking-[0.2em] uppercase">
              Engagements
            </span>
          </div>
          <h1 className="text-2xl font-semibold text-text-primary tracking-tight">
            Your Engagements
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Red team operations, pentests, and assessments
          </p>
        </div>
        <div className="flex items-center gap-3">
          <EngagementsViewSwitcher />
          {archivedCount > 0 && (
            <Link
              href={showArchived ? "/engagements" : "/engagements?archived=true"}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-text-muted hover:text-text-primary border border-border-default hover:border-accent/30 rounded transition-all duration-100 hover:bg-bg-elevated/50"
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
                  d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"
                />
              </svg>
              {showArchived ? "Hide archived" : `Archived (${archivedCount})`}
            </Link>
          )}
          <ImportButton />
          <CreateEngagementForm />
        </div>
      </div>

      {/* Engagement content */}
      {myEngagements.length === 0 ? (
        <div className="border border-border-subtle rounded-lg p-12 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-accent/5 border border-accent/10 mb-4">
            <svg
              className="w-5 h-5 text-accent/60"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <p className="text-sm text-text-muted mb-1">No engagements yet</p>
          <p className="text-xs text-text-muted">
            Create your first engagement to get started
          </p>
        </div>
      ) : isTimelineView ? (
        <EngagementsTimeline
          engagements={myEngagements.map((e) => ({
            id: e.id,
            name: e.name,
            description: e.description,
            startDate: e.startDate,
            endDate: e.endDate,
            status: e.status,
            role: e.role,
            createdAt: e.createdAt.toISOString(),
            memberCount: e.memberCount,
            isVirtualCoordinator: e.isVirtualCoordinator,
          }))}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {myEngagements.map((engagement) => (
            <Link
              key={engagement.id}
              href={`/engagements/${engagement.id}`}
              className="group relative bg-bg-surface/80 border border-border-default rounded-lg p-5 hover:border-accent/30 hover:bg-bg-elevated/50 active:scale-[0.99] transition-all duration-150"
            >
              <div className="absolute top-0 left-5 right-5 h-px bg-gradient-to-r from-transparent via-border-default to-transparent" />

              <div className="flex items-start justify-between mb-3">
                <h3 className="text-sm font-semibold text-text-primary group-hover:text-accent transition-colors duration-150 line-clamp-1">
                  {engagement.name}
                </h3>
                <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                  <StatusBadge status={engagement.status as EngagementStatus} />
                  <RoleBadge role={engagement.role} />
                </div>
              </div>

              {engagement.description && (
                <p className="text-xs text-text-muted line-clamp-2 mb-3">
                  {engagement.description}
                </p>
              )}

              <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-[10px] text-text-muted">
                <span className="flex items-center gap-1">
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15.75 6.75a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0"
                    />
                  </svg>
                  {engagement.memberCount}{" "}
                  {engagement.memberCount === 1 ? "member" : "members"}
                </span>
                {(engagement.startDate || engagement.endDate) && (
                  <span className="flex items-center gap-1">
                    <svg
                      className="w-3 h-3"
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
                    {engagement.startDate
                      ? formatDateShort(engagement.startDate)
                      : "?"}
                    {" – "}
                    {engagement.endDate
                      ? formatDateShort(engagement.endDate)
                      : "?"}
                  </span>
                )}
                {(() => {
                  const remaining = getTimeStatus(engagement.startDate, engagement.endDate);
                  if (!remaining) return null;
                  return (
                    <span className={`flex items-center gap-1 font-medium ${remaining.color}`}>
                      <svg
                        className="w-3 h-3"
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
                      {remaining.label}
                    </span>
                  );
                })()}
                <span>
                  {new Date(engagement.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
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

function StatusBadge({ status }: { status: EngagementStatus }) {
  const meta = STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 text-[9px] font-mono font-medium uppercase tracking-wider rounded border ${meta.color} ${meta.bgColor} ${meta.borderColor}`}
    >
      {meta.label}
    </span>
  );
}

function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, string> = {
    owner: "text-accent bg-accent/5 border-accent/20",
    write: "text-green-500 bg-green-500/5 border-green-500/20",
    read: "text-text-muted bg-bg-elevated border-border-default",
    coordinator: "text-purple-400 bg-purple-500/5 border-purple-500/20",
  };

  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 text-[9px] font-mono font-medium uppercase tracking-wider rounded border ${styles[role] ?? styles.read}`}
    >
      {role}
    </span>
  );
}
