import { db } from "@/db";
import { notifications } from "@/db/schema";

export type NotificationType =
  | "member_joined"
  | "member_removed"
  | "member_role_changed"
  | "member_assigned"
  | "member_unassigned"
  | "security_login_success"
  | "security_login_failed"
  | "security_password_changed"
  | "security_totp_enabled"
  | "engagement_status_changed"
  | "comment_mention"
  | "comment_reply"
  | "report_qa_requested"
  | "report_qa_comment"
  | "report_qa_signed_off";

export async function createNotification(params: {
  userId: string;
  type: NotificationType;
  engagementId?: string | null;
  actorId?: string | null;
  metadata: Record<string, string | null>;
}): Promise<void> {
  // Never notify the actor about their own action
  if (params.actorId && params.userId === params.actorId) return;

  try {
    await db.insert(notifications).values({
      userId: params.userId,
      type: params.type,
      engagementId: params.engagementId ?? null,
      actorId: params.actorId ?? null,
      metadata: params.metadata,
    });
  } catch (error) {
    console.error("[notifications] Failed to create notification:", error);
  }
}
