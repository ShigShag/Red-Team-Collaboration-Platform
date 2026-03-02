"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import {
  users,
  engagements,
  engagementMembers,
  engagementCategories,
  categoryAssignments,
} from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import {
  createCategorySchema,
  updateCategorySchema,
  createSubCategorySchema,
  categoryAssignmentSchema,
} from "@/lib/validations";
import { logActivity } from "@/lib/activity-log";
import { createNotification } from "@/lib/notifications";
import {
  requireWriteAccessWithStatus,
  checkContentWritable,
} from "@/lib/engagement-access";

export type CategoryState = {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string[]>;
};

async function requireMembership(
  engagementId: string,
  userId: string
): Promise<{ role: string } | null> {
  const [member] = await db
    .select({ role: engagementMembers.role })
    .from(engagementMembers)
    .where(
      and(
        eq(engagementMembers.engagementId, engagementId),
        eq(engagementMembers.userId, userId)
      )
    )
    .limit(1);

  return member ?? null;
}

export async function createCategory(
  _prev: CategoryState,
  formData: FormData
): Promise<CategoryState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const engagementId = formData.get("engagementId") as string;
  if (!engagementId) return { error: "Missing engagement ID" };

  const access = await requireWriteAccessWithStatus(engagementId, session.userId);
  if (!access) return { error: "You need write access to add categories" };
  const lockError = checkContentWritable(access);
  if (lockError) return { error: lockError };

  const raw = {
    presetId: formData.get("presetId") as string,
    name: formData.get("name") as string,
    color: (formData.get("color") as string) || undefined,
    description: (formData.get("description") as string) || undefined,
  };

  const parsed = createCategorySchema.safeParse(raw);
  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors as Record<
        string,
        string[]
      >,
    };
  }

  const [newCategory] = await db.insert(engagementCategories).values({
    engagementId,
    presetId: parsed.data.presetId,
    name: parsed.data.name.trim(),
    color: parsed.data.color || null,
    description: parsed.data.description?.trim() || null,
    createdBy: session.userId,
  }).returning({ id: engagementCategories.id });

  await logActivity({
    engagementId,
    actorId: session.userId,
    eventType: "category_created",
    metadata: { categoryName: parsed.data.name.trim(), categoryId: newCategory.id },
  });

  revalidatePath(`/engagements/${engagementId}`);
  return { success: "Category added" };
}

export async function removeCategory(
  _prev: CategoryState,
  formData: FormData
): Promise<CategoryState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const engagementId = formData.get("engagementId") as string;
  const categoryId = formData.get("categoryId") as string;
  if (!engagementId || !categoryId) return { error: "Missing required fields" };

  const access = await requireWriteAccessWithStatus(engagementId, session.userId);
  if (!access) return { error: "You need write access to remove categories" };
  const lockError = checkContentWritable(access);
  if (lockError) return { error: lockError };

  const [category] = await db
    .select({
      id: engagementCategories.id,
      name: engagementCategories.name,
      locked: engagementCategories.locked,
    })
    .from(engagementCategories)
    .where(
      and(
        eq(engagementCategories.id, categoryId),
        eq(engagementCategories.engagementId, engagementId)
      )
    )
    .limit(1);

  if (!category) return { error: "Category not found" };

  if (category.locked && access.role !== "owner") {
    return { error: "This category is locked and can only be removed by an owner" };
  }

  await db
    .delete(engagementCategories)
    .where(eq(engagementCategories.id, categoryId));

  await logActivity({
    engagementId,
    actorId: session.userId,
    eventType: "category_deleted",
    metadata: { categoryName: category.name, categoryId: categoryId },
  });

  revalidatePath(`/engagements/${engagementId}`);
  return { success: "Category removed" };
}

export async function assignToCategory(
  _prev: CategoryState,
  formData: FormData
): Promise<CategoryState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const engagementId = formData.get("engagementId") as string;
  if (!engagementId) return { error: "Missing engagement ID" };

  const raw = {
    categoryId: formData.get("categoryId") as string,
    userId: formData.get("userId") as string,
  };

  const parsed = categoryAssignmentSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors as Record<
        string,
        string[]
      >,
    };
  }

  const access = await requireWriteAccessWithStatus(engagementId, session.userId);
  if (!access) return { error: "You need write access to manage assignments" };
  const lockError1 = checkContentWritable(access);
  if (lockError1) return { error: lockError1 };

  // write users can only assign themselves, owners can assign anyone
  if (access.role === "write" && parsed.data.userId !== session.userId) {
    return { error: "Only owners can assign other members" };
  }

  // Verify target user is a member
  const targetMember = await requireMembership(
    engagementId,
    parsed.data.userId
  );
  if (!targetMember)
    return { error: "User is not a member of this engagement" };

  // Verify category belongs to this engagement
  const [category] = await db
    .select({ id: engagementCategories.id, name: engagementCategories.name })
    .from(engagementCategories)
    .where(
      and(
        eq(engagementCategories.id, parsed.data.categoryId),
        eq(engagementCategories.engagementId, engagementId)
      )
    )
    .limit(1);

  if (!category) return { error: "Category not found" };

  // Check for existing assignment
  const [existing] = await db
    .select({ id: categoryAssignments.id })
    .from(categoryAssignments)
    .where(
      and(
        eq(categoryAssignments.categoryId, parsed.data.categoryId),
        eq(categoryAssignments.userId, parsed.data.userId)
      )
    )
    .limit(1);

  if (existing) return { error: "Already assigned" };

  // Fetch target user info for activity log
  const [targetUser] = await db
    .select({ username: users.username, displayName: users.displayName })
    .from(users)
    .where(eq(users.id, parsed.data.userId))
    .limit(1);

  await db.insert(categoryAssignments).values({
    categoryId: parsed.data.categoryId,
    userId: parsed.data.userId,
    assignedBy: session.userId,
  });

  // Fetch engagement name for notification context
  const [engagementForAssign] = await db
    .select({ name: engagements.name })
    .from(engagements)
    .where(eq(engagements.id, engagementId))
    .limit(1);

  await logActivity({
    engagementId,
    actorId: session.userId,
    eventType: "member_assigned",
    metadata: {
      targetUsername: targetUser?.username ?? "unknown",
      targetDisplayName: targetUser?.displayName ?? null,
      categoryName: category.name,
      categoryId: parsed.data.categoryId,
    },
  });

  await createNotification({
    userId: parsed.data.userId,
    type: "member_assigned",
    engagementId,
    actorId: session.userId,
    metadata: {
      engagementName: engagementForAssign?.name ?? "Unknown",
      categoryName: category.name,
    },
  });

  revalidatePath(`/engagements/${engagementId}`);
  return { success: "Assigned" };
}

export async function unassignFromCategory(
  _prev: CategoryState,
  formData: FormData
): Promise<CategoryState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const engagementId = formData.get("engagementId") as string;
  if (!engagementId) return { error: "Missing engagement ID" };

  const raw = {
    categoryId: formData.get("categoryId") as string,
    userId: formData.get("userId") as string,
  };

  const parsed = categoryAssignmentSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors as Record<
        string,
        string[]
      >,
    };
  }

  const access = await requireWriteAccessWithStatus(engagementId, session.userId);
  if (!access) return { error: "You need write access to manage assignments" };
  const lockError2 = checkContentWritable(access);
  if (lockError2) return { error: lockError2 };

  // write users can only unassign themselves
  if (access.role === "write" && parsed.data.userId !== session.userId) {
    return { error: "Only owners can unassign other members" };
  }

  // Fetch info for activity log before deleting
  const [targetUser] = await db
    .select({ username: users.username, displayName: users.displayName })
    .from(users)
    .where(eq(users.id, parsed.data.userId))
    .limit(1);

  const [category] = await db
    .select({ name: engagementCategories.name })
    .from(engagementCategories)
    .where(eq(engagementCategories.id, parsed.data.categoryId))
    .limit(1);

  await db
    .delete(categoryAssignments)
    .where(
      and(
        eq(categoryAssignments.categoryId, parsed.data.categoryId),
        eq(categoryAssignments.userId, parsed.data.userId)
      )
    );

  // Fetch engagement name for notification context
  const [engagementForUnassign] = await db
    .select({ name: engagements.name })
    .from(engagements)
    .where(eq(engagements.id, engagementId))
    .limit(1);

  await logActivity({
    engagementId,
    actorId: session.userId,
    eventType: "member_unassigned",
    metadata: {
      targetUsername: targetUser?.username ?? "unknown",
      targetDisplayName: targetUser?.displayName ?? null,
      categoryName: category?.name ?? "unknown",
      categoryId: parsed.data.categoryId,
    },
  });

  await createNotification({
    userId: parsed.data.userId,
    type: "member_unassigned",
    engagementId,
    actorId: session.userId,
    metadata: {
      engagementName: engagementForUnassign?.name ?? "Unknown",
      categoryName: category?.name ?? "unknown",
    },
  });

  revalidatePath(`/engagements/${engagementId}`);
  return { success: "Unassigned" };
}

export async function toggleCategoryLock(
  _prev: CategoryState,
  formData: FormData
): Promise<CategoryState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const engagementId = formData.get("engagementId") as string;
  const categoryId = formData.get("categoryId") as string;
  if (!engagementId || !categoryId) return { error: "Missing required fields" };

  const access = await requireWriteAccessWithStatus(engagementId, session.userId);
  if (!access || access.role !== "owner") {
    return { error: "Only owners can lock or unlock categories" };
  }
  const lockError3 = checkContentWritable(access);
  if (lockError3) return { error: lockError3 };

  const [category] = await db
    .select({
      id: engagementCategories.id,
      locked: engagementCategories.locked,
    })
    .from(engagementCategories)
    .where(
      and(
        eq(engagementCategories.id, categoryId),
        eq(engagementCategories.engagementId, engagementId)
      )
    )
    .limit(1);

  if (!category) return { error: "Category not found" };

  await db
    .update(engagementCategories)
    .set({ locked: !category.locked })
    .where(eq(engagementCategories.id, categoryId));

  revalidatePath(`/engagements/${engagementId}`);
  return { success: category.locked ? "Category unlocked" : "Category locked" };
}

export async function createSubCategory(
  _prev: CategoryState,
  formData: FormData
): Promise<CategoryState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const engagementId = formData.get("engagementId") as string;
  if (!engagementId) return { error: "Missing engagement ID" };

  const access = await requireWriteAccessWithStatus(engagementId, session.userId);
  if (!access) return { error: "You need write access to add sub-categories" };
  const lockError4 = checkContentWritable(access);
  if (lockError4) return { error: lockError4 };

  const raw = {
    parentId: formData.get("parentId") as string,
    presetId: formData.get("presetId") as string,
    name: formData.get("name") as string,
    color: (formData.get("color") as string) || undefined,
    description: (formData.get("description") as string) || undefined,
  };

  const parsed = createSubCategorySchema.safeParse(raw);
  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors as Record<
        string,
        string[]
      >,
    };
  }

  // Verify parent category exists in same engagement
  const [parent] = await db
    .select({
      id: engagementCategories.id,
      locked: engagementCategories.locked,
    })
    .from(engagementCategories)
    .where(
      and(
        eq(engagementCategories.id, parsed.data.parentId),
        eq(engagementCategories.engagementId, engagementId)
      )
    )
    .limit(1);

  if (!parent) return { error: "Parent category not found" };

  if (parent.locked && access.role !== "owner") {
    return { error: "Parent category is locked" };
  }

  const [newSubCategory] = await db.insert(engagementCategories).values({
    engagementId,
    parentId: parsed.data.parentId,
    presetId: parsed.data.presetId,
    name: parsed.data.name.trim(),
    color: parsed.data.color || null,
    description: parsed.data.description?.trim() || null,
    createdBy: session.userId,
  }).returning({ id: engagementCategories.id });

  await logActivity({
    engagementId,
    actorId: session.userId,
    eventType: "category_created",
    metadata: { categoryName: parsed.data.name.trim(), categoryId: newSubCategory.id },
  });

  revalidatePath(`/engagements/${engagementId}`);
  revalidatePath(`/engagements/${engagementId}/categories/${parsed.data.parentId}`);
  return { success: "Sub-category added" };
}

export async function updateCategory(
  _prev: CategoryState,
  formData: FormData
): Promise<CategoryState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const engagementId = formData.get("engagementId") as string;
  if (!engagementId) return { error: "Missing engagement ID" };

  const access = await requireWriteAccessWithStatus(engagementId, session.userId);
  if (!access) return { error: "You need write access to edit categories" };
  const lockError = checkContentWritable(access);
  if (lockError) return { error: lockError };

  const raw = {
    categoryId: formData.get("categoryId") as string,
    name: formData.get("name") as string,
    color: (formData.get("color") as string) || undefined,
    description: (formData.get("description") as string) || undefined,
  };

  const parsed = updateCategorySchema.safeParse(raw);
  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors as Record<
        string,
        string[]
      >,
    };
  }

  const [category] = await db
    .select({
      id: engagementCategories.id,
      name: engagementCategories.name,
      locked: engagementCategories.locked,
      parentId: engagementCategories.parentId,
    })
    .from(engagementCategories)
    .where(
      and(
        eq(engagementCategories.id, parsed.data.categoryId),
        eq(engagementCategories.engagementId, engagementId)
      )
    )
    .limit(1);

  if (!category) return { error: "Category not found" };

  if (category.locked && access.role !== "owner") {
    return { error: "This category is locked and can only be edited by an owner" };
  }

  const oldName = category.name;
  const newName = parsed.data.name.trim();

  await db
    .update(engagementCategories)
    .set({
      name: newName,
      color: parsed.data.color || null,
      description: parsed.data.description?.trim() || null,
    })
    .where(eq(engagementCategories.id, parsed.data.categoryId));

  await logActivity({
    engagementId,
    actorId: session.userId,
    eventType: "category_updated",
    metadata: {
      categoryId: parsed.data.categoryId,
      categoryName: newName,
      ...(oldName !== newName ? { oldName } : {}),
    },
  });

  revalidatePath(`/engagements/${engagementId}`);
  revalidatePath(`/engagements/${engagementId}/categories/${parsed.data.categoryId}`);
  if (category.parentId) {
    revalidatePath(`/engagements/${engagementId}/categories/${category.parentId}`);
  }
  return { success: "Category updated" };
}
