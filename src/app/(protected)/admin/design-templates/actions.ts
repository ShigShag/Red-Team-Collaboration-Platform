"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";
import { unlink } from "fs/promises";
import { join } from "path";
import { db } from "@/db";
import { designTemplates } from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import {
  createDesignTemplateSchema,
  updateDesignTemplateSchema,
  deleteDesignTemplateSchema,
} from "@/lib/validations";
import { DEFAULT_THEME } from "@/lib/report-theme";

const LOGOS_DIR = join(process.cwd(), "data", "logos");

export type DesignTemplateState = {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string[]>;
};

export async function createDesignTemplate(
  _prev: DesignTemplateState,
  formData: FormData
): Promise<DesignTemplateState> {
  const session = await getSession();
  if (!session || !session.isAdmin) redirect("/login");

  const raw = {
    name: formData.get("name"),
    description: formData.get("description"),
    theme: formData.get("theme"),
  };

  const result = createDesignTemplateSchema.safeParse(raw);
  if (!result.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of result.error.issues) {
      const key = issue.path.join(".");
      fieldErrors[key] = fieldErrors[key] ?? [];
      fieldErrors[key].push(issue.message);
    }
    return { fieldErrors };
  }

  let parsedTheme: Record<string, unknown>;
  try {
    parsedTheme = JSON.parse(result.data.theme);
  } catch {
    return { error: "Invalid theme JSON" };
  }

  // Logo fields from formData (set after logo upload)
  const logoDiskPath = (formData.get("logoDiskPath") as string) || null;
  const logoFilename = (formData.get("logoFilename") as string) || null;
  const logoMimeType = (formData.get("logoMimeType") as string) || null;
  const logoWidth = formData.get("logoWidth") ? Number(formData.get("logoWidth")) : null;
  const logoHeight = formData.get("logoHeight") ? Number(formData.get("logoHeight")) : null;
  const logoPosition = (formData.get("logoPosition") as string) || null;

  const mdxSource = (formData.get("mdxSource") as string) || null;

  await db.insert(designTemplates).values({
    name: result.data.name,
    description: result.data.description || null,
    theme: parsedTheme,
    mdxSource,
    logoDiskPath,
    logoFilename,
    logoMimeType,
    logoWidth,
    logoHeight,
    logoPosition,
    createdBy: session.userId,
  });

  revalidatePath("/admin/design-templates");
  return { success: "Design template created" };
}

export async function updateDesignTemplate(
  _prev: DesignTemplateState,
  formData: FormData
): Promise<DesignTemplateState> {
  const session = await getSession();
  if (!session || !session.isAdmin) redirect("/login");

  const raw = {
    templateId: formData.get("templateId"),
    name: formData.get("name"),
    description: formData.get("description"),
    theme: formData.get("theme"),
  };

  const result = updateDesignTemplateSchema.safeParse(raw);
  if (!result.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of result.error.issues) {
      const key = issue.path.join(".");
      fieldErrors[key] = fieldErrors[key] ?? [];
      fieldErrors[key].push(issue.message);
    }
    return { fieldErrors };
  }

  // Check not system template
  const [existing] = await db
    .select({ isSystem: designTemplates.isSystem })
    .from(designTemplates)
    .where(eq(designTemplates.id, result.data.templateId))
    .limit(1);

  if (!existing) return { error: "Template not found" };
  if (existing.isSystem) return { error: "Cannot modify system templates" };

  let parsedTheme: Record<string, unknown>;
  try {
    parsedTheme = JSON.parse(result.data.theme);
  } catch {
    return { error: "Invalid theme JSON" };
  }

  const logoDiskPath = (formData.get("logoDiskPath") as string) || null;
  const logoFilename = (formData.get("logoFilename") as string) || null;
  const logoMimeType = (formData.get("logoMimeType") as string) || null;
  const logoWidth = formData.get("logoWidth") ? Number(formData.get("logoWidth")) : null;
  const logoHeight = formData.get("logoHeight") ? Number(formData.get("logoHeight")) : null;
  const logoPosition = (formData.get("logoPosition") as string) || null;

  const mdxSource = (formData.get("mdxSource") as string) || null;

  await db
    .update(designTemplates)
    .set({
      name: result.data.name,
      description: result.data.description || null,
      theme: parsedTheme,
      mdxSource,
      logoDiskPath,
      logoFilename,
      logoMimeType,
      logoWidth,
      logoHeight,
      logoPosition,
      updatedAt: new Date(),
    })
    .where(eq(designTemplates.id, result.data.templateId));

  revalidatePath("/admin/design-templates");
  return { success: "Design template updated" };
}

export async function deleteDesignTemplate(
  _prev: DesignTemplateState,
  formData: FormData
): Promise<DesignTemplateState> {
  const session = await getSession();
  if (!session || !session.isAdmin) redirect("/login");

  const raw = { templateId: formData.get("templateId") };
  const result = deleteDesignTemplateSchema.safeParse(raw);
  if (!result.success) {
    return { error: "Invalid template ID" };
  }

  const [existing] = await db
    .select({
      isSystem: designTemplates.isSystem,
      logoDiskPath: designTemplates.logoDiskPath,
    })
    .from(designTemplates)
    .where(eq(designTemplates.id, result.data.templateId))
    .limit(1);

  if (!existing) return { error: "Template not found" };
  if (existing.isSystem) return { error: "Cannot delete system templates" };

  // Delete logo file if exists
  if (existing.logoDiskPath) {
    try {
      await unlink(join(LOGOS_DIR, existing.logoDiskPath));
    } catch {
      // File may already be deleted
    }
  }

  await db
    .delete(designTemplates)
    .where(eq(designTemplates.id, result.data.templateId));

  revalidatePath("/admin/design-templates");
  return { success: "Design template deleted" };
}

export async function duplicateDesignTemplate(
  _prev: DesignTemplateState,
  formData: FormData
): Promise<DesignTemplateState> {
  const session = await getSession();
  if (!session || !session.isAdmin) redirect("/login");

  const templateId = formData.get("templateId") as string;
  if (!templateId) return { error: "Missing template ID" };

  const [source] = await db
    .select()
    .from(designTemplates)
    .where(eq(designTemplates.id, templateId))
    .limit(1);

  if (!source) return { error: "Template not found" };

  await db.insert(designTemplates).values({
    name: `${source.name} (Copy)`,
    description: source.description,
    theme: source.theme,
    mdxSource: source.mdxSource,
    logoDiskPath: source.logoDiskPath,
    logoFilename: source.logoFilename,
    logoMimeType: source.logoMimeType,
    logoWidth: source.logoWidth,
    logoHeight: source.logoHeight,
    logoPosition: source.logoPosition,
    isSystem: false,
    isDefault: false,
    createdBy: session.userId,
  });

  revalidatePath("/admin/design-templates");
  return { success: "Design template duplicated" };
}

export async function setDefaultTemplate(
  _prev: DesignTemplateState,
  formData: FormData
): Promise<DesignTemplateState> {
  const session = await getSession();
  if (!session || !session.isAdmin) redirect("/login");

  const templateId = formData.get("templateId") as string;
  if (!templateId) return { error: "Missing template ID" };

  // Clear all defaults, then set new default
  await db.update(designTemplates).set({ isDefault: false });
  await db
    .update(designTemplates)
    .set({ isDefault: true })
    .where(eq(designTemplates.id, templateId));

  revalidatePath("/admin/design-templates");
  return { success: "Default template updated" };
}
