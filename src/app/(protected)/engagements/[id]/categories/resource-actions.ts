"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { unlink } from "fs/promises";
import { join } from "path";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import {
  engagementMembers,
  engagementCategories,
  resources,
  resourceFields,
  resourceFiles,
} from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { createResourceSchema, updateResourceSchema, resourceFieldSchema } from "@/lib/validations";
import { logActivity } from "@/lib/activity-log";
import { encryptFieldValue, decryptFieldValue } from "@/lib/crypto/resource-crypto";
import { syncIpGeolocations } from "@/lib/ip-geolocation-sync";
import { ipGeolocationSources, domainResolutionSources } from "@/db/schema";
import {
  requireWriteAccessWithStatus,
  checkContentWritable,
} from "@/lib/engagement-access";

const RESOURCES_DIR = join(process.cwd(), "data", "resources");

export type ResourceState = {
  error?: string;
  success?: string;
  resourceId?: string;
  fieldErrors?: Record<string, string[]>;
};

async function requireReadAccess(
  engagementId: string,
  userId: string
): Promise<boolean> {
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

  return !!member;
}

// ── Create Resource ──────────────────────────────────────────────────

export async function createResource(
  _prev: ResourceState,
  formData: FormData
): Promise<ResourceState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const engagementId = formData.get("engagementId") as string;
  if (!engagementId) return { error: "Missing engagement ID" };

  const access = await requireWriteAccessWithStatus(engagementId, session.userId);
  if (!access) return { error: "You need write access to add resources" };
  const lockError = checkContentWritable(access);
  if (lockError) return { error: lockError };

  // Parse base resource fields
  const raw = {
    categoryId: formData.get("categoryId") as string,
    name: formData.get("name") as string,
    description: (formData.get("description") as string) || undefined,
    templateId: (formData.get("templateId") as string) || undefined,
  };

  const parsed = createResourceSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
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

  // Parse fields from JSON
  const fieldsJson = formData.get("fields") as string;
  let fieldEntries: { key: string; label: string; type: string; value?: string; language?: string }[] = [];
  if (fieldsJson) {
    try {
      const rawFields = JSON.parse(fieldsJson);
      if (!Array.isArray(rawFields)) return { error: "Invalid fields format" };
      for (const f of rawFields) {
        const fp = resourceFieldSchema.safeParse(f);
        if (!fp.success) return { error: `Invalid field: ${fp.error.issues[0]?.message}` };
        fieldEntries.push(fp.data as { key: string; label: string; type: string; value?: string; language?: string });
      }
    } catch {
      return { error: "Invalid fields JSON" };
    }
  }

  // Insert resource
  const [resource] = await db
    .insert(resources)
    .values({
      categoryId: parsed.data.categoryId,
      templateId: parsed.data.templateId || null,
      name: parsed.data.name.trim(),
      description: parsed.data.description?.trim() || null,
      createdBy: session.userId,
    })
    .returning({ id: resources.id });

  // Insert fields
  if (fieldEntries.length > 0) {
    await db.insert(resourceFields).values(
      fieldEntries.map((f, i) => ({
        resourceId: resource.id,
        key: f.key,
        label: f.label,
        type: f.type as "text" | "secret" | "url" | "code",
        language: f.type === "code" ? (f.language || null) : null,
        value: f.type === "secret" ? null : (f.value || null),
        encryptedValue:
          f.type === "secret" && f.value
            ? encryptFieldValue(f.value, engagementId)
            : null,
        sortOrder: i,
      }))
    );
  }

  // Files are uploaded separately via /api/resources/upload (streaming)

  // Extract IPs from non-secret text fields and resolve geolocation
  const textFieldValues = fieldEntries
    .filter((f) => f.type !== "secret")
    .map((f) => f.value);
  await syncIpGeolocations({
    engagementId,
    sourceType: "resource",
    sourceId: resource.id,
    texts: [parsed.data.name, parsed.data.description, ...textFieldValues],
  });

  await logActivity({
    engagementId,
    actorId: session.userId,
    eventType: "resource_created",
    metadata: {
      resourceName: parsed.data.name.trim(),
      categoryName: category.name,
      resourceId: resource.id,
      categoryId: parsed.data.categoryId,
    },
  });

  revalidatePath(`/engagements/${engagementId}`);
  revalidatePath(`/engagements/${engagementId}/categories/${parsed.data.categoryId}`);
  return { success: "Resource added", resourceId: resource.id };
}

// ── Update Resource ──────────────────────────────────────────────────

export async function updateResource(
  _prev: ResourceState,
  formData: FormData
): Promise<ResourceState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const engagementId = formData.get("engagementId") as string;
  if (!engagementId) return { error: "Missing engagement ID" };

  const access = await requireWriteAccessWithStatus(engagementId, session.userId);
  if (!access) return { error: "You need write access to edit resources" };
  const lockError = checkContentWritable(access);
  if (lockError) return { error: lockError };

  const raw = {
    resourceId: formData.get("resourceId") as string,
    name: formData.get("name") as string,
    description: (formData.get("description") as string) || undefined,
  };

  const parsed = updateResourceSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  // Verify resource exists and belongs to this engagement
  const [existing] = await db
    .select({
      id: resources.id,
      categoryId: resources.categoryId,
      categoryName: engagementCategories.name,
    })
    .from(resources)
    .innerJoin(
      engagementCategories,
      eq(resources.categoryId, engagementCategories.id)
    )
    .where(eq(resources.id, parsed.data.resourceId))
    .limit(1);

  if (!existing) return { error: "Resource not found" };

  // Verify category belongs to this engagement
  const [category] = await db
    .select({ id: engagementCategories.id })
    .from(engagementCategories)
    .where(
      and(
        eq(engagementCategories.id, existing.categoryId),
        eq(engagementCategories.engagementId, engagementId)
      )
    )
    .limit(1);

  if (!category) return { error: "Resource not found in this engagement" };

  // Parse fields from JSON
  const fieldsJson = formData.get("fields") as string;
  let fieldEntries: { key: string; label: string; type: string; value?: string; language?: string }[] = [];
  if (fieldsJson) {
    try {
      const rawFields = JSON.parse(fieldsJson);
      if (!Array.isArray(rawFields)) return { error: "Invalid fields format" };
      for (const f of rawFields) {
        const fp = resourceFieldSchema.safeParse(f);
        if (!fp.success) return { error: `Invalid field: ${fp.error.issues[0]?.message}` };
        fieldEntries.push(fp.data as { key: string; label: string; type: string; value?: string; language?: string });
      }
    } catch {
      return { error: "Invalid fields JSON" };
    }
  }

  // Update resource name/description
  await db
    .update(resources)
    .set({
      name: parsed.data.name.trim(),
      description: parsed.data.description?.trim() || null,
      updatedAt: new Date(),
    })
    .where(eq(resources.id, parsed.data.resourceId));

  // Fetch existing secret field values so we can preserve unchanged ones
  const existingFields = await db
    .select({
      key: resourceFields.key,
      type: resourceFields.type,
      encryptedValue: resourceFields.encryptedValue,
    })
    .from(resourceFields)
    .where(eq(resourceFields.resourceId, parsed.data.resourceId));

  const existingSecrets = new Map(
    existingFields
      .filter((f) => f.type === "secret" && f.encryptedValue)
      .map((f) => [f.key, f.encryptedValue!])
  );

  // Replace fields: delete existing and insert new
  await db
    .delete(resourceFields)
    .where(eq(resourceFields.resourceId, parsed.data.resourceId));

  if (fieldEntries.length > 0) {
    await db.insert(resourceFields).values(
      fieldEntries.map((f, i) => ({
        resourceId: parsed.data.resourceId,
        key: f.key,
        label: f.label,
        type: f.type as "text" | "secret" | "url" | "code",
        language: f.type === "code" ? (f.language || null) : null,
        value: f.type === "secret" ? null : (f.value || null),
        encryptedValue:
          f.type === "secret" && f.value
            ? encryptFieldValue(f.value, engagementId)
            : f.type === "secret"
              ? existingSecrets.get(f.key) || null
              : null,
        sortOrder: i,
      }))
    );
  }

  // Re-sync IP geolocations: clear old source links, then re-extract
  await db
    .delete(ipGeolocationSources)
    .where(
      and(
        eq(ipGeolocationSources.sourceType, "resource"),
        eq(ipGeolocationSources.sourceId, parsed.data.resourceId)
      )
    );
  await db
    .delete(domainResolutionSources)
    .where(
      and(
        eq(domainResolutionSources.sourceType, "resource"),
        eq(domainResolutionSources.sourceId, parsed.data.resourceId)
      )
    );
  const textFieldValues2 = fieldEntries
    .filter((f) => f.type !== "secret")
    .map((f) => f.value);
  await syncIpGeolocations({
    engagementId,
    sourceType: "resource",
    sourceId: parsed.data.resourceId,
    texts: [parsed.data.name, parsed.data.description, ...textFieldValues2],
  });

  await logActivity({
    engagementId,
    actorId: session.userId,
    eventType: "resource_updated",
    metadata: {
      resourceName: parsed.data.name.trim(),
      categoryName: existing.categoryName,
      resourceId: parsed.data.resourceId,
      categoryId: existing.categoryId,
    },
  });

  revalidatePath(`/engagements/${engagementId}`);
  revalidatePath(`/engagements/${engagementId}/categories/${existing.categoryId}`);
  return { success: "Resource updated" };
}

// ── Remove Resource ──────────────────────────────────────────────────

export async function removeResource(
  _prev: ResourceState,
  formData: FormData
): Promise<ResourceState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const engagementId = formData.get("engagementId") as string;
  const resourceId = formData.get("resourceId") as string;
  if (!engagementId || !resourceId) return { error: "Missing required fields" };

  const access = await requireWriteAccessWithStatus(engagementId, session.userId);
  if (!access) return { error: "You need write access to remove resources" };
  const lockError = checkContentWritable(access);
  if (lockError) return { error: lockError };

  // Look up files to delete from disk
  const files = await db
    .select({ diskPath: resourceFiles.diskPath })
    .from(resourceFiles)
    .where(eq(resourceFiles.resourceId, resourceId));

  // Look up resource details for revalidation and activity log
  const [resource] = await db
    .select({
      name: resources.name,
      categoryId: resources.categoryId,
      categoryName: engagementCategories.name,
    })
    .from(resources)
    .innerJoin(
      engagementCategories,
      eq(resources.categoryId, engagementCategories.id)
    )
    .where(eq(resources.id, resourceId))
    .limit(1);

  // Delete resource (cascades to fields + file records)
  await db.delete(resources).where(eq(resources.id, resourceId));

  // Delete encrypted files from disk
  for (const file of files) {
    const diskFilename = file.diskPath.split("/").pop();
    if (diskFilename) {
      try {
        await unlink(join(RESOURCES_DIR, diskFilename));
      } catch {
        // File may already be gone
      }
    }
  }

  if (resource) {
    await logActivity({
      engagementId,
      actorId: session.userId,
      eventType: "resource_deleted",
      metadata: {
        resourceName: resource.name,
        categoryName: resource.categoryName,
        resourceId: resourceId,
        categoryId: resource.categoryId,
      },
    });
  }

  revalidatePath(`/engagements/${engagementId}`);
  if (resource) {
    revalidatePath(`/engagements/${engagementId}/categories/${resource.categoryId}`);
  }
  return { success: "Resource removed" };
}

// ── Remove File from Resource ────────────────────────────────────────

export async function removeFileFromResource(
  _prev: ResourceState,
  formData: FormData
): Promise<ResourceState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const engagementId = formData.get("engagementId") as string;
  const fileId = formData.get("fileId") as string;
  if (!engagementId || !fileId) return { error: "Missing required fields" };

  const access = await requireWriteAccessWithStatus(engagementId, session.userId);
  if (!access) return { error: "You need write access" };
  const lockError = checkContentWritable(access);
  if (lockError) return { error: lockError };

  const [file] = await db
    .select({
      diskPath: resourceFiles.diskPath,
      resourceId: resourceFiles.resourceId,
    })
    .from(resourceFiles)
    .where(eq(resourceFiles.id, fileId))
    .limit(1);

  if (!file) return { error: "File not found" };

  await db.delete(resourceFiles).where(eq(resourceFiles.id, fileId));

  const diskFilename = file.diskPath.split("/").pop();
  if (diskFilename) {
    try {
      await unlink(join(RESOURCES_DIR, diskFilename));
    } catch {
      // File may already be gone
    }
  }

  const [resource] = await db
    .select({ categoryId: resources.categoryId })
    .from(resources)
    .where(eq(resources.id, file.resourceId))
    .limit(1);

  revalidatePath(`/engagements/${engagementId}`);
  if (resource) {
    revalidatePath(`/engagements/${engagementId}/categories/${resource.categoryId}`);
  }
  return { success: "File removed" };
}

// ── Decrypt Secret Field (on-demand) ─────────────────────────────────

export async function getDecryptedField(
  fieldId: string,
  engagementId: string
): Promise<{ value?: string; error?: string }> {
  const session = await getSession();
  if (!session) return { error: "Not authenticated" };

  const hasAccess = await requireReadAccess(engagementId, session.userId);
  if (!hasAccess) return { error: "Access denied" };

  const [field] = await db
    .select({ encryptedValue: resourceFields.encryptedValue })
    .from(resourceFields)
    .where(eq(resourceFields.id, fieldId))
    .limit(1);

  if (!field?.encryptedValue) return { error: "Field not found" };

  try {
    const value = decryptFieldValue(field.encryptedValue, engagementId);
    return { value };
  } catch {
    return { error: "Decryption failed" };
  }
}
