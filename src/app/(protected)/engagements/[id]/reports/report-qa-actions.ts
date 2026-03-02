"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq, and, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  comments,
  engagements,
  engagementMembers,
  reportConfigs,
} from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { logActivity } from "@/lib/activity-log";
import { createNotification } from "@/lib/notifications";
import {
  requireCommentAccessWithStatus,
  checkCommentWritable,
} from "@/lib/engagement-access";
import { parseMentions, resolveMentionedUsers } from "@/lib/mention-parser";

export type QAActionState = {
  error?: string;
  success?: string;
};

const createQACommentSchema = z.object({
  engagementId: z.string().uuid(),
  reportConfigId: z.string().uuid(),
  sectionKey: z.string().min(1).max(100),
  fieldPath: z.string().max(255).optional(),
  parentId: z.string().uuid().optional(),
  content: z.string().min(1, "Comment cannot be empty").max(10_000),
  contentFormat: z.enum(["text", "markdown"]).default("markdown"),
});

const updateQAStatusSchema = z.object({
  commentId: z.string().uuid(),
  engagementId: z.string().uuid(),
  newStatus: z.enum(["open", "resolved", "approved"]),
});

const requestQASchema = z.object({
  engagementId: z.string().uuid(),
  reportConfigId: z.string().uuid(),
});

const signOffSchema = z.object({
  engagementId: z.string().uuid(),
  reportConfigId: z.string().uuid(),
});

/** Fetch all engagement members except the actor for broadcasting notifications */
async function getOtherMembers(
  engagementId: string,
  actorId: string
): Promise<string[]> {
  const members = await db
    .select({ userId: engagementMembers.userId })
    .from(engagementMembers)
    .where(eq(engagementMembers.engagementId, engagementId));
  return members.map((m) => m.userId).filter((id) => id !== actorId);
}

/**
 * Post a QA comment on a specific section of a report.
 * All engagement members (any role) may post QA comments when QA is active.
 */
export async function createQAComment(
  _prev: QAActionState,
  formData: FormData
): Promise<QAActionState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const raw = {
    engagementId: formData.get("engagementId") as string,
    reportConfigId: formData.get("reportConfigId") as string,
    sectionKey: formData.get("sectionKey") as string,
    fieldPath: (formData.get("fieldPath") as string) || undefined,
    parentId: (formData.get("parentId") as string) || undefined,
    content: formData.get("content") as string,
    contentFormat: (formData.get("contentFormat") as string) || "markdown",
  };

  const parsed = createQACommentSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const access = await requireCommentAccessWithStatus(
    parsed.data.engagementId,
    session.userId
  );
  if (!access)
    return { error: "You must be a member of this engagement to comment" };
  const lockError = checkCommentWritable(access);
  if (lockError) return { error: lockError };

  // Verify QA has been requested on this report config
  const [config] = await db
    .select({ id: reportConfigs.id, qaRequestedAt: reportConfigs.qaRequestedAt })
    .from(reportConfigs)
    .where(
      and(
        eq(reportConfigs.id, parsed.data.reportConfigId),
        eq(reportConfigs.engagementId, parsed.data.engagementId)
      )
    )
    .limit(1);

  if (!config) return { error: "Report not found" };
  if (!config.qaRequestedAt) {
    return { error: "QA review has not been requested for this report yet" };
  }

  // If replying, verify parent is a top-level QA comment on the same config
  if (parsed.data.parentId) {
    const [parent] = await db
      .select({
        id: comments.id,
        parentId: comments.parentId,
        targetId: comments.targetId,
      })
      .from(comments)
      .where(eq(comments.id, parsed.data.parentId))
      .limit(1);

    if (!parent) return { error: "Parent comment not found" };
    if (parent.parentId !== null) return { error: "Cannot reply to a reply" };
    if (parent.targetId !== parsed.data.reportConfigId) {
      return { error: "Reply must be on the same report" };
    }
  }

  const [newComment] = await db
    .insert(comments)
    .values({
      engagementId: parsed.data.engagementId,
      targetType: "report_section",
      targetId: parsed.data.reportConfigId,
      parentId: parsed.data.parentId ?? null,
      authorId: session.userId,
      content: parsed.data.content,
      contentFormat: parsed.data.contentFormat,
      qaStatus: parsed.data.parentId ? null : "open",
      sectionKey: parsed.data.sectionKey,
      fieldPath: parsed.data.fieldPath ?? null,
    })
    .returning({ id: comments.id });

  const [engagement] = await db
    .select({ name: engagements.name })
    .from(engagements)
    .where(eq(engagements.id, parsed.data.engagementId))
    .limit(1);

  const engagementName = engagement?.name ?? null;
  const sectionLabel = parsed.data.sectionKey.replace(/_/g, " ");

  // Notify all other members of the new QA comment
  const otherMembers = await getOtherMembers(
    parsed.data.engagementId,
    session.userId
  );
  for (const userId of otherMembers) {
    await createNotification({
      userId,
      type: "report_qa_comment",
      engagementId: parsed.data.engagementId,
      actorId: session.userId,
      metadata: {
        engagementName,
        sectionLabel,
        sectionKey: parsed.data.sectionKey,
        fieldPath: parsed.data.fieldPath ?? null,
        commentId: newComment.id,
        reportConfigId: parsed.data.reportConfigId,
      },
    });
  }

  // Parse @mentions and notify
  const mentionedUsernames = parseMentions(parsed.data.content);
  if (mentionedUsernames.length > 0) {
    const mentionedUsers = await resolveMentionedUsers(
      mentionedUsernames,
      parsed.data.engagementId
    );
    for (const user of mentionedUsers) {
      await createNotification({
        userId: user.id,
        type: "comment_mention",
        engagementId: parsed.data.engagementId,
        actorId: session.userId,
        metadata: {
          targetTitle: `${sectionLabel} section`,
          engagementName,
          commentId: newComment.id,
          targetType: "report_section",
          targetId: parsed.data.reportConfigId,
          categoryId: null,
        },
      });
    }
  }

  // Notify parent author on reply
  if (parsed.data.parentId) {
    const [parent] = await db
      .select({ authorId: comments.authorId })
      .from(comments)
      .where(eq(comments.id, parsed.data.parentId))
      .limit(1);

    if (parent) {
      await createNotification({
        userId: parent.authorId,
        type: "comment_reply",
        engagementId: parsed.data.engagementId,
        actorId: session.userId,
        metadata: {
          targetTitle: `${sectionLabel} section`,
          engagementName,
          commentId: newComment.id,
          targetType: "report_section",
          targetId: parsed.data.reportConfigId,
          categoryId: null,
        },
      });
    }
  }

  await logActivity({
    engagementId: parsed.data.engagementId,
    actorId: session.userId,
    eventType: "report_qa_comment",
    metadata: {
      sectionKey: parsed.data.sectionKey,
      fieldPath: parsed.data.fieldPath ?? null,
      commentId: newComment.id,
      reportConfigId: parsed.data.reportConfigId,
      engagementName,
    },
  });

  revalidatePath(`/engagements/${parsed.data.engagementId}/reports`);
  return { success: "QA comment posted" };
}

/**
 * Update the status of a QA comment (open → resolved → approved, or reopen).
 * - resolved: comment author or owner
 * - approved: any member
 * - open (reopen): any member
 */
export async function updateQACommentStatus(
  _prev: QAActionState,
  formData: FormData
): Promise<QAActionState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const raw = {
    commentId: formData.get("commentId") as string,
    engagementId: formData.get("engagementId") as string,
    newStatus: formData.get("newStatus") as string,
  };

  const parsed = updateQAStatusSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const access = await requireCommentAccessWithStatus(
    parsed.data.engagementId,
    session.userId
  );
  if (!access) return { error: "You must be a member of this engagement" };
  const lockError = checkCommentWritable(access);
  if (lockError) return { error: lockError };

  const [comment] = await db
    .select({
      id: comments.id,
      authorId: comments.authorId,
      deletedAt: comments.deletedAt,
      qaStatus: comments.qaStatus,
      targetId: comments.targetId,
      engagementId: comments.engagementId,
    })
    .from(comments)
    .where(
      and(
        eq(comments.id, parsed.data.commentId),
        eq(comments.engagementId, parsed.data.engagementId)
      )
    )
    .limit(1);

  if (!comment) return { error: "Comment not found" };
  if (comment.deletedAt) return { error: "Cannot update a deleted comment" };

  // Permission check for "resolved" transition
  if (parsed.data.newStatus === "resolved") {
    if (comment.authorId !== session.userId && access.role !== "owner") {
      return { error: "Only the comment author or an owner can mark as resolved" };
    }
  }

  const now = new Date();
  const updates: Record<string, string | Date | null> = {
    qaStatus: parsed.data.newStatus,
  };

  if (parsed.data.newStatus === "resolved") {
    updates.qaResolvedAt = now;
    updates.qaResolvedBy = session.userId;
    updates.qaApprovedAt = null;
    updates.qaApprovedBy = null;
  } else if (parsed.data.newStatus === "approved") {
    updates.qaApprovedAt = now;
    updates.qaApprovedBy = session.userId;
  } else if (parsed.data.newStatus === "open") {
    updates.qaResolvedAt = null;
    updates.qaResolvedBy = null;
    updates.qaApprovedAt = null;
    updates.qaApprovedBy = null;
  }

  await db
    .update(comments)
    .set(updates)
    .where(eq(comments.id, parsed.data.commentId));

  if (parsed.data.newStatus === "resolved") {
    await logActivity({
      engagementId: parsed.data.engagementId,
      actorId: session.userId,
      eventType: "report_qa_resolved",
      metadata: {
        commentId: parsed.data.commentId,
        reportConfigId: comment.targetId,
        newStatus: parsed.data.newStatus,
      },
    });
  }

  revalidatePath(`/engagements/${parsed.data.engagementId}/reports`);
  return { success: "Status updated" };
}

/**
 * Owner requests QA review — sets qaRequestedAt, notifies all members.
 */
export async function requestReportQA(
  _prev: QAActionState,
  formData: FormData
): Promise<QAActionState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const raw = {
    engagementId: formData.get("engagementId") as string,
    reportConfigId: formData.get("reportConfigId") as string,
  };

  const parsed = requestQASchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const access = await requireCommentAccessWithStatus(
    parsed.data.engagementId,
    session.userId
  );
  if (!access) return { error: "You must be a member of this engagement" };
  if (access.role !== "owner") {
    return { error: "Only owners can request QA review" };
  }
  const lockError = checkCommentWritable(access);
  if (lockError) return { error: lockError };

  const [config] = await db
    .select({ id: reportConfigs.id })
    .from(reportConfigs)
    .where(
      and(
        eq(reportConfigs.id, parsed.data.reportConfigId),
        eq(reportConfigs.engagementId, parsed.data.engagementId)
      )
    )
    .limit(1);

  if (!config) return { error: "Report not found" };

  await db
    .update(reportConfigs)
    .set({
      qaRequestedAt: new Date(),
      qaSignedOffAt: null,
      qaSignedOffBy: null,
    })
    .where(eq(reportConfigs.id, parsed.data.reportConfigId));

  const [engagement] = await db
    .select({ name: engagements.name })
    .from(engagements)
    .where(eq(engagements.id, parsed.data.engagementId))
    .limit(1);

  const engagementName = engagement?.name ?? null;

  const otherMembers = await getOtherMembers(
    parsed.data.engagementId,
    session.userId
  );
  for (const userId of otherMembers) {
    await createNotification({
      userId,
      type: "report_qa_requested",
      engagementId: parsed.data.engagementId,
      actorId: session.userId,
      metadata: { engagementName, reportConfigId: parsed.data.reportConfigId },
    });
  }

  await logActivity({
    engagementId: parsed.data.engagementId,
    actorId: session.userId,
    eventType: "report_qa_requested",
    metadata: {
      reportConfigId: parsed.data.reportConfigId,
      engagementName,
    },
  });

  revalidatePath(`/engagements/${parsed.data.engagementId}/reports`);
  return { success: "QA review requested — team has been notified" };
}

/**
 * Owner signs off the report — sets qaSignedOffAt, notifies all members.
 */
export async function signOffReport(
  _prev: QAActionState,
  formData: FormData
): Promise<QAActionState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const raw = {
    engagementId: formData.get("engagementId") as string,
    reportConfigId: formData.get("reportConfigId") as string,
  };

  const parsed = signOffSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const access = await requireCommentAccessWithStatus(
    parsed.data.engagementId,
    session.userId
  );
  if (!access) return { error: "You must be a member of this engagement" };
  if (access.role !== "owner") {
    return { error: "Only owners can sign off the report" };
  }

  await db
    .update(reportConfigs)
    .set({
      qaSignedOffAt: new Date(),
      qaSignedOffBy: session.userId,
    })
    .where(eq(reportConfigs.id, parsed.data.reportConfigId));

  const [engagement] = await db
    .select({ name: engagements.name })
    .from(engagements)
    .where(eq(engagements.id, parsed.data.engagementId))
    .limit(1);

  const engagementName = engagement?.name ?? null;

  const otherMembers = await getOtherMembers(
    parsed.data.engagementId,
    session.userId
  );
  for (const userId of otherMembers) {
    await createNotification({
      userId,
      type: "report_qa_signed_off",
      engagementId: parsed.data.engagementId,
      actorId: session.userId,
      metadata: { engagementName, reportConfigId: parsed.data.reportConfigId },
    });
  }

  await logActivity({
    engagementId: parsed.data.engagementId,
    actorId: session.userId,
    eventType: "report_qa_signed_off",
    metadata: {
      reportConfigId: parsed.data.reportConfigId,
      engagementName,
    },
  });

  revalidatePath(`/engagements/${parsed.data.engagementId}/reports`);
  return { success: "Report signed off" };
}

/**
 * Delete a QA comment (soft-delete). Author or owner only.
 */
export async function deleteQAComment(
  _prev: QAActionState,
  formData: FormData
): Promise<QAActionState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const engagementId = formData.get("engagementId") as string;
  const commentId = formData.get("commentId") as string;

  if (
    !engagementId ||
    !commentId ||
    !/^[0-9a-f-]{36}$/.test(engagementId) ||
    !/^[0-9a-f-]{36}$/.test(commentId)
  ) {
    return { error: "Invalid input" };
  }

  const access = await requireCommentAccessWithStatus(engagementId, session.userId);
  if (!access) return { error: "You must be a member of this engagement" };
  const lockError = checkCommentWritable(access);
  if (lockError) return { error: lockError };

  const [comment] = await db
    .select({ id: comments.id, authorId: comments.authorId, deletedAt: comments.deletedAt })
    .from(comments)
    .where(and(eq(comments.id, commentId), eq(comments.engagementId, engagementId)))
    .limit(1);

  if (!comment) return { error: "Comment not found" };
  if (comment.deletedAt) return { error: "Comment already deleted" };
  if (comment.authorId !== session.userId && access.role !== "owner") {
    return { error: "You can only delete your own comments" };
  }

  await db.update(comments).set({ deletedAt: new Date() }).where(eq(comments.id, commentId));

  revalidatePath(`/engagements/${engagementId}/reports`);
  return { success: "Comment deleted" };
}
