"use client";

import { useEffect, useRef, useState } from "react";
import { eventIcon } from "@/lib/activity-icons";
import { describeEvent, formatRelativeTime, type ActivityEvent } from "@/lib/activity-helpers";

interface TooltipData {
  type: "event" | "phase" | "swimlane";
  // For events
  event?: {
    id: string;
    eventType: string;
    metadata: Record<string, string | null>;
    createdAt: string;
    actorId: string;
    actorUsername: string;
    actorDisplayName: string | null;
    actorAvatarPath: string | null;
  };
  // For phases
  phaseLabel?: string;
  phaseColor?: string;
  phaseDuration?: string;
  // For swimlanes
  categoryName?: string;
  categoryColor?: string;
  eventCount?: number;
}

interface Props {
  data: TooltipData | null;
  position: { x: number; y: number } | null;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export type { TooltipData };

export function TimelineTooltip({ data, position, containerRef }: Props) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [adjustedPos, setAdjustedPos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!position || !tooltipRef.current || !containerRef.current) {
      setAdjustedPos(null);
      return;
    }

    const tooltip = tooltipRef.current;
    const container = containerRef.current;
    const containerRect = container.getBoundingClientRect();
    const tooltipWidth = tooltip.offsetWidth;
    const tooltipHeight = tooltip.offsetHeight;

    let x = position.x;
    let y = position.y;

    // Flip horizontally if overflowing right
    if (x + tooltipWidth > containerRect.width) {
      x = x - tooltipWidth - 8;
    }

    // Flip vertically if overflowing bottom
    if (y + tooltipHeight > containerRect.height) {
      y = y - tooltipHeight - 8;
    }

    // Clamp to container bounds
    x = Math.max(4, Math.min(x, containerRect.width - tooltipWidth - 4));
    y = Math.max(4, y);

    setAdjustedPos({ x, y });
  }, [position, data, containerRef]);

  if (!data || !position) return null;

  return (
    <div
      ref={tooltipRef}
      className="absolute z-50 pointer-events-none"
      style={{
        left: adjustedPos?.x ?? position.x,
        top: adjustedPos?.y ?? position.y,
        opacity: adjustedPos ? 1 : 0,
      }}
    >
      <div className="bg-bg-surface border border-border-default rounded-lg shadow-lg px-3 py-2 max-w-[280px]">
        {data.type === "event" && data.event && <EventTooltipContent event={data.event} />}
        {data.type === "phase" && <PhaseTooltipContent data={data} />}
        {data.type === "swimlane" && <SwimlaneTooltipContent data={data} />}
      </div>
    </div>
  );
}

function EventTooltipContent({
  event,
}: {
  event: NonNullable<TooltipData["event"]>;
}) {
  const activityEvent: ActivityEvent = {
    ...event,
    createdAt: new Date(event.createdAt),
  };
  const icon = eventIcon(event.eventType);
  const { text } = describeEvent(activityEvent);
  const actorName = event.actorDisplayName || event.actorUsername;

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        {icon && <span className="flex-shrink-0">{icon}</span>}
        <span className="text-[10px] font-mono text-text-muted uppercase tracking-wider">
          {event.eventType.replace(/_/g, " ")}
        </span>
      </div>
      <p className="text-xs text-text-primary leading-snug">
        <span className="font-medium">{actorName}</span>{" "}
        <span className="text-text-secondary">{text}</span>
      </p>
      <p className="text-[10px] text-text-muted">
        {formatRelativeTime(new Date(event.createdAt))}
        {" · "}
        {new Date(event.createdAt).toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })}
      </p>
    </div>
  );
}

function PhaseTooltipContent({ data }: { data: TooltipData }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <span
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: data.phaseColor }}
        />
        <span className="text-xs font-medium text-text-primary">
          {data.phaseLabel}
        </span>
      </div>
      {data.phaseDuration && (
        <p className="text-[10px] text-text-muted">{data.phaseDuration}</p>
      )}
    </div>
  );
}

function SwimlaneTooltipContent({ data }: { data: TooltipData }) {
  return (
    <div className="space-y-1">
      <span className="text-xs font-medium text-text-primary">
        {data.categoryName}
      </span>
      <p className="text-[10px] text-text-muted">
        {data.eventCount} event{data.eventCount !== 1 ? "s" : ""}
      </p>
    </div>
  );
}
