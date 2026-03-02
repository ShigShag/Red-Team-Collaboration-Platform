import { eq, and, notInArray } from "drizzle-orm";
import { db } from "@/db";
import { engagements, engagementMembers, coordinatorExclusions } from "@/db/schema";
import { isContentLocked, isCommentLocked, type EngagementStatus } from "./engagement-status";

export interface EngagementAccess {
  role: string;
  status: EngagementStatus;
  isVirtualCoordinator?: boolean;
}

/**
 * Get effective access for a user on an engagement.
 * 1. Check explicit engagement_members row first
 * 2. If no explicit row AND isCoordinator AND not excluded → virtual read
 * 3. Otherwise → null
 */
export async function getEffectiveAccess(
  engagementId: string,
  userId: string,
  isCoordinator: boolean
): Promise<EngagementAccess | null> {
  // Check explicit membership first
  const [explicit] = await db
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

  if (explicit) {
    return explicit as EngagementAccess;
  }

  // Check virtual coordinator access
  if (!isCoordinator) return null;

  const [engagement] = await db
    .select({
      status: engagements.status,
      excludeCoordinators: engagements.excludeCoordinators,
    })
    .from(engagements)
    .where(eq(engagements.id, engagementId))
    .limit(1);

  if (!engagement || engagement.excludeCoordinators) return null;

  // Check if user is individually excluded
  const [exclusion] = await db
    .select({ id: coordinatorExclusions.id })
    .from(coordinatorExclusions)
    .where(
      and(
        eq(coordinatorExclusions.engagementId, engagementId),
        eq(coordinatorExclusions.userId, userId)
      )
    )
    .limit(1);

  if (exclusion) return null;

  return {
    role: "read",
    status: engagement.status as EngagementStatus,
    isVirtualCoordinator: true,
  };
}

/**
 * Get all engagement IDs accessible by a user (explicit + virtual coordinator).
 * Returns { id, name, role, isVirtualCoordinator } for each.
 */
export async function getAccessibleEngagementIds(
  userId: string,
  isCoordinator: boolean
): Promise<{ id: string; name: string }[]> {
  // Explicit memberships
  const explicit = await db
    .select({
      id: engagementMembers.engagementId,
      name: engagements.name,
    })
    .from(engagementMembers)
    .innerJoin(engagements, eq(engagementMembers.engagementId, engagements.id))
    .where(eq(engagementMembers.userId, userId));

  if (!isCoordinator) return explicit;

  const explicitIds = explicit.map((e) => e.id);

  // Coordinator-visible engagements (not excluded globally, not individually excluded, not already explicit)
  const userExclusions = db
    .select({ engagementId: coordinatorExclusions.engagementId })
    .from(coordinatorExclusions)
    .where(eq(coordinatorExclusions.userId, userId));

  let coordinatorQuery = db
    .select({
      id: engagements.id,
      name: engagements.name,
    })
    .from(engagements)
    .where(
      and(
        eq(engagements.excludeCoordinators, false),
        notInArray(engagements.id, userExclusions),
        ...(explicitIds.length > 0
          ? [notInArray(engagements.id, explicitIds)]
          : [])
      )
    );

  const coordinatorVisible = await coordinatorQuery;

  return [...explicit, ...coordinatorVisible];
}

/**
 * Check write access and fetch engagement status in a single query.
 * Returns null if the user is not a member or has read-only access.
 * Coordinators never get write access through this function.
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
 * Virtual coordinators can also comment.
 */
export async function requireCommentAccessWithStatus(
  engagementId: string,
  userId: string,
  isCoordinator: boolean = false
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

  if (row) return row as EngagementAccess;

  // Fall back to virtual coordinator access
  if (isCoordinator) {
    const access = await getEffectiveAccess(engagementId, userId, true);
    if (access) return access;
  }

  return null;
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
