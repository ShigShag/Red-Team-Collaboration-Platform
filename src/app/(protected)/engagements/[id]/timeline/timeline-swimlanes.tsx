"use client";

import type { TimelineEvent, EventFilterType } from "./timeline-types";
import type { CategoryActivityRange } from "./timeline-types";
import { timeToX, classifyEvent, eventToColor } from "./timeline-utils";
import type { TooltipData } from "./timeline-tooltip";

const ROW_HEIGHT = 28;
const ICON_SIZE = 14;
const BAR_HEIGHT = 16;
const DOT_RADIUS = 3;

interface Props {
  ranges: CategoryActivityRange[];
  events: TimelineEvent[];
  activeFilters: Set<EventFilterType>;
  rangeStart: number;
  rangeEnd: number;
  contentWidth: number;
  leftPadding: number;
  yOffset: number;
  onTooltip: (data: TooltipData | null, position: { x: number; y: number } | null) => void;
}

export function TimelineSwimlanes({
  ranges,
  events,
  activeFilters,
  rangeStart,
  rangeEnd,
  contentWidth,
  leftPadding,
  yOffset,
  onTooltip,
}: Props) {
  if (ranges.length === 0) {
    return (
      <g transform={`translate(0, ${yOffset})`}>
        <text
          x={4}
          y={14}
          fill="var(--color-text-muted)"
          fontSize={10}
          fontFamily="var(--font-mono), monospace"
          className="select-none"
        >
          Categories
        </text>
        <text
          x={leftPadding + contentWidth / 2}
          y={14}
          textAnchor="middle"
          fill="var(--color-text-muted)"
          fontSize={10}
          fontStyle="italic"
          className="select-none"
        >
          No category activity yet
        </text>
      </g>
    );
  }

  // Group events by categoryId for dot rendering
  const eventsByCategory = new Map<string, TimelineEvent[]>();
  for (const event of events) {
    if (!activeFilters.has(classifyEvent(event.eventType))) continue;
    const catId = event.metadata.categoryId;
    if (!catId) continue;
    const arr = eventsByCategory.get(catId);
    if (arr) arr.push(event);
    else eventsByCategory.set(catId, [event]);
  }

  return (
    <g transform={`translate(0, ${yOffset})`}>
      {/* Section label */}
      <text
        x={4}
        y={-6}
        fill="var(--color-text-muted)"
        fontSize={10}
        fontFamily="var(--font-mono), monospace"
        className="select-none"
      >
        Categories
      </text>

      {ranges.map((range, i) => {
        const y = i * ROW_HEIGHT;
        const centerY = y + ROW_HEIGHT / 2;
        const barColor = range.categoryColor || "#8b95a8";

        const x1 = timeToX(range.firstActivity, rangeStart, rangeEnd, contentWidth);
        const x2 = timeToX(range.lastActivity, rangeStart, rangeEnd, contentWidth);
        const barWidth = Math.max(x2 - x1, 4); // minimum 4px for single-event categories

        const categoryEvents = eventsByCategory.get(range.categoryId) ?? [];

        return (
          <g key={range.categoryId}>
            {/* Row background on hover */}
            <rect
              x={0}
              y={y}
              width={leftPadding + contentWidth}
              height={ROW_HEIGHT}
              fill="transparent"
              className="hover:fill-[var(--color-bg-elevated)] transition-colors duration-100"
              fillOpacity={0.3}
            />

            {/* Category label */}
            <text
              x={ICON_SIZE + 8}
              y={centerY}
              dominantBaseline="central"
              fill="var(--color-text-secondary)"
              fontSize={10}
              fontFamily="var(--font-display), sans-serif"
              className="select-none"
            >
              {range.categoryName.length > 16
                ? range.categoryName.slice(0, 15) + "…"
                : range.categoryName}
            </text>

            {/* Activity bar */}
            <rect
              x={leftPadding + x1}
              y={centerY - BAR_HEIGHT / 2}
              width={barWidth}
              height={BAR_HEIGHT}
              rx={3}
              fill={barColor}
              fillOpacity={0.15}
              stroke={barColor}
              strokeOpacity={0.25}
              strokeWidth={1}
              onMouseEnter={(e) => {
                const svgRect = (e.target as SVGElement).closest("svg")!.getBoundingClientRect();
                onTooltip(
                  {
                    type: "swimlane",
                    categoryName: range.categoryName,
                    categoryColor: barColor,
                    eventCount: range.eventCount,
                  },
                  { x: e.clientX - svgRect.left, y: e.clientY - svgRect.top + 12 }
                );
              }}
              onMouseLeave={() => onTooltip(null, null)}
              className="cursor-default"
            />

            {/* Event dots within the bar */}
            {categoryEvents.map((event) => {
              const ex = timeToX(
                new Date(event.createdAt).getTime(),
                rangeStart,
                rangeEnd,
                contentWidth
              );
              const color = eventToColor(event.eventType, event.metadata);

              return (
                <circle
                  key={event.id}
                  cx={leftPadding + ex}
                  cy={centerY}
                  r={DOT_RADIUS}
                  fill={color}
                  fillOpacity={0.7}
                  className="pointer-events-none"
                />
              );
            })}

            {/* Row divider */}
            <line
              x1={leftPadding}
              y1={y + ROW_HEIGHT}
              x2={leftPadding + contentWidth}
              y2={y + ROW_HEIGHT}
              stroke="var(--color-border-default)"
              strokeWidth={1}
              strokeOpacity={0.1}
            />
          </g>
        );
      })}
    </g>
  );
}

export function computeSwimlaneHeight(rangeCount: number): number {
  return rangeCount > 0 ? rangeCount * ROW_HEIGHT : ROW_HEIGHT;
}
