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
  categoryFindings,
  categoryActions,
  resources,
  engagementCategories,
} from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { logActivity } from "@/lib/activity-log";
import { createNotification } from "@/lib/notifications";
import {
  requireCommentAccessWithStatus,
  checkCommentWritable,
} from "@/lib/engagement-access";
import { parseMentions, resolveMentionedUsers } from "@/lib/mention-parser";

export type CommentState = {
  error?: string;
  success?: string;
};

const createCommentSchema = z.object({
  engagementId: z.string().uuid(),
  targetType: z.enum(["finding", "action", "resource"]),
  targetId: z.string().uuid(),
  parentId: z.string().uuid().optional(),
  content: z.string().min(1, "Comment cannot be empty").max(10_000),
  contentFormat: z.enum(["text", "markdown"]).default("markdown"),
});

const updateCommentSchema = z.object({
  commentId: z.string().uuid(),
  engagementId: z.string().uuid(),
  content: z.string().min(1, "Comment cannot be empty").max(10_000),
  contentFormat: z.enum(["text", "markdown"]).default("markdown"),
});

const deleteCommentSchema = z.object({
  commentId: z.string().uuid(),
  engagementId: z.string().uuid(),
});

/** Look up the title of the target entity (finding/action/resource) */
async function getTargetTitle(
  targetType: string,
  targetId: string
): Promise<string> {
  if (targetType === "finding") {
    const [row] = await db
      .select({ title: categoryFindings.title })
      .from(categoryFindings)
      .where(eq(categoryFindings.id, targetId))
      .limit(1);
    return row?.title ?? "a finding";
  }
  if (targetType === "action") {
    const [row] = await db
      .select({ title: categoryActions.title })
      .from(categoryActions)
      .where(eq(categoryActions.id, targetId))
      .limit(1);
    return row?.title ?? "an action";
  }
  if (targetType === "resource") {
    const [row] = await db
      .select({ name: resources.name })
      .from(resources)
      .where(eq(resources.id, targetId))
      .limit(1);
    return row?.name ?? "a resource";
  }
  return "an item";
}

/** Look up the category info for a target entity */
async function getTargetCategoryInfo(
  targetType: string,
  targetId: string
): Promise<{ categoryId: string; categoryName: string } | null> {
  if (targetType === "finding") {
    const [row] = await db
      .select({
        categoryId: categoryFindings.categoryId,
        categoryName: engagementCategories.name,
      })
      .from(categoryFindings)
      .innerJoin(
        engagementCategories,
        eq(categoryFindings.categoryId, engagementCategories.id)
      )
      .where(eq(categoryFindings.id, targetId))
      .limit(1);
    return row ?? null;
  }
  if (targetType === "action") {
    const [row] = await db
      .select({
        categoryId: categoryActions.categoryId,
        categoryName: engagementCategories.name,
      })
      .from(categoryActions)
      .innerJoin(
        engagementCategories,
        eq(categoryActions.categoryId, engagementCategories.id)
      )
      .where(eq(categoryActions.id, targetId))
      .limit(1);
    return row ?? null;
  }
  if (targetType === "resource") {
    const [row] = await db
      .select({
        categoryId: resources.categoryId,
        categoryName: engagementCategories.name,
      })
      .from(resources)
      .innerJoin(
        engagementCategories,
        eq(resources.categoryId, engagementCategories.id)
      )
      .where(eq(resources.id, targetId))
      .limit(1);
    return row ?? null;
  }
  return null;
}

export async function createComment(
  _prev: CommentState,
  formData: FormData
): Promise<CommentState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const raw = {
    engagementId: formData.get("engagementId") as string,
    targetType: formData.get("targetType") as string,
    targetId: formData.get("targetId") as string,
    parentId: (formData.get("parentId") as string) || undefined,
    content: formData.get("content") as string,
    contentFormat: (formData.get("contentFormat") as string) || "markdown",
  };

  const parsed = createCommentSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const access = await requireCommentAccessWithStatus(
    parsed.data.engagementId,
    session.userId
  );
  if (!access) return { error: "You must be a member of this engagement to comment" };
  const lockError = checkCommentWritable(access);
  if (lockError) return { error: lockError };

  // If replying, verify parent exists, is top-level, and targets the same entity
  if (parsed.data.parentId) {
    const [parent] = await db
      .select({
        id: comments.id,
        parentId: comments.parentId,
        targetType: comments.targetType,
        targetId: comments.targetId,
        authorId: comments.authorId,
      })
      .from(comments)
      .where(eq(comments.id, parsed.data.parentId))
      .limit(1);

    if (!parent) return { error: "Parent comment not found" };
    if (parent.parentId !== null)
      return { error: "Cannot reply to a reply" };
    if (
      parent.targetType !== parsed.data.targetType ||
      parent.targetId !== parsed.data.targetId
    )
      return { error: "Reply must be on the same target" };
  }

  const [newComment] = await db
    .insert(comments)
    .values({
      engagementId: parsed.data.engagementId,
      targetType: parsed.data.targetType,
      targetId: parsed.data.targetId,
      parentId: parsed.data.parentId ?? null,
      authorId: session.userId,
      content: parsed.data.content,
      contentFormat: parsed.data.contentFormat,
    })
    .returning({ id: comments.id });

  // Get engagement name for notifications
  const [engagement] = await db
    .select({ name: engagements.name })
    .from(engagements)
    .where(eq(engagements.id, parsed.data.engagementId))
    .limit(1);

  const targetTitle = await getTargetTitle(
    parsed.data.targetType,
    parsed.data.targetId
  );

  // Resolve category for deep-linking in notifications
  const categoryInfo = await getTargetCategoryInfo(
    parsed.data.targetType,
    parsed.data.targetId
  );

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
          targetTitle,
          engagementName: engagement?.name ?? null,
          commentId: newComment.id,
          targetType: parsed.data.targetType,
          targetId: parsed.data.targetId,
          categoryId: categoryInfo?.categoryId ?? null,
        },
      });
    }
  }

  // Notify parent comment author if this is a reply
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
          targetTitle,
          engagementName: engagement?.name ?? null,
          commentId: newComment.id,
          targetType: parsed.data.targetType,
          targetId: parsed.data.targetId,
          categoryId: categoryInfo?.categoryId ?? null,
        },
      });
    }
  }

  // Log activity

  await logActivity({
    engagementId: parsed.data.engagementId,
    actorId: session.userId,
    eventType: "comment_created",
    metadata: {
      targetType: parsed.data.targetType,
      targetTitle,
      categoryName: categoryInfo?.categoryName ?? null,
      categoryId: categoryInfo?.categoryId ?? null,
      commentId: newComment.id,
    },
  });

  revalidatePath(`/engagements/${parsed.data.engagementId}`);
  if (categoryInfo) {
    revalidatePath(
      `/engagements/${parsed.data.engagementId}/categories/${categoryInfo.categoryId}`
    );
  }
  return { success: "Comment added" };
}

export async function updateComment(
  _prev: CommentState,
  formData: FormData
): Promise<CommentState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const raw = {
    commentId: formData.get("commentId") as string,
    engagementId: formData.get("engagementId") as string,
    content: formData.get("content") as string,
    contentFormat: (formData.get("contentFormat") as string) || "markdown",
  };

  const parsed = updateCommentSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const access = await requireCommentAccessWithStatus(
    parsed.data.engagementId,
    session.userId
  );
  if (!access) return { error: "You must be a member of this engagement to edit comments" };
  const lockError = checkCommentWritable(access);
  if (lockError) return { error: lockError };

  // Verify comment exists and check ownership
  const [comment] = await db
    .select({
      id: comments.id,
      authorId: comments.authorId,
      deletedAt: comments.deletedAt,
      targetType: comments.targetType,
      targetId: comments.targetId,
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
  if (comment.deletedAt) return { error: "Cannot edit a deleted comment" };

  // Only author or engagement owner can edit
  if (comment.authorId !== session.userId && access.role !== "owner") {
    return { error: "You can only edit your own comments" };
  }

  // Get old mentions to diff
  const [oldComment] = await db
    .select({ content: comments.content })
    .from(comments)
    .where(eq(comments.id, parsed.data.commentId))
    .limit(1);
  const oldMentions = new Set(parseMentions(oldComment?.content ?? ""));

  await db
    .update(comments)
    .set({
      content: parsed.data.content,
      contentFormat: parsed.data.contentFormat,
      editedAt: new Date(),
    })
    .where(eq(comments.id, parsed.data.commentId));

  // Notify only *newly* mentioned users
  const newMentionedUsernames = parseMentions(parsed.data.content).filter(
    (u) => !oldMentions.has(u)
  );
  if (newMentionedUsernames.length > 0) {
    const [engagement] = await db
      .select({ name: engagements.name })
      .from(engagements)
      .where(eq(engagements.id, parsed.data.engagementId))
      .limit(1);

    const targetTitle = await getTargetTitle(
      comment.targetType,
      comment.targetId
    );
    const catInfo = await getTargetCategoryInfo(
      comment.targetType,
      comment.targetId
    );
    const mentionedUsers = await resolveMentionedUsers(
      newMentionedUsernames,
      parsed.data.engagementId
    );
    for (const user of mentionedUsers) {
      await createNotification({
        userId: user.id,
        type: "comment_mention",
        engagementId: parsed.data.engagementId,
        actorId: session.userId,
        metadata: {
          targetTitle,
          engagementName: engagement?.name ?? null,
          commentId: parsed.data.commentId,
          targetType: comment.targetType,
          targetId: comment.targetId,
          categoryId: catInfo?.categoryId ?? null,
        },
      });
    }
  }

  revalidatePath(`/engagements/${parsed.data.engagementId}`);
  return { success: "Comment updated" };
}

export async function deleteComment(
  _prev: CommentState,
  formData: FormData
): Promise<CommentState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const raw = {
    commentId: formData.get("commentId") as string,
    engagementId: formData.get("engagementId") as string,
  };

  const parsed = deleteCommentSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const access = await requireCommentAccessWithStatus(
    parsed.data.engagementId,
    session.userId
  );
  if (!access) return { error: "You must be a member of this engagement to delete comments" };
  const lockError = checkCommentWritable(access);
  if (lockError) return { error: lockError };

  // Verify comment exists
  const [comment] = await db
    .select({
      id: comments.id,
      authorId: comments.authorId,
      deletedAt: comments.deletedAt,
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
  if (comment.deletedAt) return { error: "Comment already deleted" };

  // Only author or engagement owner can delete
  if (comment.authorId !== session.userId && access.role !== "owner") {
    return { error: "You can only delete your own comments" };
  }

  // Soft-delete
  await db
    .update(comments)
    .set({ deletedAt: new Date() })
    .where(eq(comments.id, parsed.data.commentId));

  revalidatePath(`/engagements/${parsed.data.engagementId}`);
  return { success: "Comment deleted" };
}
