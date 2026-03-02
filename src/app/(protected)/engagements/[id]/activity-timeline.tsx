import Link from "next/link";
import {
  type ActivityEvent,
  formatRelativeTime,
  formatDayHeader,
  groupByDay,
} from "@/lib/activity-helpers";
import { eventIcon, renderLinkedDescription, type LinkContext } from "@/lib/activity-icons";

export type { ActivityEvent };

interface ActivityTimelineProps {
  events: ActivityEvent[];
  title?: string;
  emptyMessage?: string;
  page?: number;
  totalPages?: number;
  totalCount?: number;
  baseUrl?: string;
  engagementId?: string;
  categoryIds?: string[];
}

function pageUrl(baseUrl: string, page: number): string {
  if (page <= 1) return baseUrl;
  const sep = baseUrl.includes("?") ? "&" : "?";
  return `${baseUrl}${sep}activityPage=${page}`;
}

function generatePageNumbers(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "...")[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) pages.push("...");
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < total - 1) pages.push("...");
  pages.push(total);
  return pages;
}

export function ActivityTimeline({
  events,
  title = "Activity",
  emptyMessage,
  page = 1,
  totalPages = 1,
  totalCount,
  baseUrl,
  engagementId,
  categoryIds,
}: ActivityTimelineProps) {
  const hasPagination = totalPages > 1 && baseUrl;
  const displayCount = totalCount ?? events.length;
  const categoryIdSet = new Set(categoryIds ?? []);

  if (events.length === 0) {
    return (
      <div>
        <div className="flex items-center gap-2 mb-4">
          <div className="h-px w-8 bg-accent/50" />
          <span className="text-[10px] font-medium text-accent tracking-[0.2em] uppercase">
            {title}
          </span>
        </div>
        <div className="border border-border-subtle border-dashed rounded-lg p-8 text-center">
          <p className="text-sm text-text-muted">{emptyMessage ?? "No activity recorded yet"}</p>
          <p className="text-xs text-text-muted mt-1">
            Activity will appear here as team members make changes
          </p>
        </div>
      </div>
    );
  }

  const dayGroups = groupByDay(events);

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <div className="h-px w-8 bg-accent/50" />
        <span className="text-[10px] font-medium text-accent tracking-[0.2em] uppercase">
          {title}
        </span>
        <span className="text-[10px] font-mono text-text-muted">
          {hasPagination ? `${displayCount} total` : displayCount}
        </span>
      </div>

      <div className="space-y-6">
        {Array.from(dayGroups.entries()).map(([dayKey, dayEvents]) => (
          <div key={dayKey}>
            <div className="text-[10px] font-mono font-medium text-text-muted uppercase tracking-wider mb-2">
              {formatDayHeader(new Date(dayKey))}
            </div>
            <div className="border-l border-border-subtle ml-3 pl-5 space-y-0.5">
              {dayEvents.map((event) => {
                const actorName = event.actorDisplayName || event.actorUsername;
                return (
                  <div key={event.id} className="flex items-start gap-3 py-1.5">
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
                      <p className="text-xs text-text-secondary leading-relaxed">
                        <span className="font-medium text-text-primary">{actorName}</span>
                        {" "}
                        {(() => {
                          const eid = engagementId ?? event.engagementId;
                          if (eid) {
                            return renderLinkedDescription(event, {
                              engagementId: eid,
                              categoryIds: categoryIdSet,
                            });
                          }
                          return renderLinkedDescription(event, {
                            engagementId: "",
                            categoryIds: categoryIdSet,
                          });
                        })()}
                        {event.engagementName && (
                          <>
                            {" "}
                            <span className="text-text-muted">in</span>
                            {" "}
                            <Link
                              href={`/engagements/${engagementId ?? event.engagementId ?? ""}`}
                              className="font-medium text-text-primary hover:text-accent transition-colors"
                            >
                              {event.engagementName}
                            </Link>
                          </>
                        )}
                      </p>
                    </div>

                    {/* Timestamp */}
                    <span className="text-[10px] font-mono text-text-muted whitespace-nowrap mt-0.5 flex-shrink-0">
                      {formatRelativeTime(event.createdAt)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {hasPagination && (
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-border-subtle">
          {page > 1 ? (
            <Link
              href={pageUrl(baseUrl, page - 1)}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs border border-border-default rounded hover:bg-bg-elevated/50 transition-colors text-text-secondary hover:text-text-primary"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
              Prev
            </Link>
          ) : (
            <span className="inline-flex items-center gap-1 px-3 py-1.5 text-xs border border-transparent rounded text-text-muted opacity-30">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
              Prev
            </span>
          )}

          <div className="flex items-center gap-1">
            {generatePageNumbers(page, totalPages).map((p, i) =>
              p === "..." ? (
                <span key={`ellipsis-${i}`} className="px-1 text-[10px] text-text-muted">...</span>
              ) : (
                <Link
                  key={p}
                  href={pageUrl(baseUrl, p as number)}
                  className={`min-w-[28px] h-7 flex items-center justify-center text-[11px] font-mono rounded transition-colors ${
                    p === page
                      ? "bg-accent/15 text-accent border border-accent/30"
                      : "text-text-muted hover:text-text-primary hover:bg-bg-elevated/50 border border-transparent"
                  }`}
                >
                  {p}
                </Link>
              )
            )}
          </div>

          {page < totalPages ? (
            <Link
              href={pageUrl(baseUrl, page + 1)}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs border border-border-default rounded hover:bg-bg-elevated/50 transition-colors text-text-secondary hover:text-text-primary"
            >
              Next
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </Link>
          ) : (
            <span className="inline-flex items-center gap-1 px-3 py-1.5 text-xs border border-transparent rounded text-text-muted opacity-30">
              Next
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
