import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { engagements, engagementMembers } from "@/db/schema";
import { isContentLocked, isCommentLocked, type EngagementStatus } from "./engagement-status";

export interface EngagementAccess {
  role: string;
  status: EngagementStatus;
}

/**
 * Check write access and fetch engagement status in a single query.
 * Returns null if the user is not a member or has read-only access.
 */
export async function requireWriteAccessWithStatus(
  engagementId: string,
  userId: string
): Promise<EngagementAccess | null> {
  const [row] = await db
    .select({
      role: engagementMembers.role,
      status: engagements.status,
    })
    .from(engagementMembers)
    .innerJoin(engagements, eq(engagementMembers.engagementId, engagements.id))
    .where(
      and(
        eq(engagementMembers.engagementId, engagementId),
        eq(engagementMembers.userId, userId)
      )
    )
    .limit(1);

  if (!row || row.role === "read") return null;
  return row as EngagementAccess;
}

/**
 * Check if content mutations (resources, actions, findings, categories)
 * are allowed for this access context.
 * Returns an error message string if blocked, or null if writable.
 */
export function checkContentWritable(access: EngagementAccess): string | null {
  const isOwner = access.role === "owner";
  if (isContentLocked(access.status, isOwner)) {
    if (access.status === "reporting") {
      return "This engagement is in the reporting phase. Only owners can make changes.";
    }
    return `This engagement is ${access.status} and cannot be modified.`;
  }
  return null;
}

/**
 * Check comment access and fetch engagement status in a single query.
 * Returns null only if the user is not a member at all.
 * All roles (read, write, owner) can participate in discussions.
 */
export async function requireCommentAccessWithStatus(
  engagementId: string,
  userId: string
): Promise<EngagementAccess | null> {
  const [row] = await db
    .select({
      role: engagementMembers.role,
      status: engagements.status,
    })
    .from(engagementMembers)
    .innerJoin(engagements, eq(engagementMembers.engagementId, engagements.id))
    .where(
      and(
        eq(engagementMembers.engagementId, engagementId),
        eq(engagementMembers.userId, userId)
      )
    )
    .limit(1);

  if (!row) return null;
  return row as EngagementAccess;
}

/**
 * Check if comments are allowed for this engagement status.
 * Comments are only blocked in closed/archived engagements.
 * Returns an error message string if blocked, or null if commenting is allowed.
 */
export function checkCommentWritable(access: EngagementAccess): string | null {
  if (isCommentLocked(access.status)) {
    return `This engagement is ${access.status} and comments are no longer allowed.`;
  }
  return null;
}
