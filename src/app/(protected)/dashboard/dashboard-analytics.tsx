"use client";

import {
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { DashboardAnalytics } from "@/lib/analytics/types";
import { getSeverityColor } from "@/lib/severity-colors";

const CHART_COLORS = {
  text: "#8b95a8",
  grid: "#252d3a",
  accent: "#e8735a",
};

interface Props {
  analytics: DashboardAnalytics;
}

export function DashboardAnalyticsSection({ analytics }: Props) {
  const hasSeverityData = analytics.severityAcrossAll.some((s) => s.count > 0);
  const hasActivityData = analytics.recentActivity.length > 0;

  return (
    <div className="space-y-4">
      {/* Stat cards row */}
      <div className="grid grid-cols-3 gap-4">
        <MiniStatCard label="Total Findings" value={analytics.totalFindings} />
        <MiniStatCard label="Active Engagements" value={analytics.activeEngagements} />
        <MiniStatCard
          label="My Contributions"
          value={
            analytics.myContributions.findingsCreated +
            analytics.myContributions.actionsCreated +
            analytics.myContributions.resourcesCreated
          }
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Mini severity donut */}
        <div className="relative bg-bg-surface/80 border border-border-default rounded-lg p-4">
          <div className="absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-border-default to-transparent" />
          <h3 className="text-[10px] font-medium text-text-muted uppercase tracking-wider mb-3">
            Finding Severity
          </h3>
          {hasSeverityData ? (
            <div className="flex items-center gap-3">
              <ResponsiveContainer width={120} height={120}>
                <PieChart>
                  <Pie
                    data={analytics.severityAcrossAll.filter((s) => s.count > 0)}
                    cx="50%"
                    cy="50%"
                    innerRadius={30}
                    outerRadius={50}
                    dataKey="count"
                    nameKey="severity"
                    stroke="none"
                  >
                    {analytics.severityAcrossAll
                      .filter((s) => s.count > 0)
                      .map((entry) => (
                        <Cell
                          key={entry.severity}
                          fill={getSeverityColor(entry.severity)}
                        />
                      ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 flex-1">
                {analytics.severityAcrossAll
                  .filter((s) => s.count > 0)
                  .map((s) => (
                    <div key={s.severity} className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <div
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: getSeverityColor(s.severity) }}
                        />
                        <span className="text-[10px] text-text-secondary capitalize">
                          {s.severity}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-text-primary">
                        {s.count}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-[120px]">
              <p className="text-xs text-text-muted">No findings yet</p>
            </div>
          )}
        </div>

        {/* Activity sparkline */}
        <div className="relative bg-bg-surface/80 border border-border-default rounded-lg p-4">
          <div className="absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-border-default to-transparent" />
          <h3 className="text-[10px] font-medium text-text-muted uppercase tracking-wider mb-3">
            Activity (14 Days)
          </h3>
          {hasActivityData ? (
            <ResponsiveContainer width="100%" height={120}>
              <AreaChart data={analytics.recentActivity}>
                <defs>
                  <linearGradient id="dashActivityGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22c55e" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={CHART_COLORS.grid}
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  tick={{ fill: CHART_COLORS.text, fontSize: 9 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(d: string) => {
                    const dt = new Date(d + "T00:00:00");
                    return dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                  }}
                />
                <YAxis hide allowDecimals={false} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload as { date: string; count: number };
                    return (
                      <div className="bg-bg-surface border border-border-default rounded-lg px-3 py-2 shadow-lg">
                        <p className="text-[10px] text-text-muted">{d.date}</p>
                        <p className="text-xs font-mono text-text-primary">
                          {d.count} events
                        </p>
                      </div>
                    );
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="#22c55e"
                  strokeWidth={2}
                  fill="url(#dashActivityGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[120px]">
              <p className="text-xs text-text-muted">No recent activity</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MiniStatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="relative bg-bg-surface/80 border border-border-default rounded-lg p-3">
      <div className="absolute top-0 left-3 right-3 h-px bg-gradient-to-r from-transparent via-border-default to-transparent" />
      <p className="text-[9px] font-medium text-text-muted uppercase tracking-wider mb-0.5">
        {label}
      </p>
      <p className="text-lg font-semibold font-mono text-text-primary">{value}</p>
    </div>
  );
}
