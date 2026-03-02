"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq, and, sql, inArray } from "drizzle-orm";
import { db } from "@/db";
import { users, engagements, engagementMembers, categoryAssignments, engagementCategories } from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import {
  createEngagementSchema,
  updateEngagementDetailsSchema,
  addMemberSchema,
  updateMemberRoleSchema,
  updateTimespanSchema,
} from "@/lib/validations";
import { logActivity } from "@/lib/activity-log";
import { createNotification } from "@/lib/notifications";
import {
  isValidStatus,
  isMemberManagementLocked,
  isSettingsLocked,
  STATUS_META,
  type EngagementStatus,
} from "@/lib/engagement-status";

export type EngagementState = {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string[]>;
};

async function requireOwnership(
  engagementId: string,
  userId: string
): Promise<boolean> {
  const [member] = await db
    .select({ role: engagementMembers.role })
    .from(engagementMembers)
    .where(
      and(
        eq(engagementMembers.engagementId, engagementId),
        eq(engagementMembers.userId, userId),
        eq(engagementMembers.role, "owner")
      )
    )
    .limit(1);

  return !!member;
}

async function countOwners(engagementId: string): Promise<number> {
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(engagementMembers)
    .where(
      and(
        eq(engagementMembers.engagementId, engagementId),
        eq(engagementMembers.role, "owner")
      )
    );
  return result.count;
}

export async function createEngagement(
  _prev: EngagementState,
  formData: FormData
): Promise<EngagementState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const raw = {
    name: formData.get("name") as string,
    description: (formData.get("description") as string) || undefined,
    startDate: (formData.get("startDate") as string) || undefined,
    endDate: (formData.get("endDate") as string) || undefined,
  };

  const parsed = createEngagementSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors as Record<
        string,
        string[]
      >,
    };
  }

  // Validate date ordering
  if (parsed.data.startDate && parsed.data.endDate) {
    if (parsed.data.startDate > parsed.data.endDate) {
      return { error: "Start date must be before end date" };
    }
  }

  const newEngagement = await db.transaction(async (tx) => {
    const [engagement] = await tx
      .insert(engagements)
      .values({
        name: parsed.data.name.trim(),
        description: parsed.data.description?.trim() || null,
        startDate: parsed.data.startDate || null,
        endDate: parsed.data.endDate || null,
      })
      .returning({ id: engagements.id });

    await tx.insert(engagementMembers).values({
      engagementId: engagement.id,
      userId: session.userId,
      role: "owner",
    });

    return engagement;
  });

  redirect(`/engagements/${newEngagement.id}`);
}

export async function addMember(
  _prev: EngagementState,
  formData: FormData
): Promise<EngagementState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const engagementId = formData.get("engagementId") as string;
  if (!engagementId) return { error: "Missing engagement ID" };

  const isOwner = await requireOwnership(engagementId, session.userId);
  if (!isOwner) return { error: "Only owners can manage members" };

  // Check engagement status lock
  const [engForLock] = await db
    .select({ status: engagements.status })
    .from(engagements)
    .where(eq(engagements.id, engagementId))
    .limit(1);
  if (engForLock && isMemberManagementLocked(engForLock.status)) {
    return { error: `This engagement is ${engForLock.status} and cannot be modified.` };
  }

  const raw = {
    username: formData.get("username") as string,
    role: formData.get("role") as string,
  };

  const parsed = addMemberSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors as Record<
        string,
        string[]
      >,
    };
  }

  // Look up target user
  const [targetUser] = await db
    .select({ id: users.id, displayName: users.displayName })
    .from(users)
    .where(eq(users.username, parsed.data.username.trim().toLowerCase()))
    .limit(1);

  if (!targetUser) {
    return { error: "User not found" };
  }

  // Check if already a member
  const [existing] = await db
    .select({ id: engagementMembers.id })
    .from(engagementMembers)
    .where(
      and(
        eq(engagementMembers.engagementId, engagementId),
        eq(engagementMembers.userId, targetUser.id)
      )
    )
    .limit(1);

  if (existing) {
    return { error: "User is already a member of this engagement" };
  }

  // Fetch engagement name for notification context
  const [engagement] = await db
    .select({ name: engagements.name })
    .from(engagements)
    .where(eq(engagements.id, engagementId))
    .limit(1);

  await db.insert(engagementMembers).values({
    engagementId,
    userId: targetUser.id,
    role: parsed.data.role,
  });

  await logActivity({
    engagementId,
    actorId: session.userId,
    eventType: "member_joined",
    metadata: {
      targetUsername: parsed.data.username.trim().toLowerCase(),
      targetDisplayName: targetUser.displayName,
      role: parsed.data.role,
    },
  });

  await createNotification({
    userId: targetUser.id,
    type: "member_joined",
    engagementId,
    actorId: session.userId,
    metadata: {
      engagementName: engagement?.name ?? "Unknown",
      role: parsed.data.role,
    },
  });

  revalidatePath(`/engagements/${engagementId}`);
  return { success: "Member added" };
}

export async function updateMemberRole(
  _prev: EngagementState,
  formData: FormData
): Promise<EngagementState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const engagementId = formData.get("engagementId") as string;
  if (!engagementId) return { error: "Missing engagement ID" };

  const isOwner = await requireOwnership(engagementId, session.userId);
  if (!isOwner) return { error: "Only owners can manage members" };

  // Check engagement status lock
  const [engForRoleLock] = await db
    .select({ status: engagements.status })
    .from(engagements)
    .where(eq(engagements.id, engagementId))
    .limit(1);
  if (engForRoleLock && isMemberManagementLocked(engForRoleLock.status)) {
    return { error: `This engagement is ${engForRoleLock.status} and cannot be modified.` };
  }

  const raw = {
    memberId: formData.get("memberId") as string,
    role: formData.get("role") as string,
  };

  const parsed = updateMemberRoleSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors as Record<
        string,
        string[]
      >,
    };
  }

  // Get the member being updated
  const [member] = await db
    .select({
      id: engagementMembers.id,
      userId: engagementMembers.userId,
      role: engagementMembers.role,
      username: users.username,
      displayName: users.displayName,
    })
    .from(engagementMembers)
    .innerJoin(users, eq(engagementMembers.userId, users.id))
    .where(
      and(
        eq(engagementMembers.id, parsed.data.memberId),
        eq(engagementMembers.engagementId, engagementId)
      )
    )
    .limit(1);

  if (!member) return { error: "Member not found" };

  // Guard: can't demote the last owner
  if (member.role === "owner" && parsed.data.role !== "owner") {
    const ownerCount = await countOwners(engagementId);
    if (ownerCount <= 1) {
      return {
        error:
          "Cannot demote the last owner. Promote another member to owner first.",
      };
    }
  }

  const oldRole = member.role;

  // Fetch engagement name for notification context
  const [engagementForRole] = await db
    .select({ name: engagements.name })
    .from(engagements)
    .where(eq(engagements.id, engagementId))
    .limit(1);

  await db
    .update(engagementMembers)
    .set({ role: parsed.data.role })
    .where(eq(engagementMembers.id, parsed.data.memberId));

  await logActivity({
    engagementId,
    actorId: session.userId,
    eventType: "member_role_changed",
    metadata: {
      targetUsername: member.username,
      targetDisplayName: member.displayName,
      oldRole,
      newRole: parsed.data.role,
    },
  });

  await createNotification({
    userId: member.userId,
    type: "member_role_changed",
    engagementId,
    actorId: session.userId,
    metadata: {
      engagementName: engagementForRole?.name ?? "Unknown",
      oldRole,
      newRole: parsed.data.role,
    },
  });

  revalidatePath(`/engagements/${engagementId}`);
  return { success: "Role updated" };
}

export async function removeMember(
  _prev: EngagementState,
  formData: FormData
): Promise<EngagementState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const engagementId = formData.get("engagementId") as string;
  const memberId = formData.get("memberId") as string;
  if (!engagementId || !memberId) return { error: "Missing required fields" };

  const isOwner = await requireOwnership(engagementId, session.userId);
  if (!isOwner) return { error: "Only owners can manage members" };

  // Check engagement status lock
  const [engForRemoveLock] = await db
    .select({ status: engagements.status })
    .from(engagements)
    .where(eq(engagements.id, engagementId))
    .limit(1);
  if (engForRemoveLock && isMemberManagementLocked(engForRemoveLock.status)) {
    return { error: `This engagement is ${engForRemoveLock.status} and cannot be modified.` };
  }

  // Get the member being removed
  const [member] = await db
    .select({
      id: engagementMembers.id,
      userId: engagementMembers.userId,
      role: engagementMembers.role,
      username: users.username,
      displayName: users.displayName,
    })
    .from(engagementMembers)
    .innerJoin(users, eq(engagementMembers.userId, users.id))
    .where(
      and(
        eq(engagementMembers.id, memberId),
        eq(engagementMembers.engagementId, engagementId)
      )
    )
    .limit(1);

  if (!member) return { error: "Member not found" };

  // Guard: can't remove the last owner
  if (member.role === "owner") {
    const ownerCount = await countOwners(engagementId);
    if (ownerCount <= 1) {
      return {
        error:
          "Cannot remove the last owner. Transfer ownership to another member first.",
      };
    }
  }

  // Fetch engagement name for notification context
  const [engagementForRemove] = await db
    .select({ name: engagements.name })
    .from(engagements)
    .where(eq(engagements.id, engagementId))
    .limit(1);

  // Clean up category assignments for this engagement
  await db
    .delete(categoryAssignments)
    .where(
      and(
        eq(categoryAssignments.userId, member.userId),
        inArray(
          categoryAssignments.categoryId,
          db
            .select({ id: engagementCategories.id })
            .from(engagementCategories)
            .where(eq(engagementCategories.engagementId, engagementId))
        )
      )
    );

  await db
    .delete(engagementMembers)
    .where(eq(engagementMembers.id, memberId));

  await logActivity({
    engagementId,
    actorId: session.userId,
    eventType: "member_removed",
    metadata: {
      targetUsername: member.username,
      targetDisplayName: member.displayName,
    },
  });

  await createNotification({
    userId: member.userId,
    type: "member_removed",
    engagementId,
    actorId: session.userId,
    metadata: {
      engagementName: engagementForRemove?.name ?? "Unknown",
    },
  });

  revalidatePath(`/engagements/${engagementId}`);
  return { success: "Member removed" };
}

export async function updateEngagementDetails(
  _prev: EngagementState,
  formData: FormData
): Promise<EngagementState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const engagementId = formData.get("engagementId") as string;
  if (!engagementId) return { error: "Missing engagement ID" };

  const isOwner = await requireOwnership(engagementId, session.userId);
  if (!isOwner) return { error: "Only owners can update engagement details" };

  // Check engagement status lock
  const [engForDetailsLock] = await db
    .select({ status: engagements.status })
    .from(engagements)
    .where(eq(engagements.id, engagementId))
    .limit(1);
  if (engForDetailsLock && isSettingsLocked(engForDetailsLock.status)) {
    return { error: `This engagement is ${engForDetailsLock.status} and cannot be modified.` };
  }

  const raw = {
    name: formData.get("name") as string,
    description: (formData.get("description") as string) || undefined,
  };

  const parsed = updateEngagementDetailsSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors as Record<
        string,
        string[]
      >,
    };
  }

  await db
    .update(engagements)
    .set({
      name: parsed.data.name.trim(),
      description: parsed.data.description?.trim() || null,
      updatedAt: new Date(),
    })
    .where(eq(engagements.id, engagementId));

  revalidatePath(`/engagements/${engagementId}`);
  revalidatePath("/engagements");
  return { success: "Details updated" };
}

export async function deleteEngagement(
  _prev: EngagementState,
  formData: FormData
): Promise<EngagementState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const engagementId = formData.get("engagementId") as string;
  if (!engagementId) return { error: "Missing engagement ID" };

  const isOwner = await requireOwnership(engagementId, session.userId);
  if (!isOwner) return { error: "Only owners can delete engagements" };

  // Verify confirmation name matches
  const confirmName = (formData.get("confirmName") as string)?.trim();
  const [engagement] = await db
    .select({ name: engagements.name })
    .from(engagements)
    .where(eq(engagements.id, engagementId))
    .limit(1);

  if (!engagement) return { error: "Engagement not found" };

  if (confirmName !== engagement.name) {
    return { error: "Engagement name does not match" };
  }

  await db.delete(engagements).where(eq(engagements.id, engagementId));

  redirect("/engagements");
}

export async function updateTimespan(
  _prev: EngagementState,
  formData: FormData
): Promise<EngagementState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const engagementId = formData.get("engagementId") as string;
  if (!engagementId) return { error: "Missing engagement ID" };

  const isOwner = await requireOwnership(engagementId, session.userId);
  if (!isOwner) return { error: "Only owners can update the timespan" };

  // Check engagement status lock
  const [engForTimespanLock] = await db
    .select({ status: engagements.status })
    .from(engagements)
    .where(eq(engagements.id, engagementId))
    .limit(1);
  if (engForTimespanLock && isSettingsLocked(engForTimespanLock.status)) {
    return { error: `This engagement is ${engForTimespanLock.status} and cannot be modified.` };
  }

  const raw = {
    startDate: (formData.get("startDate") as string) || undefined,
    endDate: (formData.get("endDate") as string) || undefined,
  };

  const parsed = updateTimespanSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors as Record<
        string,
        string[]
      >,
    };
  }

  // Validate date ordering
  if (parsed.data.startDate && parsed.data.endDate) {
    if (parsed.data.startDate > parsed.data.endDate) {
      return { error: "Start date must be before end date" };
    }
  }

  await db
    .update(engagements)
    .set({
      startDate: parsed.data.startDate || null,
      endDate: parsed.data.endDate || null,
      updatedAt: new Date(),
    })
    .where(eq(engagements.id, engagementId));

  revalidatePath(`/engagements/${engagementId}`);
  return { success: "Timespan updated" };
}

export async function transitionEngagementStatus(
  _prev: EngagementState,
  formData: FormData
): Promise<EngagementState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const engagementId = formData.get("engagementId") as string;
  const newStatus = formData.get("status") as string;
  if (!engagementId || !newStatus) return { error: "Missing required fields" };

  // Only owners can change status
  const isOwner = await requireOwnership(engagementId, session.userId);
  if (!isOwner) return { error: "Only owners can change engagement status" };

  // Fetch current engagement
  const [engagement] = await db
    .select({ status: engagements.status, name: engagements.name })
    .from(engagements)
    .where(eq(engagements.id, engagementId))
    .limit(1);

  if (!engagement) return { error: "Engagement not found" };

  // Validate status value
  if (!isValidStatus(newStatus)) {
    return { error: `Invalid status: ${newStatus}` };
  }

  if (engagement.status === newStatus) {
    return { error: "Engagement is already in this status" };
  }

  const oldStatus = engagement.status;

  // Update status
  await db
    .update(engagements)
    .set({
      status: newStatus as EngagementStatus,
      updatedAt: new Date(),
    })
    .where(eq(engagements.id, engagementId));

  // Log activity
  await logActivity({
    engagementId,
    actorId: session.userId,
    eventType: "engagement_status_changed",
    metadata: { oldStatus, newStatus },
  });

  // Notify all members (createNotification guards against self-notification)
  const members = await db
    .select({ userId: engagementMembers.userId })
    .from(engagementMembers)
    .where(eq(engagementMembers.engagementId, engagementId));

  for (const member of members) {
    await createNotification({
      userId: member.userId,
      type: "engagement_status_changed",
      engagementId,
      actorId: session.userId,
      metadata: {
        engagementName: engagement.name,
        oldStatus,
        newStatus,
      },
    });
  }

  revalidatePath(`/engagements/${engagementId}`);
  revalidatePath(`/engagements/${engagementId}/settings`);
  revalidatePath("/engagements");
  return {
    success: `Status changed to ${STATUS_META[newStatus as EngagementStatus].label}`,
  };
}
