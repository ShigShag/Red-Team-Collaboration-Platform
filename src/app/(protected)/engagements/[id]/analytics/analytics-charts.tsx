"use client";

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { EngagementAnalytics } from "@/lib/analytics/types";

const CHART_COLORS = {
  text: "#8b95a8",
  grid: "#252d3a",
  tooltipBg: "#161b24",
  tooltipBorder: "#252d3a",
  accent: "#e8735a",
  findings: "#ef4444",
  actions: "#e8735a",
  resources: "#3b82f6",
};

interface Props {
  analytics: EngagementAnalytics;
}

export function AnalyticsCharts({ analytics }: Props) {
  const hasCategoryData = analytics.categoryProgress.length > 0;
  const hasOperatorData = analytics.operators.length > 0;
  const hasActivityData = analytics.activityByDay.length > 0;
  const hasFindingsOverTime = analytics.findingsByDay.length > 0;

  return (
    <div className="space-y-6">
      {/* Findings over time */}
      {hasFindingsOverTime && (
        <ChartCard title="Findings Over Time">
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={analytics.findingsByDay}>
              <defs>
                <linearGradient id="findingsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART_COLORS.accent} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={CHART_COLORS.accent} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={CHART_COLORS.grid}
                vertical={false}
              />
              <XAxis
                dataKey="date"
                tick={{ fill: CHART_COLORS.text, fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: CHART_COLORS.grid }}
                tickFormatter={formatShortDate}
              />
              <YAxis
                tick={{ fill: CHART_COLORS.text, fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip content={<DayCountTooltip label="Findings" />} />
              <Area
                type="monotone"
                dataKey="count"
                stroke={CHART_COLORS.accent}
                strokeWidth={2}
                fill="url(#findingsGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {/* Row 2: Category progress */}
      {hasCategoryData && (
        <ChartCard title="Category Progress">
          <ResponsiveContainer
            width="100%"
            height={Math.max(180, analytics.categoryProgress.length * 36)}
          >
            <BarChart
              data={analytics.categoryProgress}
              layout="vertical"
              margin={{ left: 10, right: 20 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={CHART_COLORS.grid}
                horizontal={false}
              />
              <XAxis
                type="number"
                tick={{ fill: CHART_COLORS.text, fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: CHART_COLORS.grid }}
                allowDecimals={false}
              />
              <YAxis
                type="category"
                dataKey="categoryName"
                width={120}
                tick={{ fill: CHART_COLORS.text, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<CategoryTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
              <Legend
                wrapperStyle={{ fontSize: 11, color: CHART_COLORS.text }}
                iconSize={8}
                formatter={(value: string) => (
                  <span className="text-text-secondary text-[11px]">{value}</span>
                )}
              />
              <Bar
                dataKey="findingCount"
                name="Findings"
                stackId="a"
                fill={CHART_COLORS.findings}
                radius={[0, 0, 0, 0]}
              />
              <Bar
                dataKey="actionCount"
                name="Actions"
                stackId="a"
                fill={CHART_COLORS.actions}
              />
              <Bar
                dataKey="resourceCount"
                name="Resources"
                stackId="a"
                fill={CHART_COLORS.resources}
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {/* Row 3: Operator contributions */}
      {hasOperatorData && (
        <ChartCard title="Operator Contributions">
          <ResponsiveContainer
            width="100%"
            height={Math.max(150, analytics.operators.length * 40)}
          >
            <BarChart
              data={analytics.operators.map((o) => ({
                ...o,
                name: o.displayName ?? o.username,
              }))}
              layout="vertical"
              margin={{ left: 10, right: 20 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={CHART_COLORS.grid}
                horizontal={false}
              />
              <XAxis
                type="number"
                tick={{ fill: CHART_COLORS.text, fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: CHART_COLORS.grid }}
                allowDecimals={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={120}
                tick={{ fill: CHART_COLORS.text, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<OperatorTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
              <Legend
                wrapperStyle={{ fontSize: 11, color: CHART_COLORS.text }}
                iconSize={8}
                formatter={(value: string) => (
                  <span className="text-text-secondary text-[11px]">{value}</span>
                )}
              />
              <Bar
                dataKey="findingsCreated"
                name="Findings"
                stackId="a"
                fill={CHART_COLORS.findings}
              />
              <Bar
                dataKey="actionsCreated"
                name="Actions"
                stackId="a"
                fill={CHART_COLORS.actions}
              />
              <Bar
                dataKey="resourcesCreated"
                name="Resources"
                stackId="a"
                fill={CHART_COLORS.resources}
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {/* Row 4: Activity timeline */}
      {hasActivityData && (
        <ChartCard title="Daily Activity">
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={analytics.activityByDay}>
              <defs>
                <linearGradient id="activityGrad" x1="0" y1="0" x2="0" y2="1">
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
                tick={{ fill: CHART_COLORS.text, fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: CHART_COLORS.grid }}
                tickFormatter={formatShortDate}
              />
              <YAxis
                tick={{ fill: CHART_COLORS.text, fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip content={<DayCountTooltip label="Events" />} />
              <Area
                type="monotone"
                dataKey="count"
                stroke="#22c55e"
                strokeWidth={2}
                fill="url(#activityGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      )}
    </div>
  );
}

// --- Shared components ---

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative bg-bg-surface/80 border border-border-default rounded-lg p-5">
      <div className="absolute top-0 left-5 right-5 h-px bg-gradient-to-r from-transparent via-border-default to-transparent" />
      <h3 className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-4">
        {title}
      </h3>
      {children}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-[200px]">
      <p className="text-sm text-text-muted">{message}</p>
    </div>
  );
}

// --- Custom tooltips ---

function TooltipWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-bg-surface border border-border-default rounded-lg px-3 py-2 shadow-lg">
      {children}
    </div>
  );
}

function DayCountTooltip({
  label,
  active,
  payload,
}: {
  label: string;
  active?: boolean;
  payload?: Array<{ payload: { date: string; count: number } }>;
}) {
  if (!active || !payload?.length) return null;
  const { date, count } = payload[0].payload;
  return (
    <TooltipWrapper>
      <p className="text-[10px] text-text-muted">{date}</p>
      <p className="text-xs font-mono text-text-primary">
        {count} {label.toLowerCase()}
      </p>
    </TooltipWrapper>
  );
}

function CategoryTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{
    payload: {
      categoryName: string;
      findingCount: number;
      actionCount: number;
      resourceCount: number;
    };
  }>;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <TooltipWrapper>
      <p className="text-xs text-text-primary font-medium mb-1">{d.categoryName}</p>
      <div className="space-y-0.5 text-[10px]">
        <p>
          <span className="text-text-muted">Findings:</span>{" "}
          <span className="font-mono text-text-primary">{d.findingCount}</span>
        </p>
        <p>
          <span className="text-text-muted">Actions:</span>{" "}
          <span className="font-mono text-text-primary">{d.actionCount}</span>
        </p>
        <p>
          <span className="text-text-muted">Resources:</span>{" "}
          <span className="font-mono text-text-primary">{d.resourceCount}</span>
        </p>
      </div>
    </TooltipWrapper>
  );
}

function OperatorTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{
    payload: {
      name: string;
      findingsCreated: number;
      actionsCreated: number;
      resourcesCreated: number;
    };
  }>;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <TooltipWrapper>
      <p className="text-xs text-text-primary font-medium mb-1">{d.name}</p>
      <div className="space-y-0.5 text-[10px]">
        <p>
          <span className="text-text-muted">Findings:</span>{" "}
          <span className="font-mono text-text-primary">{d.findingsCreated}</span>
        </p>
        <p>
          <span className="text-text-muted">Actions:</span>{" "}
          <span className="font-mono text-text-primary">{d.actionsCreated}</span>
        </p>
        <p>
          <span className="text-text-muted">Resources:</span>{" "}
          <span className="font-mono text-text-primary">{d.resourcesCreated}</span>
        </p>
      </div>
    </TooltipWrapper>
  );
}

// --- Helpers ---

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
