import { getSeverityColor } from "@/lib/severity-colors";
import { STATUS_META, type EngagementStatus } from "@/lib/engagement-status";
import type {
  TimelineEvent,
  TimelinePhase,
  TimelineCategory,
  CategoryActivityRange,
  EventFilterType,
  TimelineData,
} from "./timeline-types";

// ── Time range ──────────────────────────────────────────────────────

const DAY_MS = 86_400_000;

export function computeTimeRange(
  engagement: TimelineData["engagement"],
  events: TimelineEvent[]
): { start: number; end: number } {
  const now = Date.now();

  // Use engagement dates as bounds if available
  let start = engagement.startDate
    ? new Date(engagement.startDate + "T00:00:00").getTime()
    : new Date(engagement.createdAt).getTime();
  let end = engagement.endDate
    ? new Date(engagement.endDate + "T23:59:59").getTime()
    : now;

  // Expand to include all events
  for (const e of events) {
    const t = new Date(e.createdAt).getTime();
    if (t < start) start = t;
    if (t > end) end = t;
  }

  // Include "now" if engagement is still open
  const activeStatuses: string[] = ["scoping", "active", "reporting"];
  if (activeStatuses.includes(engagement.status) && now > end) {
    end = now;
  }

  // Pad by 2% on each side, minimum 1 day total
  const span = Math.max(end - start, DAY_MS);
  const pad = span * 0.02;
  return { start: start - pad, end: end + pad };
}

// ── Phase computation ───────────────────────────────────────────────

const PHASE_COLORS: Record<EngagementStatus, string> = {
  scoping: "#60a5fa",
  active: "#4ade80",
  reporting: "#fbbf24",
  closed: "#fb7185",
  archived: "#c084fc",
};

export function computePhases(
  events: TimelineEvent[],
  engagement: TimelineData["engagement"]
): TimelinePhase[] {
  const now = Date.now();
  const createdAt = new Date(engagement.createdAt).getTime();

  // Collect status change events in chronological order
  const statusChanges = events
    .filter((e) => e.eventType === "engagement_status_changed")
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const phases: TimelinePhase[] = [];

  if (statusChanges.length === 0) {
    // Single phase from creation to now
    const status = (engagement.status || "scoping") as EngagementStatus;
    phases.push({
      status,
      startTime: createdAt,
      endTime: now,
      label: STATUS_META[status]?.label ?? status,
      color: PHASE_COLORS[status] ?? "#8b95a8",
    });
    return phases;
  }

  // Initial phase: from creation to first status change
  const firstChangeTime = new Date(statusChanges[0].createdAt).getTime();
  const initialStatus = (statusChanges[0].metadata.oldStatus || "scoping") as EngagementStatus;
  phases.push({
    status: initialStatus,
    startTime: createdAt,
    endTime: firstChangeTime,
    label: STATUS_META[initialStatus]?.label ?? initialStatus,
    color: PHASE_COLORS[initialStatus] ?? "#8b95a8",
  });

  // Subsequent phases
  for (let i = 0; i < statusChanges.length; i++) {
    const change = statusChanges[i];
    const newStatus = (change.metadata.newStatus || "active") as EngagementStatus;
    const phaseStart = new Date(change.createdAt).getTime();
    const phaseEnd =
      i < statusChanges.length - 1
        ? new Date(statusChanges[i + 1].createdAt).getTime()
        : now;

    phases.push({
      status: newStatus,
      startTime: phaseStart,
      endTime: phaseEnd,
      label: STATUS_META[newStatus]?.label ?? newStatus,
      color: PHASE_COLORS[newStatus] ?? "#8b95a8",
    });
  }

  return phases;
}

// ── Event classification ────────────────────────────────────────────

export function classifyEvent(eventType: string): EventFilterType {
  if (eventType.startsWith("finding_")) return "findings";
  if (eventType.startsWith("action_")) return "actions";
  if (eventType.startsWith("resource_")) return "resources";
  if (eventType.startsWith("scope_") || eventType.startsWith("contact_")) return "scope";
  if (eventType.startsWith("member_")) return "members";
  if (eventType === "engagement_status_changed") return "status";
  if (eventType === "comment_created") return "comments";
  if (eventType.startsWith("report_")) return "reports";
  // Fallback
  return "status";
}

// ── Event colors ────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<EventFilterType, string> = {
  findings: "#ef4444", // red — default, overridden by severity
  actions: "#eab308",
  resources: "#3b82f6",
  scope: "#06b6d4",
  members: "#22c55e",
  status: "#e8735a",
  comments: "#38bdf8",
  reports: "#a78bfa",
};

export function eventToColor(
  eventType: string,
  metadata: Record<string, string | null>
): string {
  const category = classifyEvent(eventType);
  if (category === "findings" && metadata.severity) {
    return getSeverityColor(metadata.severity);
  }
  return CATEGORY_COLORS[category];
}

export function getFilterColor(filter: EventFilterType): string {
  return CATEGORY_COLORS[filter];
}

// ── Coordinate mapping ──────────────────────────────────────────────

export function timeToX(
  timestamp: number,
  rangeStart: number,
  rangeEnd: number,
  width: number
): number {
  if (rangeEnd <= rangeStart) return 0;
  const ratio = (timestamp - rangeStart) / (rangeEnd - rangeStart);
  return Math.round(ratio * width * 100) / 100;
}

// ── Category activity ranges ────────────────────────────────────────

export function computeCategoryRanges(
  events: TimelineEvent[],
  categories: TimelineCategory[]
): CategoryActivityRange[] {
  const rangeMap = new Map<
    string,
    { first: number; last: number; count: number }
  >();

  for (const event of events) {
    const catId = event.metadata.categoryId;
    if (!catId) continue;

    const t = new Date(event.createdAt).getTime();
    const existing = rangeMap.get(catId);
    if (existing) {
      existing.first = Math.min(existing.first, t);
      existing.last = Math.max(existing.last, t);
      existing.count++;
    } else {
      rangeMap.set(catId, { first: t, last: t, count: 1 });
    }
  }

  const catMap = new Map(categories.map((c) => [c.id, c]));
  const ranges: CategoryActivityRange[] = [];

  for (const [catId, range] of rangeMap) {
    const cat = catMap.get(catId);
    if (!cat) continue;
    ranges.push({
      categoryId: catId,
      categoryName: cat.name,
      categoryColor: cat.color,
      categoryIcon: cat.icon,
      firstActivity: range.first,
      lastActivity: range.last,
      eventCount: range.count,
    });
  }

  // Sort by first activity
  ranges.sort((a, b) => a.firstActivity - b.firstActivity);
  return ranges;
}

// ── Tick mark generation ────────────────────────────────────────────

export interface TickMark {
  x: number;
  label: string;
  isMajor: boolean;
}

export function generateTickMarks(
  rangeStart: number,
  rangeEnd: number,
  width: number
): TickMark[] {
  const span = rangeEnd - rangeStart;
  if (span <= 0 || width <= 0) return [];

  const MIN_TICK_SPACING = 60; // minimum pixels between ticks
  const maxTicks = Math.floor(width / MIN_TICK_SPACING);

  // Choose appropriate interval
  const intervals = [
    { ms: DAY_MS, format: "day" },
    { ms: DAY_MS * 7, format: "week" },
    { ms: DAY_MS * 30, format: "month" },
  ];

  let interval = intervals[0];
  for (const iv of intervals) {
    if (span / iv.ms <= maxTicks) {
      interval = iv;
      break;
    }
  }

  // If even monthly ticks are too many, use quarterly
  if (span / interval.ms > maxTicks) {
    interval = { ms: DAY_MS * 90, format: "quarter" };
  }

  const ticks: TickMark[] = [];
  const startDate = new Date(rangeStart);

  // Snap to the beginning of the interval
  let cursor: Date;
  if (interval.format === "day") {
    cursor = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  } else if (interval.format === "week") {
    cursor = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    // Snap to Monday
    const day = cursor.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    cursor.setDate(cursor.getDate() + diff);
  } else {
    // Month or quarter — snap to first of month
    cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  }

  while (cursor.getTime() <= rangeEnd) {
    const t = cursor.getTime();
    if (t >= rangeStart) {
      const x = timeToX(t, rangeStart, rangeEnd, width);
      const isMajor =
        interval.format === "day"
          ? cursor.getDate() === 1
          : interval.format === "week"
            ? cursor.getDate() <= 7
            : cursor.getMonth() % 3 === 0;

      let label: string;
      if (interval.format === "day") {
        label =
          cursor.getDate() === 1
            ? cursor.toLocaleDateString("en-US", { month: "short" })
            : cursor.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      } else if (interval.format === "week") {
        label = cursor.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });
      } else {
        label = cursor.toLocaleDateString("en-US", {
          month: "short",
          year: cursor.getMonth() === 0 ? "numeric" : undefined,
        });
      }

      ticks.push({ x, label, isMajor });
    }

    // Advance cursor
    if (interval.format === "day") {
      cursor.setDate(cursor.getDate() + 1);
    } else if (interval.format === "week") {
      cursor.setDate(cursor.getDate() + 7);
    } else if (interval.format === "month") {
      cursor.setMonth(cursor.getMonth() + 1);
    } else {
      cursor.setMonth(cursor.getMonth() + 3);
    }
  }

  return ticks;
}

// ── Filter labels ───────────────────────────────────────────────────

export const FILTER_LABELS: Record<EventFilterType, string> = {
  findings: "Findings",
  actions: "Actions",
  resources: "Resources",
  scope: "Scope",
  members: "Members",
  status: "Status",
  comments: "Comments",
  reports: "Reports",
};

export const ALL_FILTERS: EventFilterType[] = [
  "findings",
  "actions",
  "resources",
  "scope",
  "members",
  "status",
  "comments",
  "reports",
];
