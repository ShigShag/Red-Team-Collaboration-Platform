"use client";

import type { TimelinePhase } from "./timeline-types";
import type { TickMark } from "./timeline-utils";
import { timeToX } from "./timeline-utils";
import type { TooltipData } from "./timeline-tooltip";

const PHASE_HEIGHT = 36;
const TICK_AREA_HEIGHT = 28;
const TOTAL_HEIGHT = PHASE_HEIGHT + TICK_AREA_HEIGHT;

interface Props {
  phases: TimelinePhase[];
  ticks: TickMark[];
  rangeStart: number;
  rangeEnd: number;
  contentWidth: number;
  leftPadding: number;
  onTooltip: (data: TooltipData | null, position: { x: number; y: number } | null) => void;
}

function formatPhaseDuration(startTime: number, endTime: number): string {
  const ms = endTime - startTime;
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h`;
  return `${hours}h`;
}

export function TimelinePhaseBar({
  phases,
  ticks,
  rangeStart,
  rangeEnd,
  contentWidth,
  leftPadding,
  onTooltip,
}: Props) {
  const now = Date.now();
  const nowX = timeToX(now, rangeStart, rangeEnd, contentWidth);
  const showNowLine = now >= rangeStart && now <= rangeEnd;

  return (
    <g>
      {/* Phase segments */}
      {phases.map((phase, i) => {
        const x1 = Math.max(0, timeToX(phase.startTime, rangeStart, rangeEnd, contentWidth));
        const x2 = Math.min(contentWidth, timeToX(phase.endTime, rangeStart, rangeEnd, contentWidth));
        const w = Math.max(0, x2 - x1);
        if (w < 1) return null;

        const labelFits = w > 50;

        return (
          <g
            key={i}
            onMouseEnter={(e) => {
              const rect = (e.target as SVGElement).closest("svg")!.getBoundingClientRect();
              onTooltip(
                {
                  type: "phase",
                  phaseLabel: phase.label,
                  phaseColor: phase.color,
                  phaseDuration: formatPhaseDuration(phase.startTime, phase.endTime),
                },
                { x: e.clientX - rect.left, y: e.clientY - rect.top + 12 }
              );
            }}
            onMouseLeave={() => onTooltip(null, null)}
            className="cursor-default"
          >
            <rect
              x={leftPadding + x1}
              y={0}
              width={w}
              height={PHASE_HEIGHT}
              rx={4}
              fill={phase.color}
              fillOpacity={0.15}
              stroke={phase.color}
              strokeOpacity={0.3}
              strokeWidth={1}
            />
            {labelFits && (
              <text
                x={leftPadding + x1 + w / 2}
                y={PHASE_HEIGHT / 2}
                textAnchor="middle"
                dominantBaseline="central"
                fill={phase.color}
                fontSize={10}
                fontWeight={500}
                fontFamily="var(--font-display), sans-serif"
                className="select-none"
              >
                {phase.label}
              </text>
            )}
          </g>
        );
      })}

      {/* Tick marks and labels */}
      {ticks.map((tick, i) => (
        <g key={i}>
          <line
            x1={leftPadding + tick.x}
            y1={PHASE_HEIGHT}
            x2={leftPadding + tick.x}
            y2={PHASE_HEIGHT + (tick.isMajor ? 8 : 5)}
            stroke={tick.isMajor ? "var(--color-text-muted)" : "var(--color-border-default)"}
            strokeWidth={1}
            strokeOpacity={tick.isMajor ? 0.5 : 0.3}
          />
          <text
            x={leftPadding + tick.x}
            y={PHASE_HEIGHT + 20}
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

      {/* Baseline */}
      <line
        x1={leftPadding}
        y1={PHASE_HEIGHT}
        x2={leftPadding + contentWidth}
        y2={PHASE_HEIGHT}
        stroke="var(--color-border-default)"
        strokeWidth={1}
        strokeOpacity={0.4}
      />

      {/* "Now" marker */}
      {showNowLine && (
        <g>
          <line
            x1={leftPadding + nowX}
            y1={0}
            x2={leftPadding + nowX}
            y2={TOTAL_HEIGHT}
            stroke="#e8735a"
            strokeWidth={1}
            strokeDasharray="3 2"
            strokeOpacity={0.7}
          />
          <text
            x={leftPadding + nowX}
            y={PHASE_HEIGHT + 20}
            textAnchor="middle"
            fill="#e8735a"
            fontSize={8}
            fontWeight={600}
            fontFamily="var(--font-mono), monospace"
            className="select-none"
          >
            NOW
          </text>
        </g>
      )}
    </g>
  );
}

export { TOTAL_HEIGHT as PHASE_BAR_HEIGHT };
