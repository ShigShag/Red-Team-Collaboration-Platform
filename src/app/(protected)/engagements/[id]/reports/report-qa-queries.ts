import { eq, and, isNull, asc, sql } from "drizzle-orm";
import { db } from "@/db";
import { comments, users } from "@/db/schema";

export interface QACommentAuthor {
  id: string;
  username: string;
  displayName: string | null;
  avatarPath: string | null;
}

export interface QACommentData {
  id: string;
  sectionKey: string;
  fieldPath: string | null;
  qaStatus: "open" | "resolved" | "approved";
  authorId: string;
  author: QACommentAuthor;
  content: string | null;
  contentFormat: string;
  editedAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  qaResolvedAt: Date | null;
  qaResolvedByUsername: string | null;
  qaApprovedAt: Date | null;
  qaApprovedByUsername: string | null;
  replies: QACommentData[];
}

/**
 * Fetch all QA comments for a report config, threaded and grouped by sectionKey.
 * Returns a Map keyed by sectionKey.
 */
export async function getQACommentsForReport(
  reportConfigId: string,
  engagementId: string
): Promise<Map<string, QACommentData[]>> {
  const result = new Map<string, QACommentData[]>();

  const resolvedUsers = db
    .select({ id: users.id, username: users.username })
    .from(users)
    .as("resolved_users");

  const approvedUsers = db
    .select({ id: users.id, username: users.username })
    .from(users)
    .as("approved_users");

  const rows = await db
    .select({
      id: comments.id,
      sectionKey: comments.sectionKey,
      fieldPath: comments.fieldPath,
      qaStatus: comments.qaStatus,
      parentId: comments.parentId,
      authorId: comments.authorId,
      content: comments.content,
      contentFormat: comments.contentFormat,
      editedAt: comments.editedAt,
      deletedAt: comments.deletedAt,
      createdAt: comments.createdAt,
      qaResolvedAt: comments.qaResolvedAt,
      qaApprovedAt: comments.qaApprovedAt,
      authorUsername: users.username,
      authorDisplayName: users.displayName,
      authorAvatarPath: users.avatarPath,
      qaResolvedByUsername: resolvedUsers.username,
      qaApprovedByUsername: approvedUsers.username,
    })
    .from(comments)
    .innerJoin(users, eq(comments.authorId, users.id))
    .leftJoin(resolvedUsers, eq(comments.qaResolvedBy, resolvedUsers.id))
    .leftJoin(approvedUsers, eq(comments.qaApprovedBy, approvedUsers.id))
    .where(
      and(
        eq(comments.engagementId, engagementId),
        eq(comments.targetType, "report_section"),
        eq(comments.targetId, reportConfigId)
      )
    )
    .orderBy(asc(comments.createdAt));

  const commentMap = new Map<string, QACommentData>();
  const topLevelBySection = new Map<string, QACommentData[]>();

  for (const row of rows) {
    const sectionKey = row.sectionKey ?? "general";
    const comment: QACommentData = {
      id: row.id,
      sectionKey,
      fieldPath: row.fieldPath,
      qaStatus: (row.qaStatus as "open" | "resolved" | "approved") ?? "open",
      authorId: row.authorId,
      author: {
        id: row.authorId,
        username: row.authorUsername,
        displayName: row.authorDisplayName,
        avatarPath: row.authorAvatarPath,
      },
      content: row.deletedAt ? null : row.content,
      contentFormat: row.contentFormat,
      editedAt: row.editedAt,
      deletedAt: row.deletedAt,
      createdAt: row.createdAt,
      qaResolvedAt: row.qaResolvedAt,
      qaResolvedByUsername: row.qaResolvedByUsername ?? null,
      qaApprovedAt: row.qaApprovedAt,
      qaApprovedByUsername: row.qaApprovedByUsername ?? null,
      replies: [],
    };

    commentMap.set(row.id, comment);

    if (!row.parentId) {
      if (!topLevelBySection.has(sectionKey)) {
        topLevelBySection.set(sectionKey, []);
      }
      topLevelBySection.get(sectionKey)!.push(comment);
    }
  }

  // Attach replies
  for (const row of rows) {
    if (row.parentId) {
      const parent = commentMap.get(row.parentId);
      const child = commentMap.get(row.id);
      if (parent && child) {
        parent.replies.push(child);
      }
    }
  }

  for (const [key, sectionComments] of topLevelBySection) {
    result.set(key, sectionComments);
  }

  return result;
}

/**
 * Count open QA comments per section for a report config.
 * Returns a Map keyed by sectionKey.
 */
export async function getOpenQACommentCounts(
  reportConfigId: string,
  engagementId: string
): Promise<Map<string, number>> {
  const result = new Map<string, number>();

  const rows = await db
    .select({
      sectionKey: comments.sectionKey,
      count: sql<number>`count(*)::int`,
    })
    .from(comments)
    .where(
      and(
        eq(comments.engagementId, engagementId),
        eq(comments.targetType, "report_section"),
        eq(comments.targetId, reportConfigId),
        isNull(comments.deletedAt),
        eq(comments.qaStatus, "open")
      )
    )
    .groupBy(comments.sectionKey);

  for (const row of rows) {
    if (row.sectionKey) {
      result.set(row.sectionKey, row.count);
    }
  }

  return result;
}

/**
 * Count total open QA comments for a report config (across all sections).
 */
export async function getTotalOpenQACommentCount(
  reportConfigId: string,
  engagementId: string
): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(comments)
    .where(
      and(
        eq(comments.engagementId, engagementId),
        eq(comments.targetType, "report_section"),
        eq(comments.targetId, reportConfigId),
        isNull(comments.deletedAt),
        eq(comments.qaStatus, "open")
      )
    );

  return row?.count ?? 0;
}
