"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import type { TimelineData, TimelineEvent, EventFilterType } from "./timeline-types";
import {
  computeTimeRange,
  computePhases,
  computeCategoryRanges,
  generateTickMarks,
  ALL_FILTERS,
  FILTER_LABELS,
  getFilterColor,
  classifyEvent,
} from "./timeline-utils";
import { TimelinePhaseBar, PHASE_BAR_HEIGHT } from "./timeline-phase-bar";
import { TimelineEventTrack, EVENT_TRACK_HEIGHT } from "./timeline-event-track";
import { TimelineSwimlanes, computeSwimlaneHeight } from "./timeline-swimlanes";
import { TimelineTooltip, type TooltipData } from "./timeline-tooltip";
import { describeEvent, type ActivityEvent } from "@/lib/activity-helpers";
import { eventIcon } from "@/lib/activity-icons";

const LEFT_PADDING = 120;
const RIGHT_PADDING = 20;
const SECTION_GAP = 12;
const MIN_CONTENT_WIDTH = 460; // 600 - LEFT_PADDING - RIGHT_PADDING

interface Props {
  data: TimelineData;
}

export function EngagementTimeline({ data }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(800);
  const [activeFilters, setActiveFilters] = useState<Set<EventFilterType>>(
    () => new Set(ALL_FILTERS)
  );
  const [tooltipData, setTooltipData] = useState<TooltipData | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);

  // ResizeObserver for responsive width
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

  // Compute derived data
  const timeRange = useMemo(
    () => computeTimeRange(data.engagement, data.events),
    [data.engagement, data.events]
  );

  const phases = useMemo(
    () => computePhases(data.events, data.engagement),
    [data.events, data.engagement]
  );

  const categoryRanges = useMemo(
    () => computeCategoryRanges(data.events, data.categories),
    [data.events, data.categories]
  );

  const ticks = useMemo(
    () => generateTickMarks(timeRange.start, timeRange.end, contentWidth),
    [timeRange.start, timeRange.end, contentWidth]
  );

  // Compute SVG height
  const swimlaneHeight = computeSwimlaneHeight(categoryRanges.length);
  const svgHeight =
    PHASE_BAR_HEIGHT +
    SECTION_GAP +
    EVENT_TRACK_HEIGHT +
    SECTION_GAP +
    16 + // "Categories" label
    swimlaneHeight +
    12; // bottom padding

  const handleTooltip = useCallback(
    (td: TooltipData | null, pos: { x: number; y: number } | null) => {
      setTooltipData(td);
      setTooltipPosition(pos);
    },
    []
  );

  const handleSelectEvent = useCallback((event: TimelineEvent) => {
    setSelectedEvent((prev) => (prev?.id === event.id ? null : event));
  }, []);

  const toggleFilter = useCallback((filter: EventFilterType) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(filter)) {
        next.delete(filter);
      } else {
        next.add(filter);
      }
      return next;
    });
  }, []);

  // Compute event counts per filter for badges
  const filterCounts = useMemo(() => {
    const counts = new Map<EventFilterType, number>();
    for (const event of data.events) {
      const category = classifyEvent(event.eventType);
      counts.set(category, (counts.get(category) ?? 0) + 1);
    }
    return counts;
  }, [data.events]);

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[10px] font-mono text-text-muted uppercase tracking-wider mr-1">
          Filter:
        </span>
        {ALL_FILTERS.map((filter) => {
          const active = activeFilters.has(filter);
          const color = getFilterColor(filter);
          const count = filterCounts.get(filter) ?? 0;

          return (
            <button
              key={filter}
              onClick={() => toggleFilter(filter)}
              className={`inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded border transition-all duration-100 ${
                active
                  ? "border-current/30"
                  : "border-border-default text-text-muted opacity-40 hover:opacity-70"
              }`}
              style={active ? { color, borderColor: `${color}40` } : undefined}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: active ? color : "var(--color-text-muted)" }}
              />
              {FILTER_LABELS[filter]}
              {count > 0 && (
                <span className="text-[9px] opacity-60">{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Timeline SVG area */}
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
          {/* Phase bar */}
          <TimelinePhaseBar
            phases={phases}
            ticks={ticks}
            rangeStart={timeRange.start}
            rangeEnd={timeRange.end}
            contentWidth={contentWidth}
            leftPadding={LEFT_PADDING}
            onTooltip={handleTooltip}
          />

          {/* Event track */}
          <TimelineEventTrack
            events={data.events}
            activeFilters={activeFilters}
            rangeStart={timeRange.start}
            rangeEnd={timeRange.end}
            contentWidth={contentWidth}
            leftPadding={LEFT_PADDING}
            yOffset={PHASE_BAR_HEIGHT + SECTION_GAP}
            onTooltip={handleTooltip}
            onSelectEvent={handleSelectEvent}
          />

          {/* Swimlanes */}
          <TimelineSwimlanes
            ranges={categoryRanges}
            events={data.events}
            activeFilters={activeFilters}
            rangeStart={timeRange.start}
            rangeEnd={timeRange.end}
            contentWidth={contentWidth}
            leftPadding={LEFT_PADDING}
            yOffset={
              PHASE_BAR_HEIGHT +
              SECTION_GAP +
              EVENT_TRACK_HEIGHT +
              SECTION_GAP +
              16
            }
            onTooltip={handleTooltip}
          />
        </svg>

        {/* Tooltip overlay */}
        <TimelineTooltip
          data={tooltipData}
          position={tooltipPosition}
          containerRef={containerRef}
        />
      </div>

      {/* Selected event detail */}
      {selectedEvent && (
        <SelectedEventDetail
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
        />
      )}

      {/* Empty state */}
      {data.events.length === 0 && (
        <div className="flex items-center justify-center py-12 text-sm text-text-muted">
          No activity events recorded for this engagement yet.
        </div>
      )}
    </div>
  );
}

function SelectedEventDetail({
  event,
  onClose,
}: {
  event: TimelineEvent;
  onClose: () => void;
}) {
  const activityEvent: ActivityEvent = {
    ...event,
    createdAt: new Date(event.createdAt),
  };
  const icon = eventIcon(event.eventType);
  const { text } = describeEvent(activityEvent);
  const actorName = event.actorDisplayName || event.actorUsername;

  return (
    <div className="relative flex items-start gap-3 px-4 py-3 rounded-lg border border-border-default bg-bg-surface/80 animate-fade-in-up">
      <button
        onClick={onClose}
        className="absolute top-2 right-2 p-1 text-text-muted hover:text-text-primary transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {icon && <span className="mt-0.5 flex-shrink-0">{icon}</span>}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs font-medium text-text-primary">{actorName}</span>
          <span className="text-[10px] font-mono text-text-muted">
            {new Date(event.createdAt).toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </span>
        </div>
        <p className="text-xs text-text-secondary">{text}</p>

        {/* Show relevant metadata */}
        {Object.entries(event.metadata).length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {Object.entries(event.metadata)
              .filter(([, v]) => v != null && v !== "")
              .slice(0, 5)
              .map(([key, value]) => (
                <span
                  key={key}
                  className="inline-flex items-center px-1.5 py-0.5 text-[9px] font-mono bg-bg-elevated border border-border-default rounded text-text-muted"
                >
                  {key}: {value}
                </span>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
