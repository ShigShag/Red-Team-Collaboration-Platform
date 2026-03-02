"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import {
  engagementCategories,
  categoryActions,
  actionResources,
  actionTags,
  tags,
} from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import {
  createActionSchema,
  updateActionSchema,
  linkActionResourceSchema,
  linkActionTagSchema,
  createTagSchema,
} from "@/lib/validations";
import { logActivity } from "@/lib/activity-log";
import { syncIpGeolocations } from "@/lib/ip-geolocation-sync";
import { ipGeolocationSources, domainResolutionSources } from "@/db/schema";
import {
  requireWriteAccessWithStatus,
  checkContentWritable,
} from "@/lib/engagement-access";


export type ActionState = {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string[]>;
};

export async function createAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const engagementId = formData.get("engagementId") as string;
  if (!engagementId) return { error: "Missing engagement ID" };

  const access = await requireWriteAccessWithStatus(engagementId, session.userId);
  if (!access) return { error: "You need write access to add actions" };
  const lockError = checkContentWritable(access);
  if (lockError) return { error: lockError };

  let resourceIds: string[] | undefined;
  const resourceIdsRaw = formData.get("resourceIds") as string | null;
  if (resourceIdsRaw) {
    try {
      resourceIds = JSON.parse(resourceIdsRaw);
    } catch {
      return { error: "Invalid resource IDs" };
    }
  }

  let tagIds: string[] | undefined;
  const tagIdsRaw = formData.get("tagIds") as string | null;
  if (tagIdsRaw) {
    try {
      tagIds = JSON.parse(tagIdsRaw);
    } catch {
      return { error: "Invalid tag IDs" };
    }
  }

  const raw = {
    categoryId: formData.get("categoryId") as string,
    title: formData.get("title") as string,
    content: formData.get("content") as string,
    contentFormat: (formData.get("contentFormat") as string) || "text",
    performedAt: (formData.get("performedAt") as string) || undefined,
    resourceIds,
    tagIds,
  };

  const parsed = createActionSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors as Record<
        string,
        string[]
      >,
    };
  }

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

  const performedAt = parsed.data.performedAt
    ? new Date(parsed.data.performedAt)
    : new Date();

  const [newAction] = await db.transaction(async (tx) => {
    const result = await tx.insert(categoryActions).values({
      categoryId: parsed.data.categoryId,
      title: parsed.data.title.trim(),
      content: parsed.data.content.trim(),
      contentFormat: parsed.data.contentFormat,
      performedAt,
      createdBy: session.userId,
    }).returning({ id: categoryActions.id });

    if (parsed.data.resourceIds && parsed.data.resourceIds.length > 0) {
      await tx.insert(actionResources).values(
        parsed.data.resourceIds.map((resourceId) => ({
          actionId: result[0].id,
          resourceId,
        }))
      );
    }

    if (parsed.data.tagIds && parsed.data.tagIds.length > 0) {
      await tx.insert(actionTags).values(
        parsed.data.tagIds.map((tagId) => ({
          actionId: result[0].id,
          tagId,
        }))
      );
    }

    return result;
  });

  // Extract IPs from action text and resolve geolocation
  await syncIpGeolocations({
    engagementId,
    sourceType: "action",
    sourceId: newAction.id,
    texts: [parsed.data.title, parsed.data.content],
  });

  await logActivity({
    engagementId,
    actorId: session.userId,
    eventType: "action_created",
    metadata: {
      actionTitle: parsed.data.title.trim(),
      categoryName: category.name,
      actionId: newAction.id,
      categoryId: parsed.data.categoryId,
    },
  });

  revalidatePath(`/engagements/${engagementId}`);
  revalidatePath(`/engagements/${engagementId}/categories/${parsed.data.categoryId}`);
  return { success: "Action added" };
}

export async function updateAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const engagementId = formData.get("engagementId") as string;
  if (!engagementId) return { error: "Missing engagement ID" };

  const access = await requireWriteAccessWithStatus(engagementId, session.userId);
  if (!access) return { error: "You need write access to edit actions" };
  const lockError = checkContentWritable(access);
  if (lockError) return { error: lockError };

  let tagIds: string[] | undefined;
  const tagIdsRaw = formData.get("tagIds") as string | null;
  if (tagIdsRaw) {
    try {
      tagIds = JSON.parse(tagIdsRaw);
    } catch {
      return { error: "Invalid tag IDs" };
    }
  }

  const raw = {
    actionId: formData.get("actionId") as string,
    title: formData.get("title") as string,
    content: formData.get("content") as string,
    contentFormat: (formData.get("contentFormat") as string) || "text",
    performedAt: (formData.get("performedAt") as string) || undefined,
    tagIds,
  };

  const parsed = updateActionSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors as Record<
        string,
        string[]
      >,
    };
  }

  // Verify action exists and belongs to this engagement
  const [action] = await db
    .select({
      id: categoryActions.id,
      categoryId: categoryActions.categoryId,
      categoryName: engagementCategories.name,
    })
    .from(categoryActions)
    .innerJoin(
      engagementCategories,
      eq(categoryActions.categoryId, engagementCategories.id)
    )
    .where(eq(categoryActions.id, parsed.data.actionId))
    .limit(1);

  if (!action) return { error: "Action not found" };

  const performedAt = parsed.data.performedAt
    ? new Date(parsed.data.performedAt)
    : undefined;

  const updates: Record<string, unknown> = {
    title: parsed.data.title.trim(),
    content: parsed.data.content.trim(),
    contentFormat: parsed.data.contentFormat,
  };
  if (performedAt) {
    updates.performedAt = performedAt;
  }

  await db.transaction(async (tx) => {
    await tx
      .update(categoryActions)
      .set(updates)
      .where(eq(categoryActions.id, parsed.data.actionId));

    if (parsed.data.tagIds !== undefined) {
      await tx
        .delete(actionTags)
        .where(eq(actionTags.actionId, parsed.data.actionId));

      if (parsed.data.tagIds.length > 0) {
        await tx.insert(actionTags).values(
          parsed.data.tagIds.map((tagId) => ({
            actionId: parsed.data.actionId,
            tagId,
          }))
        );
      }
    }
  });

  // Re-sync IP geolocations: clear old source links, then re-extract
  await db
    .delete(ipGeolocationSources)
    .where(
      and(
        eq(ipGeolocationSources.sourceType, "action"),
        eq(ipGeolocationSources.sourceId, parsed.data.actionId)
      )
    );
  await db
    .delete(domainResolutionSources)
    .where(
      and(
        eq(domainResolutionSources.sourceType, "action"),
        eq(domainResolutionSources.sourceId, parsed.data.actionId)
      )
    );
  await syncIpGeolocations({
    engagementId,
    sourceType: "action",
    sourceId: parsed.data.actionId,
    texts: [parsed.data.title, parsed.data.content],
  });

  await logActivity({
    engagementId,
    actorId: session.userId,
    eventType: "action_updated",
    metadata: {
      actionTitle: parsed.data.title.trim(),
      categoryName: action.categoryName,
      actionId: parsed.data.actionId,
      categoryId: action.categoryId,
    },
  });

  revalidatePath(`/engagements/${engagementId}`);
  revalidatePath(`/engagements/${engagementId}/categories/${action.categoryId}`);
  return { success: "Action updated" };
}

export async function removeAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const engagementId = formData.get("engagementId") as string;
  const actionId = formData.get("actionId") as string;
  if (!engagementId || !actionId) return { error: "Missing required fields" };

  const access = await requireWriteAccessWithStatus(engagementId, session.userId);
  if (!access) return { error: "You need write access to remove actions" };
  const lockError = checkContentWritable(access);
  if (lockError) return { error: lockError };

  // Look up action details before deleting
  const [action] = await db
    .select({
      title: categoryActions.title,
      categoryId: categoryActions.categoryId,
      categoryName: engagementCategories.name,
    })
    .from(categoryActions)
    .innerJoin(
      engagementCategories,
      eq(categoryActions.categoryId, engagementCategories.id)
    )
    .where(eq(categoryActions.id, actionId))
    .limit(1);

  await db.delete(categoryActions).where(eq(categoryActions.id, actionId));

  if (action) {
    await logActivity({
      engagementId,
      actorId: session.userId,
      eventType: "action_deleted",
      metadata: {
        actionTitle: action.title,
        categoryName: action.categoryName,
        actionId: actionId,
        categoryId: action.categoryId,
      },
    });
  }

  revalidatePath(`/engagements/${engagementId}`);
  if (action) {
    revalidatePath(`/engagements/${engagementId}/categories/${action.categoryId}`);
  }
  return { success: "Action removed" };
}

export async function linkResource(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const engagementId = formData.get("engagementId") as string;
  if (!engagementId) return { error: "Missing engagement ID" };

  const access = await requireWriteAccessWithStatus(engagementId, session.userId);
  if (!access) return { error: "You need write access to link resources" };
  const lockError = checkContentWritable(access);
  if (lockError) return { error: lockError };

  const raw = {
    actionId: formData.get("actionId") as string,
    resourceId: formData.get("resourceId") as string,
  };

  const parsed = linkActionResourceSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors as Record<
        string,
        string[]
      >,
    };
  }

  await db.insert(actionResources).values({
    actionId: parsed.data.actionId,
    resourceId: parsed.data.resourceId,
  });

  // Look up action's category for revalidation
  const [actionRow] = await db
    .select({ categoryId: categoryActions.categoryId })
    .from(categoryActions)
    .where(eq(categoryActions.id, parsed.data.actionId))
    .limit(1);

  revalidatePath(`/engagements/${engagementId}`);
  if (actionRow) {
    revalidatePath(`/engagements/${engagementId}/categories/${actionRow.categoryId}`);
  }
  return { success: "Resource linked" };
}

export async function unlinkResource(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const engagementId = formData.get("engagementId") as string;
  if (!engagementId) return { error: "Missing engagement ID" };

  const access = await requireWriteAccessWithStatus(engagementId, session.userId);
  if (!access) return { error: "You need write access to unlink resources" };
  const lockError = checkContentWritable(access);
  if (lockError) return { error: lockError };

  const raw = {
    actionId: formData.get("actionId") as string,
    resourceId: formData.get("resourceId") as string,
  };

  const parsed = linkActionResourceSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors as Record<
        string,
        string[]
      >,
    };
  }

  // Look up action's category for revalidation
  const [actionRow2] = await db
    .select({ categoryId: categoryActions.categoryId })
    .from(categoryActions)
    .where(eq(categoryActions.id, parsed.data.actionId))
    .limit(1);

  await db
    .delete(actionResources)
    .where(
      and(
        eq(actionResources.actionId, parsed.data.actionId),
        eq(actionResources.resourceId, parsed.data.resourceId)
      )
    );

  revalidatePath(`/engagements/${engagementId}`);
  if (actionRow2) {
    revalidatePath(`/engagements/${engagementId}/categories/${actionRow2.categoryId}`);
  }
  return { success: "Resource unlinked" };
}

export async function tagAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const engagementId = formData.get("engagementId") as string;
  if (!engagementId) return { error: "Missing engagement ID" };

  const access = await requireWriteAccessWithStatus(engagementId, session.userId);
  if (!access) return { error: "You need write access to tag actions" };
  const lockError = checkContentWritable(access);
  if (lockError) return { error: lockError };

  const raw = {
    actionId: formData.get("actionId") as string,
    tagId: formData.get("tagId") as string,
  };

  const parsed = linkActionTagSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors as Record<
        string,
        string[]
      >,
    };
  }

  await db.insert(actionTags).values({
    actionId: parsed.data.actionId,
    tagId: parsed.data.tagId,
  });

  const [actionRow] = await db
    .select({ categoryId: categoryActions.categoryId })
    .from(categoryActions)
    .where(eq(categoryActions.id, parsed.data.actionId))
    .limit(1);

  revalidatePath(`/engagements/${engagementId}`);
  if (actionRow) {
    revalidatePath(`/engagements/${engagementId}/categories/${actionRow.categoryId}`);
  }
  return { success: "Tag added" };
}

export async function untagAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const engagementId = formData.get("engagementId") as string;
  if (!engagementId) return { error: "Missing engagement ID" };

  const access = await requireWriteAccessWithStatus(engagementId, session.userId);
  if (!access) return { error: "You need write access to untag actions" };
  const lockError = checkContentWritable(access);
  if (lockError) return { error: lockError };

  const raw = {
    actionId: formData.get("actionId") as string,
    tagId: formData.get("tagId") as string,
  };

  const parsed = linkActionTagSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors as Record<
        string,
        string[]
      >,
    };
  }

  const [actionRow] = await db
    .select({ categoryId: categoryActions.categoryId })
    .from(categoryActions)
    .where(eq(categoryActions.id, parsed.data.actionId))
    .limit(1);

  await db
    .delete(actionTags)
    .where(
      and(
        eq(actionTags.actionId, parsed.data.actionId),
        eq(actionTags.tagId, parsed.data.tagId)
      )
    );

  revalidatePath(`/engagements/${engagementId}`);
  if (actionRow) {
    revalidatePath(`/engagements/${engagementId}/categories/${actionRow.categoryId}`);
  }
  return { success: "Tag removed" };
}

export async function createCustomTag(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const raw = {
    name: formData.get("name") as string,
    description: (formData.get("description") as string) || undefined,
  };

  const parsed = createTagSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors as Record<
        string,
        string[]
      >,
    };
  }

  await db.insert(tags).values({
    name: parsed.data.name.trim(),
    description: parsed.data.description?.trim(),
    isSystem: false,
    createdBy: session.userId,
  });

  return { success: "Tag created" };
}
