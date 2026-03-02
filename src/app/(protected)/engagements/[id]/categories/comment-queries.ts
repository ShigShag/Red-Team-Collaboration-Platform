import { eq, and, inArray, isNull, asc, sql } from "drizzle-orm";
import { db } from "@/db";
import { comments, users } from "@/db/schema";

export interface CommentAuthor {
  id: string;
  username: string;
  displayName: string | null;
  avatarPath: string | null;
}

export interface CommentData {
  id: string;
  targetType: string;
  targetId: string;
  parentId: string | null;
  authorId: string;
  content: string | null; // null when soft-deleted
  contentFormat: string;
  editedAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  author: CommentAuthor;
  replies: CommentData[];
}

/**
 * Fetch all comments for multiple targets in a single batch query.
 * Returns a map keyed by "targetType:targetId".
 */
export async function getCommentsForTargets(
  engagementId: string,
  targets: Array<{ type: string; id: string }>
): Promise<Map<string, CommentData[]>> {
  const result = new Map<string, CommentData[]>();

  if (targets.length === 0) return result;

  // Build the filter: (target_type = X AND target_id = Y) OR ...
  const targetIds = targets.map((t) => t.id);

  const rows = await db
    .select({
      id: comments.id,
      targetType: comments.targetType,
      targetId: comments.targetId,
      parentId: comments.parentId,
      authorId: comments.authorId,
      content: comments.content,
      contentFormat: comments.contentFormat,
      editedAt: comments.editedAt,
      deletedAt: comments.deletedAt,
      createdAt: comments.createdAt,
      authorUsername: users.username,
      authorDisplayName: users.displayName,
      authorAvatarPath: users.avatarPath,
    })
    .from(comments)
    .innerJoin(users, eq(comments.authorId, users.id))
    .where(
      and(
        eq(comments.engagementId, engagementId),
        inArray(comments.targetId, targetIds)
      )
    )
    .orderBy(asc(comments.createdAt));

  // Build map of all comments, then assemble threads
  const commentMap = new Map<string, CommentData>();
  const topLevelByTarget = new Map<string, CommentData[]>();

  for (const row of rows) {
    const comment: CommentData = {
      id: row.id,
      targetType: row.targetType,
      targetId: row.targetId,
      parentId: row.parentId,
      authorId: row.authorId,
      content: row.deletedAt ? null : row.content,
      contentFormat: row.contentFormat,
      editedAt: row.editedAt,
      deletedAt: row.deletedAt,
      createdAt: row.createdAt,
      author: {
        id: row.authorId,
        username: row.authorUsername,
        displayName: row.authorDisplayName,
        avatarPath: row.authorAvatarPath,
      },
      replies: [],
    };

    commentMap.set(row.id, comment);

    if (!row.parentId) {
      const key = `${row.targetType}:${row.targetId}`;
      if (!topLevelByTarget.has(key)) {
        topLevelByTarget.set(key, []);
      }
      topLevelByTarget.get(key)!.push(comment);
    }
  }

  // Attach replies to their parents
  for (const row of rows) {
    if (row.parentId) {
      const parent = commentMap.get(row.parentId);
      const child = commentMap.get(row.id);
      if (parent && child) {
        parent.replies.push(child);
      }
    }
  }

  // Return organized result
  for (const [key, threadComments] of topLevelByTarget) {
    result.set(key, threadComments);
  }

  return result;
}

/**
 * Count comments per target (for showing counts before expanding).
 */
export async function getCommentCounts(
  engagementId: string,
  targetIds: string[]
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (targetIds.length === 0) return result;

  const rows = await db
    .select({
      targetId: comments.targetId,
      count: sql<number>`count(*)::int`,
    })
    .from(comments)
    .where(
      and(
        eq(comments.engagementId, engagementId),
        inArray(comments.targetId, targetIds),
        isNull(comments.deletedAt)
      )
    )
    .groupBy(comments.targetId);

  for (const row of rows) {
    result.set(row.targetId, row.count);
  }

  return result;
}

