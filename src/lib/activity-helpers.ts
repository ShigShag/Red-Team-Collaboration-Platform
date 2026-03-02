export interface ActivityEvent {
  id: string;
  eventType: string;
  metadata: Record<string, string | null>;
  createdAt: Date;
  actorId: string;
  actorUsername: string;
  actorDisplayName: string | null;
  actorAvatarPath: string | null;
  engagementId?: string;
  engagementName?: string;
}

export function describeEvent(event: ActivityEvent): { text: string; highlights: string[] } {
  const m = event.metadata;
  switch (event.eventType) {
    case "category_created":
      return { text: `created category ${m.categoryName}`, highlights: [m.categoryName ?? ""] };
    case "category_updated":
      return m.oldName
        ? { text: `renamed category ${m.oldName} to ${m.categoryName}`, highlights: [m.oldName ?? "", m.categoryName ?? ""] }
        : { text: `updated category ${m.categoryName}`, highlights: [m.categoryName ?? ""] };
    case "category_deleted":
      return { text: `deleted category ${m.categoryName}`, highlights: [m.categoryName ?? ""] };
    case "resource_created":
      return {
        text: `added resource ${m.resourceName} to ${m.categoryName}`,
        highlights: [m.resourceName ?? "", m.categoryName ?? ""],
      };
    case "resource_updated":
      return {
        text: `updated resource ${m.resourceName} in ${m.categoryName}`,
        highlights: [m.resourceName ?? "", m.categoryName ?? ""],
      };
    case "resource_deleted":
      return {
        text: `removed resource ${m.resourceName} from ${m.categoryName}`,
        highlights: [m.resourceName ?? "", m.categoryName ?? ""],
      };
    case "action_created":
      return {
        text: `logged action ${m.actionTitle} in ${m.categoryName}`,
        highlights: [m.actionTitle ?? "", m.categoryName ?? ""],
      };
    case "action_updated":
      return {
        text: `updated action ${m.actionTitle} in ${m.categoryName}`,
        highlights: [m.actionTitle ?? "", m.categoryName ?? ""],
      };
    case "action_deleted":
      return {
        text: `removed action ${m.actionTitle} from ${m.categoryName}`,
        highlights: [m.actionTitle ?? "", m.categoryName ?? ""],
      };
    case "finding_created":
      return {
        text: `reported finding ${m.findingTitle} in ${m.categoryName}`,
        highlights: [m.findingTitle ?? "", m.categoryName ?? ""],
      };
    case "finding_updated":
      return {
        text: `updated finding ${m.findingTitle} in ${m.categoryName}`,
        highlights: [m.findingTitle ?? "", m.categoryName ?? ""],
      };
    case "finding_deleted":
      return {
        text: `removed finding ${m.findingTitle} from ${m.categoryName}`,
        highlights: [m.findingTitle ?? "", m.categoryName ?? ""],
      };
    case "member_joined": {
      const name = m.targetDisplayName || m.targetUsername;
      return { text: `added ${name} as ${m.role}`, highlights: [name ?? ""] };
    }
    case "member_removed": {
      const name = m.targetDisplayName || m.targetUsername;
      return { text: `removed ${name} from the engagement`, highlights: [name ?? ""] };
    }
    case "member_role_changed": {
      const name = m.targetDisplayName || m.targetUsername;
      return {
        text: `changed ${name}'s role from ${m.oldRole} to ${m.newRole}`,
        highlights: [name ?? ""],
      };
    }
    case "member_assigned": {
      const name = m.targetDisplayName || m.targetUsername;
      return {
        text: `assigned ${name} to ${m.categoryName}`,
        highlights: [name ?? "", m.categoryName ?? ""],
      };
    }
    case "member_unassigned": {
      const name = m.targetDisplayName || m.targetUsername;
      return {
        text: `unassigned ${name} from ${m.categoryName}`,
        highlights: [name ?? "", m.categoryName ?? ""],
      };
    }
    case "engagement_status_changed":
      return {
        text: `changed engagement status from ${m.oldStatus} to ${m.newStatus}`,
        highlights: [m.oldStatus ?? "", m.newStatus ?? ""],
      };
    case "comment_created":
      return {
        text: `commented on ${m.targetType ?? ""} ${m.targetTitle ?? ""} in ${m.categoryName ?? ""}`,
        highlights: [m.targetTitle ?? "", m.categoryName ?? ""],
      };
    case "scope_target_added":
      return {
        text: `added ${m.targetType ?? ""} ${m.targetValue ?? ""} to scope`,
        highlights: [m.targetValue ?? ""],
      };
    case "scope_target_removed":
      return {
        text: `removed ${m.targetType ?? ""} ${m.targetValue ?? ""} from scope`,
        highlights: [m.targetValue ?? ""],
      };
    case "scope_exclusion_added":
      return {
        text: `added ${m.targetType ?? ""} ${m.targetValue ?? ""} as scope exclusion`,
        highlights: [m.targetValue ?? ""],
      };
    case "scope_exclusion_removed":
      return {
        text: `removed ${m.targetType ?? ""} ${m.targetValue ?? ""} from exclusions`,
        highlights: [m.targetValue ?? ""],
      };
    case "scope_constraint_added":
      return {
        text: `added constraint: ${m.constraintText ?? ""}`,
        highlights: [m.constraintText ?? ""],
      };
    case "scope_constraint_removed":
      return {
        text: `removed constraint: ${m.constraintText ?? ""}`,
        highlights: [m.constraintText ?? ""],
      };
    case "contact_added":
      return {
        text: `added contact ${m.contactName ?? ""}`,
        highlights: [m.contactName ?? ""],
      };
    case "contact_removed":
      return {
        text: `removed contact ${m.contactName ?? ""}`,
        highlights: [m.contactName ?? ""],
      };
    case "scope_document_uploaded":
      return {
        text: `uploaded ${m.documentType ?? ""} document: ${m.documentName ?? ""}`,
        highlights: [m.documentName ?? ""],
      };
    case "scope_document_removed":
      return {
        text: `removed ${m.documentType ?? ""} document: ${m.documentName ?? ""}`,
        highlights: [m.documentName ?? ""],
      };
    case "engagement_exported": {
      const parts: string[] = [];
      if (m.findingCount && m.findingCount !== "0") parts.push(`${m.findingCount} findings`);
      if (m.actionCount && m.actionCount !== "0") parts.push(`${m.actionCount} actions`);
      if (m.resourceCount && m.resourceCount !== "0") parts.push(`${m.resourceCount} resources`);
      const summary = parts.length > 0 ? ` (${parts.join(", ")})` : "";
      return { text: `exported engagement data${summary}`, highlights: [] };
    }
    case "report_qa_requested":
      return { text: `requested QA review on the report`, highlights: [] };
    case "report_qa_comment": {
      const section = m.sectionKey ? m.sectionKey.replace(/_/g, " ") : "the report";
      return { text: `posted a QA comment on ${section}`, highlights: [section] };
    }
    case "report_qa_resolved":
      return { text: `marked a QA comment as resolved`, highlights: [] };
    case "report_qa_signed_off":
      return { text: `signed off the report after QA review`, highlights: [] };
    default:
      return { text: "performed an action", highlights: [] };
  }
}

export function describeEventText(event: ActivityEvent): string {
  return describeEvent(event).text;
}

export function formatRelativeTime(date: Date): string {
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 30) return `${diffDay}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function formatDayHeader(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const eventDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.floor((today.getTime() - eventDay.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export function groupByDay(events: ActivityEvent[]): Map<string, ActivityEvent[]> {
  const groups = new Map<string, ActivityEvent[]>();
  for (const event of events) {
    const key = new Date(
      event.createdAt.getFullYear(),
      event.createdAt.getMonth(),
      event.createdAt.getDate()
    ).toISOString();
    const group = groups.get(key);
    if (group) {
      group.push(event);
    } else {
      groups.set(key, [event]);
    }
  }
  return groups;
}
