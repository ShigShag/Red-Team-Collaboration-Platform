import pino from "pino";
import { db } from "@/db";
import { engagementActivityLog } from "@/db/schema";

const logger = pino({ name: "activity-log" });

export type ActivityEventType =
  | "category_created"
  | "category_updated"
  | "category_deleted"
  | "resource_created"
  | "resource_updated"
  | "resource_deleted"
  | "action_created"
  | "action_updated"
  | "action_deleted"
  | "finding_created"
  | "finding_updated"
  | "finding_deleted"
  | "member_joined"
  | "member_removed"
  | "member_role_changed"
  | "member_assigned"
  | "member_unassigned"
  | "engagement_status_changed"
  | "comment_created"
  | "scope_target_added"
  | "scope_target_removed"
  | "scope_exclusion_added"
  | "scope_exclusion_removed"
  | "scope_constraint_added"
  | "scope_constraint_removed"
  | "contact_added"
  | "contact_removed"
  | "scope_document_uploaded"
  | "scope_document_removed"
  | "ai_chat_message"
  | "engagement_exported"
  | "engagement_duplicated"
  | "engagement_imported"
  | "report_qa_requested"
  | "report_qa_comment"
  | "report_qa_resolved"
  | "report_qa_signed_off";

export async function logActivity(params: {
  engagementId: string;
  actorId: string;
  eventType: ActivityEventType;
  metadata: Record<string, string | null>;
}): Promise<void> {
  try {
    await db.insert(engagementActivityLog).values({
      engagementId: params.engagementId,
      actorId: params.actorId,
      eventType: params.eventType,
      metadata: params.metadata,
    });
  } catch (error) {
    logger.error(
      { error, ...params },
      `Failed to persist activity event: ${params.eventType}`
    );
  }
}
