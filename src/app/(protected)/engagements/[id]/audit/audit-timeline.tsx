"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { formatDayHeader } from "@/lib/activity-helpers";
import { eventIcon } from "@/lib/activity-icons";
import { getTacticColor } from "@/lib/tactic-colors";

interface SerializedEvent {
  id: string;
  eventType: string;
  metadata: Record<string, string | null>;
  createdAt: string; // ISO string
  actorId: string;
  actorUsername: string;
  actorDisplayName: string | null;
  actorAvatarPath: string | null;
}

interface Filters {
  q: string;
  deep: boolean;
  types: string[];
  category: string;
  actor: string;
  tag: string;
  from: string;
  to: string;
}

interface AuditTimelineProps {
  events: SerializedEvent[];
  categories: { id: string; name: string }[];
  members: { id: string; username: string; displayName: string | null }[];
  tags: { id: string; name: string; mitreId: string | null; tactic: string | null }[];
  engagementId: string;
  page: number;
  totalPages: number;
  totalCount: number;
  filters: Filters;
}

function formatExactTime(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

const EVENT_TYPE_GROUPS: Record<string, { label: string; types: string[] }> = {
  categories: {
    label: "Categories",
    types: ["category_created", "category_updated", "category_deleted"],
  },
  resources: {
    label: "Resources",
    types: ["resource_created", "resource_updated", "resource_deleted"],
  },
  actions: {
    label: "Actions",
    types: ["action_created", "action_updated", "action_deleted"],
  },
  findings: {
    label: "Findings",
    types: ["finding_created", "finding_updated", "finding_deleted"],
  },
  reports: {
    label: "Reports",
    types: ["report_qa_requested", "report_qa_comment", "report_qa_resolved", "report_qa_signed_off"],
  },
  members: {
    label: "Members",
    types: [
      "member_joined",
      "member_removed",
      "member_role_changed",
      "member_assigned",
      "member_unassigned",
    ],
  },
};

function humanizeEventType(type: string): string {
  return type
    .split("_")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

function EntityBadge({
  label,
  type,
  href,
}: {
  label: string;
  type: "category" | "resource" | "action" | "member" | "finding";
  href?: string;
}) {
  const colorMap = {
    category: "bg-accent/10 text-accent border-accent/20",
    resource: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    action: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    member: "bg-green-500/10 text-green-400 border-green-500/20",
    finding: "bg-red-500/10 text-red-400 border-red-500/20",
  };
  const base = `inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono rounded border ${colorMap[type]}`;

  if (href) {
    return (
      <Link href={href} className={`${base} hover:brightness-125 transition-all`}>
        {label}
      </Link>
    );
  }
  return <span className={base}>{label}</span>;
}

function renderAuditDescription(
  event: SerializedEvent,
  categoryIds: Set<string>,
  engagementId: string
) {
  const m = event.metadata;
  const categoryHref =
    m.categoryId && categoryIds.has(m.categoryId)
      ? `/engagements/${engagementId}/categories/${m.categoryId}`
      : undefined;
  const resourceHref =
    categoryHref && m.resourceId
      ? `${categoryHref}#resource-${m.resourceId}`
      : undefined;
  const actionHref =
    categoryHref && m.actionId
      ? `${categoryHref}#action-${m.actionId}`
      : undefined;
  const settingsHref = `/engagements/${engagementId}/settings`;

  switch (event.eventType) {
    case "category_created":
      return (
        <>
          created category{" "}
          <EntityBadge label={m.categoryName ?? "?"} type="category" href={categoryHref} />
        </>
      );
    case "category_updated":
      return m.oldName ? (
        <>
          renamed category{" "}
          <EntityBadge label={m.oldName ?? "?"} type="category" />
          {" "}to{" "}
          <EntityBadge label={m.categoryName ?? "?"} type="category" href={categoryHref} />
        </>
      ) : (
        <>
          updated category{" "}
          <EntityBadge label={m.categoryName ?? "?"} type="category" href={categoryHref} />
        </>
      );
    case "category_deleted":
      return (
        <>
          deleted category{" "}
          <EntityBadge label={m.categoryName ?? "?"} type="category" />
        </>
      );
    case "resource_created":
      return (
        <>
          added resource{" "}
          <EntityBadge label={m.resourceName ?? "?"} type="resource" href={resourceHref} />
          {" "}to{" "}
          <EntityBadge label={m.categoryName ?? "?"} type="category" href={categoryHref} />
        </>
      );
    case "resource_updated":
      return (
        <>
          updated resource{" "}
          <EntityBadge label={m.resourceName ?? "?"} type="resource" href={resourceHref} />
          {" "}in{" "}
          <EntityBadge label={m.categoryName ?? "?"} type="category" href={categoryHref} />
        </>
      );
    case "resource_deleted":
      return (
        <>
          removed resource{" "}
          <EntityBadge label={m.resourceName ?? "?"} type="resource" />
          {" "}from{" "}
          <EntityBadge label={m.categoryName ?? "?"} type="category" href={categoryHref} />
        </>
      );
    case "action_created":
      return (
        <>
          logged action{" "}
          <EntityBadge label={m.actionTitle ?? "?"} type="action" href={actionHref} />
          {" "}in{" "}
          <EntityBadge label={m.categoryName ?? "?"} type="category" href={categoryHref} />
        </>
      );
    case "action_updated":
      return (
        <>
          updated action{" "}
          <EntityBadge label={m.actionTitle ?? "?"} type="action" href={actionHref} />
          {" "}in{" "}
          <EntityBadge label={m.categoryName ?? "?"} type="category" href={categoryHref} />
        </>
      );
    case "action_deleted":
      return (
        <>
          removed action{" "}
          <EntityBadge label={m.actionTitle ?? "?"} type="action" />
          {" "}from{" "}
          <EntityBadge label={m.categoryName ?? "?"} type="category" href={categoryHref} />
        </>
      );
    case "finding_created": {
      const findingHref = categoryHref ? `${categoryHref}#finding-${m.findingId}` : undefined;
      return (
        <>
          reported finding{" "}
          <EntityBadge label={m.findingTitle ?? "?"} type="finding" href={findingHref} />
          {" "}in{" "}
          <EntityBadge label={m.categoryName ?? "?"} type="category" href={categoryHref} />
        </>
      );
    }
    case "finding_updated": {
      const findingHref = categoryHref ? `${categoryHref}#finding-${m.findingId}` : undefined;
      return (
        <>
          updated finding{" "}
          <EntityBadge label={m.findingTitle ?? "?"} type="finding" href={findingHref} />
          {" "}in{" "}
          <EntityBadge label={m.categoryName ?? "?"} type="category" href={categoryHref} />
        </>
      );
    }
    case "finding_deleted":
      return (
        <>
          removed finding{" "}
          <EntityBadge label={m.findingTitle ?? "?"} type="finding" />
          {" "}from{" "}
          <EntityBadge label={m.categoryName ?? "?"} type="category" href={categoryHref} />
        </>
      );
    case "member_joined": {
      const name = m.targetDisplayName || m.targetUsername;
      return (
        <>
          added{" "}
          <EntityBadge label={name ?? "?"} type="member" href={settingsHref} />
          {" "}as {m.role}
        </>
      );
    }
    case "member_removed": {
      const name = m.targetDisplayName || m.targetUsername;
      return (
        <>
          removed{" "}
          <EntityBadge label={name ?? "?"} type="member" />
          {" "}from the engagement
        </>
      );
    }
    case "member_role_changed": {
      const name = m.targetDisplayName || m.targetUsername;
      return (
        <>
          changed{" "}
          <EntityBadge label={name ?? "?"} type="member" href={settingsHref} />
          {"'s role from "}
          <span className="font-mono text-text-primary">{m.oldRole}</span>
          {" to "}
          <span className="font-mono text-text-primary">{m.newRole}</span>
        </>
      );
    }
    case "member_assigned": {
      const name = m.targetDisplayName || m.targetUsername;
      return (
        <>
          assigned{" "}
          <EntityBadge label={name ?? "?"} type="member" href={settingsHref} />
          {" "}to{" "}
          <EntityBadge label={m.categoryName ?? "?"} type="category" href={categoryHref} />
        </>
      );
    }
    case "member_unassigned": {
      const name = m.targetDisplayName || m.targetUsername;
      return (
        <>
          unassigned{" "}
          <EntityBadge label={name ?? "?"} type="member" href={settingsHref} />
          {" "}from{" "}
          <EntityBadge label={m.categoryName ?? "?"} type="category" href={categoryHref} />
        </>
      );
    }
    case "report_qa_requested":
      return <>requested QA review on the report</>;
    case "report_qa_comment": {
      const section = m.sectionKey
        ? m.sectionKey.replace(/_/g, " ")
        : "the report";
      return <>posted a QA comment on <span className="font-mono text-text-primary">{section}</span></>;
    }
    case "report_qa_resolved":
      return <>marked a QA comment as resolved</>;
    case "report_qa_signed_off":
      return <>signed off the report after QA review</>;
    default:
      return "performed an action";
  }
}

function groupByDay(events: SerializedEvent[]): Map<string, SerializedEvent[]> {
  const groups = new Map<string, SerializedEvent[]>();
  for (const event of events) {
    const d = new Date(event.createdAt);
    const key = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
    const group = groups.get(key);
    if (group) {
      group.push(event);
    } else {
      groups.set(key, [event]);
    }
  }
  return groups;
}

export function AuditTimeline({
  events,
  categories,
  members,
  tags,
  engagementId,
  page,
  totalPages,
  totalCount,
  filters,
}: AuditTimelineProps) {
  const router = useRouter();
  const pathname = usePathname();
  const currentSearchParams = useSearchParams();

  // Local input state (for debouncing search, and for immediate UI updates on other filters)
  const [searchInput, setSearchInput] = useState(filters.q);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Build URL params from filters, preserving current values
  const pushFilters = useCallback(
    (updates: Partial<Filters>, resetPage = true) => {
      const next: Filters = { ...filters, ...updates };
      const params = new URLSearchParams();
      if (next.q) params.set("q", next.q);
      if (next.deep) params.set("deep", "1");
      if (next.types.length > 0) params.set("types", next.types.join(","));
      if (next.category) params.set("category", next.category);
      if (next.actor) params.set("actor", next.actor);
      if (next.tag) params.set("tag", next.tag);
      if (next.from) params.set("from", next.from);
      if (next.to) params.set("to", next.to);
      if (!resetPage) {
        const currentPage = currentSearchParams.get("page");
        if (currentPage) params.set("page", currentPage);
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    },
    [filters, pathname, router, currentSearchParams]
  );

  function onSearchChange(value: string) {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      pushFilters({ q: value });
    }, 300);
  }

  function toggleEventType(type: string) {
    const current = new Set(filters.types);
    if (current.has(type)) current.delete(type);
    else current.add(type);
    pushFilters({ types: Array.from(current) });
  }

  function goToPage(p: number) {
    const params = new URLSearchParams();
    if (filters.q) params.set("q", filters.q);
    if (filters.deep) params.set("deep", "1");
    if (filters.types.length > 0) params.set("types", filters.types.join(","));
    if (filters.category) params.set("category", filters.category);
    if (filters.actor) params.set("actor", filters.actor);
    if (filters.tag) params.set("tag", filters.tag);
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  const categoryIds = useMemo(
    () => new Set(categories.map((c) => c.id)),
    [categories]
  );

  const dayGroups = useMemo(() => groupByDay(events), [events]);

  const tacticGroups = useMemo(() => {
    const groups = new Map<string, typeof tags>();
    for (const tag of tags) {
      const key = tag.tactic || "Other";
      const group = groups.get(key);
      if (group) {
        group.push(tag);
      } else {
        groups.set(key, [tag]);
      }
    }
    return [...groups.entries()];
  }, [tags]);

  const selectedTag = useMemo(
    () => (filters.tag ? tags.find((t) => t.id === filters.tag) : undefined),
    [tags, filters.tag]
  );

  const hasFilters =
    filters.types.length > 0 ||
    filters.category ||
    filters.actor ||
    filters.tag ||
    filters.from ||
    filters.to ||
    filters.q ||
    filters.deep;

  function clearFilters() {
    setSearchInput("");
    router.replace(pathname);
  }

  return (
    <div className="space-y-6">
      {/* Filter bar */}
      <div className="bg-bg-surface/80 border border-border-default rounded-lg overflow-hidden">
        <button
          onClick={() => setFiltersOpen(!filtersOpen)}
          className="w-full flex items-center justify-between px-5 py-3 hover:bg-bg-elevated/30 transition-colors duration-100"
        >
          <div className="flex items-center gap-2">
            <svg
              className="w-4 h-4 text-text-muted"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z"
              />
            </svg>
            <span className="text-xs font-medium text-text-secondary">
              Filters
            </span>
            {hasFilters && (
              <span className="px-1.5 py-0.5 text-[9px] font-mono bg-accent/10 text-accent rounded">
                active
              </span>
            )}
          </div>
          <svg
            className={`w-3.5 h-3.5 text-text-muted transition-transform duration-200 ${
              filtersOpen ? "rotate-180" : ""
            }`}
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19.5 8.25l-7.5 7.5-7.5-7.5"
            />
          </svg>
        </button>

        {filtersOpen && (
          <div className="px-5 pb-5 space-y-4 border-t border-border-default pt-4">
            {/* Search */}
            <div>
              <label className="text-[10px] font-medium text-text-muted uppercase tracking-wider mb-1.5 block">
                Search
              </label>
              <input
                type="text"
                value={searchInput}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={filters.deep ? "Search events + content & tags..." : "Search events..."}
                className="w-full px-3 py-2 text-sm bg-bg-base border border-border-default rounded text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 transition-colors"
              />
              <label className="flex items-center gap-2 mt-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={filters.deep}
                  onChange={(e) => pushFilters({ deep: e.target.checked })}
                  className="w-3 h-3 rounded border-border-default accent-[#e8735a]"
                />
                <span className="text-[11px] text-text-secondary group-hover:text-text-primary transition-colors">
                  Search inside resource fields, action content &amp; tags
                </span>
              </label>
            </div>

            {/* Event type checkboxes */}
            <div>
              <label className="text-[10px] font-medium text-text-muted uppercase tracking-wider mb-2 block">
                Event Types
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1">
                {Object.entries(EVENT_TYPE_GROUPS).map(
                  ([groupKey, { label, types }]) => (
                    <div key={groupKey}>
                      <div className="text-[10px] font-mono text-text-muted mb-1">
                        {label}
                      </div>
                      {types.map((type) => (
                        <label
                          key={type}
                          className="flex items-center gap-2 py-0.5 cursor-pointer group"
                        >
                          <input
                            type="checkbox"
                            checked={filters.types.includes(type)}
                            onChange={() => toggleEventType(type)}
                            className="w-3 h-3 rounded border-border-default accent-[#e8735a]"
                          />
                          <span className="text-[11px] text-text-secondary group-hover:text-text-primary transition-colors">
                            {humanizeEventType(type)}
                          </span>
                        </label>
                      ))}
                    </div>
                  )
                )}
              </div>
            </div>

            {/* Dropdowns + date range */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <div>
                <label className="text-[10px] font-medium text-text-muted uppercase tracking-wider mb-1.5 block">
                  Category
                </label>
                <select
                  value={filters.category}
                  onChange={(e) => pushFilters({ category: e.target.value })}
                  className="w-full px-2 py-1.5 text-xs bg-bg-base border border-border-default rounded text-text-primary focus:outline-none focus:border-accent/50 transition-colors"
                >
                  <option value="">All categories</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-medium text-text-muted uppercase tracking-wider mb-1.5 block">
                  Actor
                </label>
                <select
                  value={filters.actor}
                  onChange={(e) => pushFilters({ actor: e.target.value })}
                  className="w-full px-2 py-1.5 text-xs bg-bg-base border border-border-default rounded text-text-primary focus:outline-none focus:border-accent/50 transition-colors"
                >
                  <option value="">All members</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.displayName || m.username}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-medium text-text-muted uppercase tracking-wider mb-1.5 block">
                  Tag
                </label>
                {selectedTag && (
                  <div className="mb-1.5">
                    <span
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] rounded font-mono"
                      style={{
                        backgroundColor: `${getTacticColor(selectedTag.tactic)}15`,
                        border: `1px solid ${getTacticColor(selectedTag.tactic)}40`,
                        color: getTacticColor(selectedTag.tactic),
                      }}
                    >
                      {selectedTag.mitreId || selectedTag.name}
                      <button
                        type="button"
                        onClick={() => pushFilters({ tag: "" })}
                        className="hover:brightness-150 transition-all duration-100"
                      >
                        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  </div>
                )}
                <select
                  value={filters.tag}
                  onChange={(e) => pushFilters({ tag: e.target.value })}
                  className="w-full px-2 py-1.5 text-xs bg-bg-base border border-border-default rounded text-text-primary focus:outline-none focus:border-accent/50 transition-colors"
                >
                  <option value="">All tags</option>
                  {tacticGroups.map(([tactic, tacticTags]) => (
                    <optgroup key={tactic} label={tactic}>
                      {tacticTags.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.mitreId ? `${t.mitreId} — ${t.name}` : t.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-medium text-text-muted uppercase tracking-wider mb-1.5 block">
                  From
                </label>
                <input
                  type="date"
                  value={filters.from}
                  onChange={(e) => pushFilters({ from: e.target.value })}
                  className="w-full px-2 py-1.5 text-xs bg-bg-base border border-border-default rounded text-text-primary focus:outline-none focus:border-accent/50 transition-colors"
                />
              </div>
              <div>
                <label className="text-[10px] font-medium text-text-muted uppercase tracking-wider mb-1.5 block">
                  To
                </label>
                <input
                  type="date"
                  value={filters.to}
                  onChange={(e) => pushFilters({ to: e.target.value })}
                  className="w-full px-2 py-1.5 text-xs bg-bg-base border border-border-default rounded text-text-primary focus:outline-none focus:border-accent/50 transition-colors"
                />
              </div>
            </div>

            {/* Summary */}
            <div className="flex items-center justify-between pt-2 border-t border-border-subtle">
              <span className="text-[10px] font-mono text-text-muted">
                Page {page} of {totalPages}
                {" · "}
                <span className="text-text-primary">
                  {totalCount}
                </span>{" "}
                {hasFilters ? "matching" : "total"} events
              </span>
              {hasFilters && (
                <button
                  onClick={clearFilters}
                  className="text-[10px] font-medium text-accent hover:text-accent-bright transition-colors"
                >
                  Clear all filters
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Timeline */}
      {events.length === 0 ? (
        <div className="border border-border-subtle border-dashed rounded-lg p-8 text-center">
          <p className="text-sm text-text-muted">
            {hasFilters
              ? "No events match the current filters"
              : "No activity recorded yet"}
          </p>
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="text-xs text-accent hover:text-accent-bright mt-2 transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {Array.from(dayGroups.entries()).map(([dayKey, dayEvents]) => (
            <div key={dayKey}>
              <div className="text-[10px] font-mono font-medium text-text-muted uppercase tracking-wider mb-2">
                {formatDayHeader(new Date(dayKey))}
              </div>
              <div className="border-l border-border-subtle ml-3 pl-5 space-y-0.5">
                {dayEvents.map((event) => {
                  const actorName =
                    event.actorDisplayName || event.actorUsername;
                  return (
                    <div
                      key={event.id}
                      className="flex items-start gap-3 py-2"
                    >
                      {/* Avatar */}
                      {event.actorAvatarPath ? (
                        <img
                          src={`/api/avatar/${event.actorId}`}
                          alt=""
                          className="w-6 h-6 rounded-full object-cover flex-shrink-0 mt-0.5"
                        />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-[9px] font-medium text-accent">
                            {actorName[0]?.toUpperCase() ?? "?"}
                          </span>
                        </div>
                      )}

                      {/* Icon */}
                      <div className="flex-shrink-0 mt-1">
                        {eventIcon(event.eventType)}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-text-secondary leading-relaxed flex flex-wrap items-center gap-x-1 gap-y-0.5">
                          <span className="font-medium text-text-primary">
                            {actorName}
                          </span>{" "}
                          {renderAuditDescription(
                            event,
                            categoryIds,
                            engagementId
                          )}
                        </p>
                      </div>

                      {/* Exact timestamp */}
                      <span className="text-[10px] font-mono text-text-muted whitespace-nowrap mt-0.5 flex-shrink-0">
                        {formatExactTime(event.createdAt)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={() => goToPage(page - 1)}
            disabled={page <= 1}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs border border-border-default rounded hover:bg-bg-elevated/50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-text-secondary hover:text-text-primary"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Previous
          </button>

          <div className="flex items-center gap-1">
            {generatePageNumbers(page, totalPages).map((p, i) =>
              p === "..." ? (
                <span key={`ellipsis-${i}`} className="px-1 text-[10px] text-text-muted">
                  ...
                </span>
              ) : (
                <button
                  key={p}
                  onClick={() => goToPage(p as number)}
                  className={`min-w-[28px] h-7 text-[11px] font-mono rounded transition-colors ${
                    p === page
                      ? "bg-accent/15 text-accent border border-accent/30"
                      : "text-text-muted hover:text-text-primary hover:bg-bg-elevated/50 border border-transparent"
                  }`}
                >
                  {p}
                </button>
              )
            )}
          </div>

          <button
            onClick={() => goToPage(page + 1)}
            disabled={page >= totalPages}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs border border-border-default rounded hover:bg-bg-elevated/50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-text-secondary hover:text-text-primary"
          >
            Next
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

function generatePageNumbers(current: number, total: number): (number | "...")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const pages: (number | "...")[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) pages.push("...");
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < total - 1) pages.push("...");
  pages.push(total);
  return pages;
}
