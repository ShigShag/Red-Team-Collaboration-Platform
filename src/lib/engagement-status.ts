export type EngagementStatus =
  | "scoping"
  | "active"
  | "reporting"
  | "closed"
  | "archived";

const ALL_STATUSES: EngagementStatus[] = [
  "scoping",
  "active",
  "reporting",
  "closed",
  "archived",
];

export function isValidStatus(value: string): value is EngagementStatus {
  return ALL_STATUSES.includes(value as EngagementStatus);
}

export function getNextStatuses(
  current: EngagementStatus
): EngagementStatus[] {
  return ALL_STATUSES.filter((s) => s !== current);
}

/** Returns true if commenting is blocked. Only closed/archived block comments. */
export function isCommentLocked(status: EngagementStatus): boolean {
  return status === "closed" || status === "archived";
}

/** Returns true if content writes (resources/actions/findings/categories) are blocked. */
export function isContentLocked(
  status: EngagementStatus,
  isOwner: boolean
): boolean {
  if (status === "reporting") return !isOwner;
  return status === "closed" || status === "archived";
}

/** Returns true if member management (add/remove/role change) is blocked. */
export function isMemberManagementLocked(status: EngagementStatus): boolean {
  return status === "closed" || status === "archived";
}

/** Returns true if engagement settings (name/description/dates) are locked. */
export function isSettingsLocked(status: EngagementStatus): boolean {
  return status === "closed" || status === "archived";
}

export const STATUS_META: Record<
  EngagementStatus,
  {
    label: string;
    color: string;
    bgColor: string;
    borderColor: string;
    description: string;
  }
> = {
  scoping: {
    label: "Scoping",
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/20",
    description:
      "Defining scope, rules of engagement, and setting up the engagement structure.",
  },
  active: {
    label: "Active",
    color: "text-green-400",
    bgColor: "bg-green-500/10",
    borderColor: "border-green-500/20",
    description:
      "Active testing is underway. All team members can create and edit content.",
  },
  reporting: {
    label: "Reporting",
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/20",
    description:
      "Content is locked for report preparation. Owners can still make corrections.",
  },
  closed: {
    label: "Closed",
    color: "text-rose-400",
    bgColor: "bg-rose-500/10",
    borderColor: "border-rose-500/20",
    description:
      "Engagement is finalized. No modifications are allowed.",
  },
  archived: {
    label: "Archived",
    color: "text-purple-400",
    bgColor: "bg-purple-500/10",
    borderColor: "border-purple-500/20",
    description:
      "Archived for long-term storage. Hidden from the active engagement list.",
  },
};
