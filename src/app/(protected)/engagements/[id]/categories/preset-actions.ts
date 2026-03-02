"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { categoryPresets } from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import {
  createPresetSchema,
  updatePresetSchema,
  deletePresetSchema,
} from "@/lib/validations";

export type PresetState = {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string[]>;
  preset?: {
    id: string;
    name: string;
    icon: string;
    color: string | null;
    description: string | null;
    isSystem: boolean;
    createdBy: string | null;
  };
};

export async function createPreset(
  _prev: PresetState,
  formData: FormData
): Promise<PresetState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const raw = {
    name: formData.get("name") as string,
    icon: formData.get("icon") as string,
    color: (formData.get("color") as string) || undefined,
    description: (formData.get("description") as string) || undefined,
  };

  const parsed = createPresetSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors as Record<
        string,
        string[]
      >,
    };
  }

  const [created] = await db
    .insert(categoryPresets)
    .values({
      name: parsed.data.name.trim(),
      icon: parsed.data.icon,
      color: parsed.data.color || null,
      description: parsed.data.description?.trim() || null,
      isSystem: false,
      createdBy: session.userId,
    })
    .returning({
      id: categoryPresets.id,
      name: categoryPresets.name,
      icon: categoryPresets.icon,
      color: categoryPresets.color,
      description: categoryPresets.description,
      isSystem: categoryPresets.isSystem,
      createdBy: categoryPresets.createdBy,
    });

  return { success: "Preset created", preset: created };
}

export async function updatePreset(
  _prev: PresetState,
  formData: FormData
): Promise<PresetState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const raw = {
    presetId: formData.get("presetId") as string,
    name: formData.get("name") as string,
    icon: formData.get("icon") as string,
    color: (formData.get("color") as string) || undefined,
    description: (formData.get("description") as string) || undefined,
  };

  const parsed = updatePresetSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors as Record<
        string,
        string[]
      >,
    };
  }

  // Verify preset exists and is not a system preset
  const [existing] = await db
    .select({ isSystem: categoryPresets.isSystem })
    .from(categoryPresets)
    .where(eq(categoryPresets.id, parsed.data.presetId))
    .limit(1);

  if (!existing) return { error: "Preset not found" };
  if (existing.isSystem) return { error: "System presets cannot be edited" };

  const [updated] = await db
    .update(categoryPresets)
    .set({
      name: parsed.data.name.trim(),
      icon: parsed.data.icon,
      color: parsed.data.color || null,
      description: parsed.data.description?.trim() || null,
    })
    .where(eq(categoryPresets.id, parsed.data.presetId))
    .returning({
      id: categoryPresets.id,
      name: categoryPresets.name,
      icon: categoryPresets.icon,
      color: categoryPresets.color,
      description: categoryPresets.description,
      isSystem: categoryPresets.isSystem,
      createdBy: categoryPresets.createdBy,
    });

  return { success: "Preset updated", preset: updated };
}

export async function deletePreset(
  _prev: PresetState,
  formData: FormData
): Promise<PresetState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const raw = {
    presetId: formData.get("presetId") as string,
  };

  const parsed = deletePresetSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors as Record<
        string,
        string[]
      >,
    };
  }

  // Verify preset exists and is not a system preset
  const [existing] = await db
    .select({ isSystem: categoryPresets.isSystem })
    .from(categoryPresets)
    .where(eq(categoryPresets.id, parsed.data.presetId))
    .limit(1);

  if (!existing) return { error: "Preset not found" };
  if (existing.isSystem) return { error: "System presets cannot be deleted" };

  try {
    await db
      .delete(categoryPresets)
      .where(eq(categoryPresets.id, parsed.data.presetId));
  } catch (err: unknown) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: string }).code === "23503"
    ) {
      return {
        error:
          "This type is in use by one or more categories and cannot be deleted",
      };
    }
    throw err;
  }

  return { success: "Preset deleted" };
}
