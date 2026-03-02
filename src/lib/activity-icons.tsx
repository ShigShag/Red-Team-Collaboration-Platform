import Link from "next/link";
import type { ActivityEvent } from "./activity-helpers";
import { describeEvent } from "./activity-helpers";

export function eventIcon(eventType: string) {
  const c = "w-3 h-3";
  switch (eventType) {
    // Category: folder-plus (created) / folder-minus (deleted)
    case "category_created":
      return (
        <svg className={`${c} text-accent`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 10.5v6m3-3H9m4.06-7.19l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
        </svg>
      );
    case "category_updated":
      return (
        <svg className={`${c} text-accent`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
        </svg>
      );
    case "category_deleted":
      return (
        <svg className={`${c} text-accent/60`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 13.5H9m7.06-7.19l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
        </svg>
      );
    // Resource: document-plus (created) / pencil-square (updated) / document-minus (deleted)
    case "resource_created":
      return (
        <svg className={`${c} text-blue-400`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
      );
    case "resource_updated":
      return (
        <svg className={`${c} text-blue-300`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
        </svg>
      );
    case "resource_deleted":
      return (
        <svg className={`${c} text-blue-400/60`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
      );
    // Action: bolt (created/updated) / bolt-slash (deleted)
    case "action_created":
    case "action_updated":
      return (
        <svg className={`${c} text-amber-400`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
        </svg>
      );
    case "action_deleted":
      return (
        <svg className={`${c} text-amber-400/60`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.412 15.655L9.75 21.75l3.745-4.012M9.257 13.5H3.75l2.659-2.849m2.048-2.194L14.25 2.25 12 10.5h8.25l-4.707 5.043M8.457 8.457L3 3m5.457 5.457l7.086 7.086m0 0L21 21" />
        </svg>
      );
    // Finding: shield-exclamation (created/updated) / shield-dim (deleted) / shield-check (status changed)
    case "finding_created":
    case "finding_updated":
      return (
        <svg className={`${c} text-red-400`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0-10.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285zm0 13.036h.008v.008H12v-.008z" />
        </svg>
      );
    case "finding_deleted":
      return (
        <svg className={`${c} text-red-400/60`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0-10.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285zm0 13.036h.008v.008H12v-.008z" />
        </svg>
      );
    // Member: user-plus (joined) / user-minus (removed) / arrows-right-left (role changed)
    case "member_joined":
      return (
        <svg className={`${c} text-green-400`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
        </svg>
      );
    case "member_removed":
      return (
        <svg className={`${c} text-red-400/70`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M22 10.5h-6m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
        </svg>
      );
    case "member_role_changed":
      return (
        <svg className={`${c} text-green-300`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
        </svg>
      );
    // Assignment: link (assigned) / link-slash (unassigned)
    case "member_assigned":
      return (
        <svg className={`${c} text-purple-400`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-2.54a4.5 4.5 0 00-1.242-7.244l-4.5-4.5a4.5 4.5 0 00-6.364 6.364L5.25 9.503" />
        </svg>
      );
    case "member_unassigned":
      return (
        <svg className={`${c} text-purple-400/60`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.181 8.68a4.503 4.503 0 011.903 6.405m-9.768-2.782L3.56 14.06a4.5 4.5 0 006.364 6.365l3.129-3.129m5.614-5.615l1.757-1.757a4.5 4.5 0 00-6.364-6.365l-3.129 3.129m0 0a4.502 4.502 0 00-3.32 3.321M3 3l18 18" />
        </svg>
      );
    // Engagement status change
    case "engagement_status_changed":
      return (
        <svg className={`${c} text-accent`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
        </svg>
      );
    // Comment: chat bubble
    case "comment_created":
      return (
        <svg className={`${c} text-sky-400`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443 48.282 48.282 0 005.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
        </svg>
      );
    // Report QA: clipboard-check / chat-bubble-left-ellipsis / check-circle / badge-check
    case "report_qa_requested":
      return (
        <svg className={`${c} text-violet-400`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
        </svg>
      );
    case "report_qa_comment":
      return (
        <svg className={`${c} text-violet-300`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
        </svg>
      );
    case "report_qa_resolved":
      return (
        <svg className={`${c} text-violet-400`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case "report_qa_signed_off":
      return (
        <svg className={`${c} text-emerald-300`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
        </svg>
      );
    // Export: arrow-down-tray
    case "engagement_exported":
      return (
        <svg className={`${c} text-emerald-400`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
        </svg>
      );
    default:
      return null;
  }
}

export function renderDescription(event: ActivityEvent) {
  const { text, highlights } = describeEvent(event);
  if (highlights.length === 0) return text;

  const parts: Array<{ text: string; bold: boolean }> = [];
  let remaining = text;

  for (const h of highlights) {
    if (!h) continue;
    const idx = remaining.indexOf(h);
    if (idx === -1) continue;
    if (idx > 0) parts.push({ text: remaining.slice(0, idx), bold: false });
    parts.push({ text: h, bold: true });
    remaining = remaining.slice(idx + h.length);
  }
  if (remaining) parts.push({ text: remaining, bold: false });

  return parts.map((p, i) =>
    p.bold ? (
      <span key={i} className="font-medium text-text-primary">
        {p.text}
      </span>
    ) : (
      <span key={i}>{p.text}</span>
    )
  );
}

function EntityBadge({
  label,
  type,
  href,
}: {
  label: string;
  type: "category" | "resource" | "action" | "finding" | "member";
  href?: string;
}) {
  const colorMap = {
    category: "bg-accent/10 text-accent border-accent/20",
    resource: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    action: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    finding: "bg-red-500/10 text-red-400 border-red-500/20",
    member: "bg-green-500/10 text-green-400 border-green-500/20",
  };
  const base = `inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono rounded border ${colorMap[type]}`;

  if (href) {
    return (
      <Link href={href} scroll={!href.includes("#")} className={`${base} hover:brightness-125 transition-all`}>
        {label}
      </Link>
    );
  }
  return <span className={base}>{label}</span>;
}

export interface LinkContext {
  engagementId: string;
  categoryIds: Set<string>;
}

export function renderLinkedDescription(
  event: ActivityEvent,
  ctx: LinkContext
) {
  const m = event.metadata;
  const eid = ctx.engagementId;
  const categoryHref =
    m.categoryId && ctx.categoryIds.has(m.categoryId)
      ? `/engagements/${eid}/categories/${m.categoryId}`
      : undefined;
  const resourceHref =
    categoryHref && m.resourceId
      ? `${categoryHref}#resource-${m.resourceId}`
      : undefined;
  const actionHref =
    categoryHref && m.actionId
      ? `${categoryHref}#action-${m.actionId}`
      : undefined;
  const findingHref =
    categoryHref && m.findingId
      ? `${categoryHref}#finding-${m.findingId}`
      : undefined;
  const settingsHref = `/engagements/${eid}/settings`;

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
    case "finding_created":
      return (
        <>
          reported finding{" "}
          <EntityBadge label={m.findingTitle ?? "?"} type="finding" href={findingHref} />
          {" "}in{" "}
          <EntityBadge label={m.categoryName ?? "?"} type="category" href={categoryHref} />
        </>
      );
    case "finding_updated":
      return (
        <>
          updated finding{" "}
          <EntityBadge label={m.findingTitle ?? "?"} type="finding" href={findingHref} />
          {" "}in{" "}
          <EntityBadge label={m.categoryName ?? "?"} type="category" href={categoryHref} />
        </>
      );
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
    case "engagement_status_changed":
      return (
        <>
          changed engagement status from{" "}
          <span className="font-mono text-text-primary">{m.oldStatus}</span>
          {" "}to{" "}
          <span className="font-mono text-text-primary">{m.newStatus}</span>
        </>
      );
    case "comment_created": {
      const targetBadgeType = (m.targetType === "finding" ? "finding" : m.targetType === "action" ? "action" : "resource") as "finding" | "action" | "resource";
      return (
        <>
          commented on {m.targetType}{" "}
          <EntityBadge label={m.targetTitle ?? "?"} type={targetBadgeType} />
          {" "}in{" "}
          <EntityBadge label={m.categoryName ?? "?"} type="category" href={categoryHref} />
        </>
      );
    }
    case "engagement_exported": {
      const parts: string[] = [];
      if (m.findingCount && m.findingCount !== "0") parts.push(`${m.findingCount} findings`);
      if (m.actionCount && m.actionCount !== "0") parts.push(`${m.actionCount} actions`);
      if (m.resourceCount && m.resourceCount !== "0") parts.push(`${m.resourceCount} resources`);
      const summary = parts.length > 0 ? ` (${parts.join(", ")})` : "";
      return (
        <>
          exported engagement data
          {summary && <span className="text-text-muted">{summary}</span>}
        </>
      );
    }
    case "report_qa_requested":
      return <>requested QA review on the report</>;
    case "report_qa_comment": {
      const section = m.sectionKey ? m.sectionKey.replace(/_/g, " ") : "the report";
      return (
        <>
          posted a QA comment on{" "}
          <span className="font-mono text-text-primary">{section}</span>
        </>
      );
    }
    case "report_qa_resolved":
      return <>marked a QA comment as resolved</>;
    case "report_qa_signed_off":
      return <>signed off the report after QA review</>;
    default:
      return "performed an action";
  }
}
