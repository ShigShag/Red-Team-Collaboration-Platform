"use client";

import type { TimelineEvent, EventFilterType } from "./timeline-types";
import { timeToX, classifyEvent, eventToColor } from "./timeline-utils";
import type { TooltipData } from "./timeline-tooltip";

const TRACK_HEIGHT = 40;
const MARKER_RADIUS = 5;
const CLUSTER_THRESHOLD_PX = 6;

interface EventMarker {
  x: number;
  events: TimelineEvent[];
  color: string;
}

interface Props {
  events: TimelineEvent[];
  activeFilters: Set<EventFilterType>;
  rangeStart: number;
  rangeEnd: number;
  contentWidth: number;
  leftPadding: number;
  yOffset: number;
  onTooltip: (data: TooltipData | null, position: { x: number; y: number } | null) => void;
  onSelectEvent: (event: TimelineEvent) => void;
}

function clusterEvents(
  events: TimelineEvent[],
  rangeStart: number,
  rangeEnd: number,
  contentWidth: number
): EventMarker[] {
  if (events.length === 0) return [];

  // Sort by time
  const sorted = [...events].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  const markers: EventMarker[] = [];
  let currentCluster: TimelineEvent[] = [sorted[0]];
  let currentX = timeToX(
    new Date(sorted[0].createdAt).getTime(),
    rangeStart,
    rangeEnd,
    contentWidth
  );

  for (let i = 1; i < sorted.length; i++) {
    const x = timeToX(
      new Date(sorted[i].createdAt).getTime(),
      rangeStart,
      rangeEnd,
      contentWidth
    );

    if (Math.abs(x - currentX) <= CLUSTER_THRESHOLD_PX) {
      currentCluster.push(sorted[i]);
    } else {
      // Finalize current cluster
      const avgX =
        currentCluster.reduce(
          (sum, e) =>
            sum +
            timeToX(
              new Date(e.createdAt).getTime(),
              rangeStart,
              rangeEnd,
              contentWidth
            ),
          0
        ) / currentCluster.length;

      markers.push({
        x: avgX,
        events: currentCluster,
        color: eventToColor(
          currentCluster[0].eventType,
          currentCluster[0].metadata
        ),
      });

      currentCluster = [sorted[i]];
      currentX = x;
    }
  }

  // Finalize last cluster
  const avgX =
    currentCluster.reduce(
      (sum, e) =>
        sum +
        timeToX(
          new Date(e.createdAt).getTime(),
          rangeStart,
          rangeEnd,
          contentWidth
        ),
      0
    ) / currentCluster.length;

  markers.push({
    x: avgX,
    events: currentCluster,
    color: eventToColor(
      currentCluster[0].eventType,
      currentCluster[0].metadata
    ),
  });

  return markers;
}

export function TimelineEventTrack({
  events,
  activeFilters,
  rangeStart,
  rangeEnd,
  contentWidth,
  leftPadding,
  yOffset,
  onTooltip,
  onSelectEvent,
}: Props) {
  // Filter events by active filters
  const filteredEvents = events.filter((e) =>
    activeFilters.has(classifyEvent(e.eventType))
  );

  const markers = clusterEvents(filteredEvents, rangeStart, rangeEnd, contentWidth);
  const centerY = TRACK_HEIGHT / 2;

  return (
    <g transform={`translate(0, ${yOffset})`}>
      {/* Label */}
      <text
        x={4}
        y={centerY}
        dominantBaseline="central"
        fill="var(--color-text-muted)"
        fontSize={10}
        fontFamily="var(--font-mono), monospace"
        className="select-none"
      >
        Events
      </text>

      {/* Track line */}
      <line
        x1={leftPadding}
        y1={centerY}
        x2={leftPadding + contentWidth}
        y2={centerY}
        stroke="var(--color-border-default)"
        strokeWidth={1}
        strokeOpacity={0.2}
      />

      {/* Event markers */}
      {markers.map((marker, i) => {
        const isClustered = marker.events.length > 1;
        const radius = isClustered
          ? MARKER_RADIUS + Math.min(marker.events.length, 8)
          : MARKER_RADIUS;

        return (
          <g
            key={i}
            onMouseEnter={(e) => {
              const svgRect = (e.target as SVGElement).closest("svg")!.getBoundingClientRect();
              if (isClustered) {
                onTooltip(
                  {
                    type: "event",
                    event: marker.events[0],
                    phaseLabel: `${marker.events.length} events`,
                    phaseDuration: `${marker.events.length} events at this time`,
                  },
                  { x: e.clientX - svgRect.left, y: e.clientY - svgRect.top + 12 }
                );
              } else {
                onTooltip(
                  { type: "event", event: marker.events[0] },
                  { x: e.clientX - svgRect.left, y: e.clientY - svgRect.top + 12 }
                );
              }
            }}
            onMouseLeave={() => onTooltip(null, null)}
            onClick={() => {
              if (marker.events.length === 1) {
                onSelectEvent(marker.events[0]);
              }
            }}
            className="cursor-pointer"
          >
            <circle
              cx={leftPadding + marker.x}
              cy={centerY}
              r={radius}
              fill={marker.color}
              fillOpacity={0.25}
              stroke={marker.color}
              strokeWidth={1.5}
              className="transition-opacity duration-100 hover:fill-opacity-50"
            />
            {isClustered && (
              <text
                x={leftPadding + marker.x}
                y={centerY}
                textAnchor="middle"
                dominantBaseline="central"
                fill={marker.color}
                fontSize={8}
                fontWeight={700}
                fontFamily="var(--font-mono), monospace"
                className="select-none pointer-events-none"
              >
                {marker.events.length}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}

export { TRACK_HEIGHT as EVENT_TRACK_HEIGHT };
