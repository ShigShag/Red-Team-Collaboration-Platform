"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  STATUS_META,
  type EngagementStatus,
} from "@/lib/engagement-status";

// ── Types ───────────────────────────────────────────────────────────

export interface EngagementTimelineRow {
  id: string;
  name: string;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  status: string;
  role: string;
  createdAt: string; // ISO string
  memberCount: number;
  isVirtualCoordinator?: boolean;
}

// ── Constants ───────────────────────────────────────────────────────

const LEFT_PADDING = 220;
const RIGHT_PADDING = 24;
const ROW_HEIGHT = 44;
const BAR_HEIGHT = 24;
const HEADER_HEIGHT = 48;
const MIN_CONTENT_WIDTH = 400;
const DAY_MS = 86_400_000;

const STATUS_COLORS: Record<string, string> = {
  scoping: "#60a5fa",
  active: "#4ade80",
  reporting: "#fbbf24",
  closed: "#fb7185",
  archived: "#c084fc",
};

const ROLE_COLORS: Record<string, string> = {
  owner: "#e8735a",
  write: "#22c55e",
  read: "#8b95a8",
  coordinator: "#a78bfa",
};

// ── Tick mark generation ────────────────────────────────────────────

interface TickMark {
  x: number;
  label: string;
  isMajor: boolean;
}

function timeToX(
  timestamp: number,
  rangeStart: number,
  rangeEnd: number,
  width: number
): number {
  if (rangeEnd <= rangeStart) return 0;
  const ratio = (timestamp - rangeStart) / (rangeEnd - rangeStart);
  return Math.round(ratio * width * 100) / 100;
}

function generateTickMarks(
  rangeStart: number,
  rangeEnd: number,
  width: number
): TickMark[] {
  const span = rangeEnd - rangeStart;
  if (span <= 0 || width <= 0) return [];

  const MIN_TICK_SPACING = 70;
  const maxTicks = Math.floor(width / MIN_TICK_SPACING);

  const intervals = [
    { ms: DAY_MS * 7, format: "week" as const },
    { ms: DAY_MS * 30, format: "month" as const },
    { ms: DAY_MS * 90, format: "quarter" as const },
  ];

  let interval = intervals[0];
  for (const iv of intervals) {
    if (span / iv.ms <= maxTicks) {
      interval = iv;
      break;
    }
  }
  if (span / interval.ms > maxTicks) {
    interval = { ms: DAY_MS * 180, format: "quarter" as const };
  }

  const ticks: TickMark[] = [];
  const startDate = new Date(rangeStart);

  let cursor: Date;
  if (interval.format === "week") {
    cursor = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    const day = cursor.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    cursor.setDate(cursor.getDate() + diff);
  } else {
    cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  }

  while (cursor.getTime() <= rangeEnd) {
    const t = cursor.getTime();
    if (t >= rangeStart) {
      const x = timeToX(t, rangeStart, rangeEnd, width);
      const isMajor =
        interval.format === "week"
          ? cursor.getDate() <= 7
          : cursor.getMonth() % 3 === 0;

      let label: string;
      if (interval.format === "week") {
        label = cursor.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      } else {
        label = cursor.toLocaleDateString("en-US", {
          month: "short",
          year: cursor.getMonth() === 0 ? "numeric" : undefined,
        });
      }

      ticks.push({ x, label, isMajor });
    }

    if (interval.format === "week") {
      cursor.setDate(cursor.getDate() + 7);
    } else if (interval.format === "month") {
      cursor.setMonth(cursor.getMonth() + 1);
    } else {
      cursor.setMonth(cursor.getMonth() + 3);
    }
  }

  return ticks;
}

// ── Component ───────────────────────────────────────────────────────

interface Props {
  engagements: EngagementTimelineRow[];
}

export function EngagementsTimeline({ engagements }: Props) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(900);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [tooltipData, setTooltipData] = useState<{
    engagement: EngagementTimelineRow;
    x: number;
    y: number;
  } | null>(null);

  // ResizeObserver
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const contentWidth = Math.max(
    MIN_CONTENT_WIDTH,
    containerWidth - LEFT_PADDING - RIGHT_PADDING
  );
  const svgWidth = LEFT_PADDING + contentWidth + RIGHT_PADDING;

  // Compute global time range from all engagements
  const timeRange = useMemo(() => {
    const now = Date.now();
    let start = now;
    let end = now;

    for (const eng of engagements) {
      const created = new Date(eng.createdAt).getTime();
      if (eng.startDate) {
        const s = new Date(eng.startDate + "T00:00:00").getTime();
        if (s < start) start = s;
      } else if (created < start) {
        start = created;
      }
      if (eng.endDate) {
        const e = new Date(eng.endDate + "T23:59:59").getTime();
        if (e > end) end = e;
      }
    }

    // Always include "now"
    if (now > end) end = now;
    if (now < start) start = now;

    // Pad
    const span = Math.max(end - start, DAY_MS * 7);
    const pad = span * 0.03;
    return { start: start - pad, end: end + pad };
  }, [engagements]);

  const ticks = useMemo(
    () => generateTickMarks(timeRange.start, timeRange.end, contentWidth),
    [timeRange.start, timeRange.end, contentWidth]
  );

  const now = Date.now();
  const nowX = timeToX(now, timeRange.start, timeRange.end, contentWidth);

  const svgHeight = HEADER_HEIGHT + engagements.length * ROW_HEIGHT + 8;

  // Sort engagements by start date for the timeline
  const sorted = useMemo(() => {
    return [...engagements].sort((a, b) => {
      const aStart = a.startDate
        ? new Date(a.startDate + "T00:00:00").getTime()
        : new Date(a.createdAt).getTime();
      const bStart = b.startDate
        ? new Date(b.startDate + "T00:00:00").getTime()
        : new Date(b.createdAt).getTime();
      return aStart - bStart;
    });
  }, [engagements]);

  return (
    <div
      ref={containerRef}
      className="relative overflow-x-auto rounded-lg border border-border-default bg-bg-surface/50"
      style={{ minWidth: 600 }}
    >
      <svg
        width={svgWidth}
        height={svgHeight}
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="block"
      >
        {/* ── Header tick marks ────────────────────────────── */}
        {ticks.map((tick, i) => (
          <g key={i}>
            {/* Vertical gridline */}
            <line
              x1={LEFT_PADDING + tick.x}
              y1={HEADER_HEIGHT}
              x2={LEFT_PADDING + tick.x}
              y2={svgHeight}
              stroke="var(--color-border-default)"
              strokeWidth={1}
              strokeOpacity={tick.isMajor ? 0.15 : 0.08}
            />
            {/* Tick mark */}
            <line
              x1={LEFT_PADDING + tick.x}
              y1={HEADER_HEIGHT - 8}
              x2={LEFT_PADDING + tick.x}
              y2={HEADER_HEIGHT}
              stroke={tick.isMajor ? "var(--color-text-muted)" : "var(--color-border-default)"}
              strokeWidth={1}
              strokeOpacity={tick.isMajor ? 0.5 : 0.3}
            />
            {/* Label */}
            <text
              x={LEFT_PADDING + tick.x}
              y={HEADER_HEIGHT - 14}
              textAnchor="middle"
              fill="var(--color-text-muted)"
              fontSize={9}
              fontFamily="var(--font-mono), monospace"
              opacity={tick.isMajor ? 0.7 : 0.4}
              className="select-none"
            >
              {tick.label}
            </text>
          </g>
        ))}

        {/* Header baseline */}
        <line
          x1={LEFT_PADDING}
          y1={HEADER_HEIGHT}
          x2={LEFT_PADDING + contentWidth}
          y2={HEADER_HEIGHT}
          stroke="var(--color-border-default)"
          strokeWidth={1}
          strokeOpacity={0.4}
        />

        {/* ── "Now" marker ────────────────────────────────── */}
        <line
          x1={LEFT_PADDING + nowX}
          y1={0}
          x2={LEFT_PADDING + nowX}
          y2={svgHeight}
          stroke="#e8735a"
          strokeWidth={1}
          strokeDasharray="3 2"
          strokeOpacity={0.6}
        />
        <text
          x={LEFT_PADDING + nowX}
          y={10}
          textAnchor="middle"
          fill="#e8735a"
          fontSize={8}
          fontWeight={600}
          fontFamily="var(--font-mono), monospace"
          className="select-none"
        >
          NOW
        </text>

        {/* ── Engagement rows ─────────────────────────────── */}
        {sorted.map((eng, i) => {
          const y = HEADER_HEIGHT + i * ROW_HEIGHT;
          const centerY = y + ROW_HEIGHT / 2;
          const statusColor = STATUS_COLORS[eng.status] ?? "#8b95a8";
          const roleColor = ROLE_COLORS[eng.role] ?? "#8b95a8";
          const isHovered = hoveredId === eng.id;

          // Bar bounds
          const barStart = eng.startDate
            ? new Date(eng.startDate + "T00:00:00").getTime()
            : new Date(eng.createdAt).getTime();
          const barEnd = eng.endDate
            ? new Date(eng.endDate + "T23:59:59").getTime()
            : now;
          const x1 = timeToX(barStart, timeRange.start, timeRange.end, contentWidth);
          const x2 = timeToX(barEnd, timeRange.start, timeRange.end, contentWidth);
          const barWidth = Math.max(x2 - x1, 6);

          // If no endDate, show as open-ended (dashed right edge)
          const isOpenEnded = !eng.endDate;

          const statusMeta = STATUS_META[eng.status as EngagementStatus];

          return (
            <g
              key={eng.id}
              className="cursor-pointer"
              onMouseEnter={(e) => {
                setHoveredId(eng.id);
                const svgRect = (e.target as SVGElement).closest("svg")!.getBoundingClientRect();
                setTooltipData({
                  engagement: eng,
                  x: e.clientX - svgRect.left,
                  y: e.clientY - svgRect.top + 14,
                });
              }}
              onMouseMove={(e) => {
                const svgRect = (e.target as SVGElement).closest("svg")!.getBoundingClientRect();
                setTooltipData((prev) =>
                  prev
                    ? { ...prev, x: e.clientX - svgRect.left, y: e.clientY - svgRect.top + 14 }
                    : null
                );
              }}
              onMouseLeave={() => {
                setHoveredId(null);
                setTooltipData(null);
              }}
              onClick={() => router.push(`/engagements/${eng.id}`)}
            >
              {/* Row hover background */}
              <rect
                x={0}
                y={y}
                width={svgWidth}
                height={ROW_HEIGHT}
                fill={isHovered ? "var(--color-bg-elevated)" : "transparent"}
                fillOpacity={isHovered ? 0.4 : 0}
                className="transition-opacity duration-75"
              />

              {/* Row divider */}
              <line
                x1={0}
                y1={y + ROW_HEIGHT}
                x2={svgWidth}
                y2={y + ROW_HEIGHT}
                stroke="var(--color-border-default)"
                strokeWidth={1}
                strokeOpacity={0.08}
              />

              {/* ── Left label ──────────────────────────── */}
              {/* Engagement name */}
              <text
                x={8}
                y={centerY - 5}
                dominantBaseline="central"
                fill={isHovered ? "#e8735a" : "var(--color-text-primary)"}
                fontSize={11}
                fontWeight={500}
                fontFamily="var(--font-display), sans-serif"
                className="select-none transition-colors duration-75"
              >
                {eng.name.length > 24 ? eng.name.slice(0, 23) + "…" : eng.name}
              </text>

              {/* Status + role badges */}
              <text
                x={8}
                y={centerY + 9}
                dominantBaseline="central"
                fill={statusColor}
                fontSize={8}
                fontWeight={600}
                fontFamily="var(--font-mono), monospace"
                className="select-none uppercase"
              >
                {statusMeta?.label ?? eng.status}
              </text>
              <text
                x={70}
                y={centerY + 9}
                dominantBaseline="central"
                fill={roleColor}
                fontSize={8}
                fontWeight={500}
                fontFamily="var(--font-mono), monospace"
                className="select-none uppercase"
              >
                {eng.role}
              </text>

              {/* Member count */}
              <text
                x={LEFT_PADDING - 12}
                y={centerY}
                dominantBaseline="central"
                textAnchor="end"
                fill="var(--color-text-muted)"
                fontSize={9}
                fontFamily="var(--font-mono), monospace"
                className="select-none"
              >
                {eng.memberCount}
                <tspan dx={1} fontSize={8}>
                  {eng.memberCount === 1 ? "m" : "m"}
                </tspan>
              </text>

              {/* ── Bar ─────────────────────────────────── */}
              <rect
                x={LEFT_PADDING + x1}
                y={centerY - BAR_HEIGHT / 2}
                width={barWidth}
                height={BAR_HEIGHT}
                rx={4}
                fill={statusColor}
                fillOpacity={isHovered ? 0.35 : 0.2}
                stroke={statusColor}
                strokeOpacity={isHovered ? 0.6 : 0.35}
                strokeWidth={1}
                className="transition-opacity duration-75"
              />

              {/* Open-ended dashed right edge */}
              {isOpenEnded && (
                <line
                  x1={LEFT_PADDING + x1 + barWidth}
                  y1={centerY - BAR_HEIGHT / 2 + 2}
                  x2={LEFT_PADDING + x1 + barWidth}
                  y2={centerY + BAR_HEIGHT / 2 - 2}
                  stroke={statusColor}
                  strokeWidth={2}
                  strokeDasharray="2 2"
                  strokeOpacity={0.5}
                />
              )}

              {/* Bar label (engagement name inside if it fits) */}
              {barWidth > 80 && (
                <text
                  x={LEFT_PADDING + x1 + barWidth / 2}
                  y={centerY}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill={statusColor}
                  fontSize={9}
                  fontWeight={500}
                  fontFamily="var(--font-display), sans-serif"
                  className="select-none pointer-events-none"
                  opacity={0.8}
                >
                  {eng.name.length > Math.floor(barWidth / 6)
                    ? eng.name.slice(0, Math.floor(barWidth / 6) - 1) + "…"
                    : eng.name}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* ── Tooltip ────────────────────────────────────────── */}
      {tooltipData && (
        <EngagementTooltip
          engagement={tooltipData.engagement}
          x={tooltipData.x}
          y={tooltipData.y}
          containerWidth={containerWidth}
        />
      )}
    </div>
  );
}

// ── Tooltip ─────────────────────────────────────────────────────────

function EngagementTooltip({
  engagement: eng,
  x,
  y,
  containerWidth,
}: {
  engagement: EngagementTimelineRow;
  x: number;
  y: number;
  containerWidth: number;
}) {
  const tooltipWidth = 240;
  const adjustedX = x + tooltipWidth > containerWidth ? x - tooltipWidth - 8 : x + 8;
  const statusColor = STATUS_COLORS[eng.status] ?? "#8b95a8";
  const statusMeta = STATUS_META[eng.status as EngagementStatus];

  return (
    <div
      className="absolute z-50 pointer-events-none"
      style={{ left: Math.max(4, adjustedX), top: y }}
    >
      <div className="bg-bg-surface border border-border-default rounded-lg shadow-lg px-3 py-2.5 w-[240px]">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-xs font-semibold text-text-primary line-clamp-1">
            {eng.name}
          </span>
        </div>

        <div className="flex items-center gap-1.5 mb-2">
          <span
            className="inline-flex items-center px-1.5 py-0.5 text-[8px] font-mono font-medium uppercase tracking-wider rounded border"
            style={{
              color: statusColor,
              backgroundColor: `${statusColor}15`,
              borderColor: `${statusColor}30`,
            }}
          >
            {statusMeta?.label ?? eng.status}
          </span>
          <span
            className="inline-flex items-center px-1.5 py-0.5 text-[8px] font-mono font-medium uppercase tracking-wider rounded border"
            style={{
              color: ROLE_COLORS[eng.role] ?? "#8b95a8",
              backgroundColor: `${ROLE_COLORS[eng.role] ?? "#8b95a8"}15`,
              borderColor: `${ROLE_COLORS[eng.role] ?? "#8b95a8"}30`,
            }}
          >
            {eng.role}
          </span>
        </div>

        {eng.description && (
          <p className="text-[10px] text-text-muted line-clamp-2 mb-1.5">
            {eng.description}
          </p>
        )}

        <div className="space-y-0.5 text-[10px] text-text-muted">
          <div className="flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6.75a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" />
            </svg>
            {eng.memberCount} {eng.memberCount === 1 ? "member" : "members"}
          </div>
          {(eng.startDate || eng.endDate) && (
            <div className="flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
              {eng.startDate ? formatShort(eng.startDate) : "?"} – {eng.endDate ? formatShort(eng.endDate) : "ongoing"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatShort(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
