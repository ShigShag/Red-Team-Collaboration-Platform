export function describeNotification(notification: {
  type: string;
  metadata: Record<string, string | null>;
  actorDisplayName: string | null;
  actorUsername: string | null;
}): { text: string; highlight: string } {
  const actor = notification.actorDisplayName || notification.actorUsername;
  const m = notification.metadata;

  switch (notification.type) {
    case "member_joined":
      return {
        highlight: actor ?? "",
        text: `added you to ${m.engagementName} as ${m.role}`,
      };
    case "member_removed":
      return {
        highlight: actor ?? "",
        text: `removed you from ${m.engagementName}`,
      };
    case "member_role_changed":
      return {
        highlight: actor ?? "",
        text: `changed your role in ${m.engagementName} from ${m.oldRole} to ${m.newRole}`,
      };
    case "member_assigned":
      return {
        highlight: actor ?? "",
        text: `assigned you to ${m.categoryName} in ${m.engagementName}`,
      };
    case "member_unassigned":
      return {
        highlight: actor ?? "",
        text: `unassigned you from ${m.categoryName} in ${m.engagementName}`,
      };
    case "engagement_status_changed":
      return {
        highlight: actor ?? "",
        text: `changed ${m.engagementName} to ${m.newStatus}`,
      };
    case "security_login_success":
      return {
        highlight: "Security",
        text: `New login from ${m.ipAddress ?? "unknown IP"}`,
      };
    case "security_login_failed": {
      const count = m.count ?? "1";
      const plural = count === "1" ? "attempt" : "attempts";
      return {
        highlight: "Security Alert",
        text: `${count} failed login ${plural} on your account`,
      };
    }
    case "security_password_changed":
      return {
        highlight: "Security",
        text: "Your password was changed",
      };
    case "security_totp_enabled":
      return {
        highlight: "Security",
        text: "Two-factor authentication was enabled",
      };
    case "security_session_hijack": {
      const mismatch = m.mismatchType;
      const detail =
        mismatch === "both"
          ? "IP and browser"
          : mismatch === "ip"
            ? "IP address"
            : "browser";
      return {
        highlight: "Security Alert",
        text: `Session terminated: access from unexpected ${detail}`,
      };
    }
    case "comment_mention":
      return {
        highlight: actor ?? "",
        text: `mentioned you in a comment on ${m.targetTitle ?? "an item"} in ${m.engagementName ?? "an engagement"}`,
      };
    case "comment_reply":
      return {
        highlight: actor ?? "",
        text: `replied to your comment on ${m.targetTitle ?? "an item"} in ${m.engagementName ?? "an engagement"}`,
      };
    case "report_qa_requested":
      return {
        highlight: actor ?? "",
        text: `requested QA review on the ${m.engagementName ?? "report"}`,
      };
    case "report_qa_comment":
      return {
        highlight: actor ?? "",
        text: `raised a QA issue on the ${m.sectionLabel ?? "report"} section in ${m.engagementName ?? "an engagement"}`,
      };
    case "report_qa_signed_off":
      return {
        highlight: actor ?? "",
        text: `signed off the report for ${m.engagementName ?? "an engagement"}`,
      };
    default:
      return { highlight: "", text: "New notification" };
  }
}
