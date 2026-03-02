import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { engagements, engagementMembers } from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { BackLink } from "../back-link";
import { getEngagementAnalytics } from "@/lib/analytics/engagement-analytics";
import { getSeverityColor } from "@/lib/severity-colors";
import { AnalyticsCharts } from "./analytics-charts";

interface Props {
  params: Promise<{ id: string }>;
}

const roleColors: Record<string, string> = {
  owner: "text-accent",
  write: "text-green-500",
  read: "text-text-muted",
};

export default async function EngagementAnalyticsPage({ params }: Props) {
  const { id: engagementId } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  const [engagement] = await db
    .select({ id: engagements.id, name: engagements.name, status: engagements.status })
    .from(engagements)
    .where(eq(engagements.id, engagementId))
    .limit(1);

  if (!engagement) notFound();

  const [member] = await db
    .select({ role: engagementMembers.role })
    .from(engagementMembers)
    .where(
      and(
        eq(engagementMembers.engagementId, engagementId),
        eq(engagementMembers.userId, session.userId)
      )
    )
    .limit(1);

  if (!member) notFound();

  const analytics = await getEngagementAnalytics(engagementId);

  const criticalAndHigh =
    (analytics.severity.find((s) => s.severity === "critical")?.count ?? 0) +
    (analytics.severity.find((s) => s.severity === "high")?.count ?? 0);

  return (
    <div className="animate-fade-in-up">
      <div className="flex items-center justify-between mb-6">
        <BackLink
          href={`/engagements/${engagementId}`}
          label={`Back to ${engagement.name}`}
        />
      </div>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <div className="h-px w-8 bg-accent/50" />
          <span className="text-[10px] font-medium text-accent tracking-[0.2em] uppercase">
            Analytics
          </span>
        </div>
        <h1 className="text-2xl font-semibold text-text-primary tracking-tight">
          Engagement Metrics
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          {engagement.name}
        </p>
      </div>

      {/* Two-column layout */}
      <div className="flex gap-8">
        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Summary stat cards — top row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard
              label="Findings"
              value={analytics.totalFindings}
              detail={
                criticalAndHigh > 0
                  ? `${criticalAndHigh} critical/high`
                  : undefined
              }
              detailColor={criticalAndHigh > 0 ? "#ef4444" : undefined}
            />
            <StatCard
              label="Actions"
              value={analytics.totalActions}
            />
            <StatCard
              label="Resources"
              value={analytics.totalResources}
            />
            <StatCard
              label="Activity Events"
              value={analytics.totalActivityEvents}
            />
          </div>

          {/* CVSS + Category summary row */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            {/* CVSS card */}
            <div className="relative bg-bg-surface/80 border border-border-default rounded-lg p-4">
              <div className="absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-border-default to-transparent" />
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-medium text-text-muted uppercase tracking-wider">
                  CVSS Scores
                </p>
                <Link
                  href={`/engagements/${engagementId}/reports`}
                  className="text-[9px] text-accent hover:text-accent-bright transition-colors"
                >
                  View Reports
                </Link>
              </div>
              {analytics.cvssCount > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-baseline gap-3">
                    <span className="text-2xl font-semibold font-mono text-text-primary">
                      {analytics.avgCvss?.toFixed(1)}
                    </span>
                    <span className="text-[10px] text-text-muted">avg</span>
                    {analytics.highestCvss !== null && (
                      <>
                        <span className="text-lg font-semibold font-mono text-danger">
                          {analytics.highestCvss.toFixed(1)}
                        </span>
                        <span className="text-[10px] text-text-muted">highest</span>
                      </>
                    )}
                  </div>
                  <p className="text-[10px] text-text-muted">
                    {analytics.cvssCount} of {analytics.totalFindings} findings scored
                  </p>
                </div>
              ) : (
                <p className="text-sm text-text-muted">No CVSS scores assigned</p>
              )}
            </div>

            {/* Category coverage card */}
            <div className="relative bg-bg-surface/80 border border-border-default rounded-lg p-4">
              <div className="absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-border-default to-transparent" />
              <p className="text-[10px] font-medium text-text-muted uppercase tracking-wider mb-3">
                Category Coverage
              </p>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-2xl font-semibold font-mono text-text-primary">
                  {analytics.categoriesWithActivity}
                </span>
                <span className="text-[10px] text-text-muted">
                  of {analytics.categoriesTotal} active
                </span>
              </div>
              {/* Mini progress bar */}
              <div className="w-full h-1.5 bg-bg-primary rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent rounded-full transition-all"
                  style={{
                    width: `${analytics.categoriesTotal > 0 ? (analytics.categoriesWithActivity / analytics.categoriesTotal) * 100 : 0}%`,
                  }}
                />
              </div>
              <p className="text-[10px] text-text-muted mt-1.5">
                {analytics.categoriesTotal > 0
                  ? `${Math.round((analytics.categoriesWithActivity / analytics.categoriesTotal) * 100)}% coverage`
                  : "No categories"}
              </p>
            </div>
          </div>

          {/* Severity breakdown inline */}
          {analytics.totalFindings > 0 && (
            <div className="relative bg-bg-surface/80 border border-border-default rounded-lg p-4 mb-6">
              <div className="absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-border-default to-transparent" />
              <p className="text-[10px] font-medium text-text-muted uppercase tracking-wider mb-3">
                Severity Breakdown
              </p>
              {/* Horizontal stacked bar */}
              <div className="flex h-3 rounded-full overflow-hidden mb-3">
                {analytics.severity
                  .filter((s) => s.count > 0)
                  .map((s) => (
                    <div
                      key={s.severity}
                      className="h-full transition-all"
                      style={{
                        width: `${(s.count / analytics.totalFindings) * 100}%`,
                        backgroundColor: getSeverityColor(s.severity),
                      }}
                      title={`${s.severity}: ${s.count}`}
                    />
                  ))}
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-1">
                {analytics.severity
                  .filter((s) => s.count > 0)
                  .map((s) => (
                    <div key={s.severity} className="flex items-center gap-1.5">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: getSeverityColor(s.severity) }}
                      />
                      <span className="text-[11px] text-text-secondary capitalize">
                        {s.severity}
                      </span>
                      <span className="text-[11px] font-mono text-text-primary">
                        {s.count}
                      </span>
                      <span className="text-[10px] text-text-muted">
                        ({Math.round((s.count / analytics.totalFindings) * 100)}%)
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Charts */}
          <AnalyticsCharts analytics={analytics} />
        </div>

        {/* Sidebar */}
        <div className="w-56 shrink-0 space-y-5 sticky top-4 self-start">
          {/* Quick links */}
          <div className="relative bg-bg-surface/80 border border-border-default rounded-lg p-4">
            <div className="absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-border-default to-transparent" />
            <p className="text-[10px] font-medium text-text-muted uppercase tracking-wider mb-3">
              Quick Links
            </p>
            <div className="space-y-1">
              <SidebarLink
                href={`/engagements/${engagementId}/mitre`}
                label="MITRE ATT&CK Matrix"
                icon={
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                  </svg>
                }
              />
              <SidebarLink
                href={`/engagements/${engagementId}/scope`}
                label="Scope & RoE"
                icon={
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 3.75H6A2.25 2.25 0 003.75 6v1.5M16.5 3.75H18A2.25 2.25 0 0120.25 6v1.5M20.25 16.5V18A2.25 2.25 0 0118 20.25h-1.5M3.75 16.5V18A2.25 2.25 0 006 20.25h1.5M12 9v6m3-3H9" />
                  </svg>
                }
              />
              <SidebarLink
                href={`/engagements/${engagementId}/reports`}
                label="Reports"
                icon={
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                }
              />
              <SidebarLink
                href={`/engagements/${engagementId}/audit`}
                label="Audit Log"
                icon={
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
                  </svg>
                }
              />
            </div>
          </div>

          {/* Team members */}
          <div className="relative bg-bg-surface/80 border border-border-default rounded-lg p-4">
            <div className="absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-border-default to-transparent" />
            <p className="text-[10px] font-medium text-text-muted uppercase tracking-wider mb-3">
              Team
              <span className="text-text-muted ml-1.5">{analytics.members.length}</span>
            </p>
            <div className="space-y-0.5">
              {analytics.members.map((m) => {
                const displayName = m.displayName || m.username;
                const initial = displayName[0].toUpperCase();
                const isCurrentUser = m.userId === session.userId;
                const contrib = analytics.operators.find((o) => o.userId === m.userId);
                const totalContrib = contrib
                  ? contrib.findingsCreated + contrib.actionsCreated + contrib.resourcesCreated
                  : 0;

                return (
                  <div
                    key={m.userId}
                    className="flex items-center gap-2 px-1.5 py-1.5 rounded hover:bg-bg-elevated/50 transition-colors duration-100"
                  >
                    {m.avatarPath ? (
                      <img
                        src={`/api/avatar/${m.userId}`}
                        alt=""
                        className="w-6 h-6 rounded-full object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-[9px] font-medium text-accent">
                          {initial}
                        </span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="text-[11px] text-text-primary truncate">
                          {displayName}
                        </span>
                        {isCurrentUser && (
                          <span className="text-[7px] font-mono text-text-muted">(you)</span>
                        )}
                      </div>
                      {totalContrib > 0 && (
                        <p className="text-[9px] text-text-muted font-mono">
                          {contrib!.findingsCreated}f {contrib!.actionsCreated}a {contrib!.resourcesCreated}r
                        </p>
                      )}
                    </div>
                    <span
                      className={`text-[7px] font-mono font-medium uppercase tracking-wider ${roleColors[m.role] ?? roleColors.read}`}
                    >
                      {m.role}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Engagement summary */}
          <div className="relative bg-bg-surface/80 border border-border-default rounded-lg p-4">
            <div className="absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-border-default to-transparent" />
            <p className="text-[10px] font-medium text-text-muted uppercase tracking-wider mb-3">
              Summary
            </p>
            <div className="space-y-2">
              <SummaryRow label="Status" value={analytics.status} />
              <SummaryRow label="Categories" value={analytics.categoriesTotal} />
              <SummaryRow label="Findings" value={analytics.totalFindings} />
              <SummaryRow label="Actions" value={analytics.totalActions} />
              <SummaryRow label="Resources" value={analytics.totalResources} />
              <SummaryRow label="Events" value={analytics.totalActivityEvents} />
              {analytics.avgCvss !== null && (
                <SummaryRow label="Avg CVSS" value={analytics.avgCvss.toFixed(1)} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  detail,
  detailColor,
}: {
  label: string;
  value: string | number;
  detail?: string;
  detailColor?: string;
}) {
  return (
    <div className="relative bg-bg-surface/80 border border-border-default rounded-lg p-4">
      <div className="absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-border-default to-transparent" />
      <p className="text-[10px] font-medium text-text-muted uppercase tracking-wider mb-1">
        {label}
      </p>
      <p className="text-xl font-semibold font-mono text-text-primary">{value}</p>
      {detail && (
        <p
          className="text-[10px] font-mono mt-0.5"
          style={{ color: detailColor ?? "#8b95a8" }}
        >
          {detail}
        </p>
      )}
    </div>
  );
}

function SidebarLink({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 px-2 py-1.5 rounded text-text-muted hover:text-text-primary hover:bg-bg-elevated/50 transition-all duration-100 group"
    >
      <span className="text-text-muted group-hover:text-accent transition-colors duration-100">
        {icon}
      </span>
      <span className="text-[11px]">{label}</span>
    </Link>
  );
}

function SummaryRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] text-text-muted">{label}</span>
      <span className="text-[11px] font-mono text-text-primary capitalize">{value}</span>
    </div>
  );
}
