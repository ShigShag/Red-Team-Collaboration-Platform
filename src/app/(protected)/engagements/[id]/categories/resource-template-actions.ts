"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { resourceTemplates } from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import {
  createResourceTemplateSchema,
  updateResourceTemplateSchema,
  deleteResourceTemplateSchema,
} from "@/lib/validations";

export type TemplateField = {
  key: string;
  label: string;
  type: string;
  required?: boolean;
};

export type ResourceTemplateState = {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string[]>;
  template?: {
    id: string;
    name: string;
    icon: string;
    color: string | null;
    description: string | null;
    fields: TemplateField[];
    isSystem: boolean;
    createdBy: string | null;
  };
};

export async function createResourceTemplate(
  _prev: ResourceTemplateState,
  formData: FormData
): Promise<ResourceTemplateState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const fieldsJson = formData.get("fields") as string;
  let fields: TemplateField[] = [];
  if (fieldsJson) {
    try {
      fields = JSON.parse(fieldsJson);
    } catch {
      return { error: "Invalid fields format" };
    }
  }

  const raw = {
    name: formData.get("name") as string,
    icon: formData.get("icon") as string,
    color: (formData.get("color") as string) || undefined,
    description: (formData.get("description") as string) || undefined,
    fields,
  };

  const parsed = createResourceTemplateSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const [created] = await db
    .insert(resourceTemplates)
    .values({
      name: parsed.data.name.trim(),
      icon: parsed.data.icon,
      color: parsed.data.color || null,
      description: parsed.data.description?.trim() || null,
      fields: parsed.data.fields,
      isSystem: false,
      createdBy: session.userId,
    })
    .returning({
      id: resourceTemplates.id,
      name: resourceTemplates.name,
      icon: resourceTemplates.icon,
      color: resourceTemplates.color,
      description: resourceTemplates.description,
      fields: resourceTemplates.fields,
      isSystem: resourceTemplates.isSystem,
      createdBy: resourceTemplates.createdBy,
    });

  return {
    success: "Template created",
    template: created as ResourceTemplateState["template"],
  };
}

export async function updateResourceTemplate(
  _prev: ResourceTemplateState,
  formData: FormData
): Promise<ResourceTemplateState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const fieldsJson = formData.get("fields") as string;
  let fields: TemplateField[] = [];
  if (fieldsJson) {
    try {
      fields = JSON.parse(fieldsJson);
    } catch {
      return { error: "Invalid fields format" };
    }
  }

  const raw = {
    templateId: formData.get("templateId") as string,
    name: formData.get("name") as string,
    icon: formData.get("icon") as string,
    color: (formData.get("color") as string) || undefined,
    description: (formData.get("description") as string) || undefined,
    fields,
  };

  const parsed = updateResourceTemplateSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const [existing] = await db
    .select({ isSystem: resourceTemplates.isSystem })
    .from(resourceTemplates)
    .where(eq(resourceTemplates.id, parsed.data.templateId))
    .limit(1);

  if (!existing) return { error: "Template not found" };
  if (existing.isSystem) return { error: "System templates cannot be edited" };

  const [updated] = await db
    .update(resourceTemplates)
    .set({
      name: parsed.data.name.trim(),
      icon: parsed.data.icon,
      color: parsed.data.color || null,
      description: parsed.data.description?.trim() || null,
      fields: parsed.data.fields,
    })
    .where(eq(resourceTemplates.id, parsed.data.templateId))
    .returning({
      id: resourceTemplates.id,
      name: resourceTemplates.name,
      icon: resourceTemplates.icon,
      color: resourceTemplates.color,
      description: resourceTemplates.description,
      fields: resourceTemplates.fields,
      isSystem: resourceTemplates.isSystem,
      createdBy: resourceTemplates.createdBy,
    });

  return {
    success: "Template updated",
    template: updated as ResourceTemplateState["template"],
  };
}

export async function deleteResourceTemplate(
  _prev: ResourceTemplateState,
  formData: FormData
): Promise<ResourceTemplateState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const raw = {
    templateId: formData.get("templateId") as string,
  };

  const parsed = deleteResourceTemplateSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const [existing] = await db
    .select({ isSystem: resourceTemplates.isSystem })
    .from(resourceTemplates)
    .where(eq(resourceTemplates.id, parsed.data.templateId))
    .limit(1);

  if (!existing) return { error: "Template not found" };
  if (existing.isSystem) return { error: "System templates cannot be deleted" };

  try {
    await db
      .delete(resourceTemplates)
      .where(eq(resourceTemplates.id, parsed.data.templateId));
  } catch (err: unknown) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: string }).code === "23503"
    ) {
      return {
        error: "This template is in use by one or more resources and cannot be deleted",
      };
    }
    throw err;
  }

  return { success: "Template deleted" };
}
