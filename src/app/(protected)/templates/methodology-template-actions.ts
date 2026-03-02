"use server";

import { redirect } from "next/navigation";
import { eq, ilike, and, or } from "drizzle-orm";
import { db } from "@/db";
import { methodologyTemplates } from "@/db/schema";
import { getSession } from "@/lib/auth/session";

export type MethodologyTemplateData = {
  id: string;
  name: string;
  category: string;
  content: string;
  isSystem: boolean;
  createdBy: string | null;
  createdAt: Date;
};

/**
 * Search/list methodology templates with optional filters.
 */
export async function searchMethodologyTemplates(
  query?: string,
  category?: string
): Promise<MethodologyTemplateData[]> {
  const conditions = [];

  if (query && query.trim()) {
    const q = `%${query.trim()}%`;
    conditions.push(
      or(
        ilike(methodologyTemplates.name, q),
        ilike(methodologyTemplates.content, q)
      )
    );
  }

  if (category && category !== "all") {
    conditions.push(
      eq(
        methodologyTemplates.category,
        category as "web" | "network" | "cloud" | "mobile" | "wireless" | "social_engineering" | "physical" | "api" | "active_directory" | "code_review" | "general"
      )
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  return db
    .select({
      id: methodologyTemplates.id,
      name: methodologyTemplates.name,
      category: methodologyTemplates.category,
      content: methodologyTemplates.content,
      isSystem: methodologyTemplates.isSystem,
      createdBy: methodologyTemplates.createdBy,
      createdAt: methodologyTemplates.createdAt,
    })
    .from(methodologyTemplates)
    .where(whereClause)
    .orderBy(methodologyTemplates.name);
}

/**
 * Save the current methodology as a reusable template.
 */
export async function saveMethodologyTemplate(params: {
  name: string;
  category: string;
  content: string;
}): Promise<{ error?: string; success?: string }> {
  const session = await getSession();
  if (!session) redirect("/login");

  const name = params.name.trim();
  if (!name) return { error: "Template name is required" };
  if (!params.content.trim()) return { error: "Methodology content is empty" };

  // Check for duplicate name
  const [existing] = await db
    .select({ id: methodologyTemplates.id })
    .from(methodologyTemplates)
    .where(eq(methodologyTemplates.name, name))
    .limit(1);

  if (existing) {
    return { error: `A template named "${name}" already exists` };
  }

  await db.insert(methodologyTemplates).values({
    name,
    category:
      params.category as typeof methodologyTemplates.$inferInsert.category,
    content: params.content.trim(),
    isSystem: false,
    createdBy: session.userId,
  });

  return { success: "Template saved" };
}

/**
 * Update a custom methodology template (system templates are protected).
 */
export async function updateMethodologyTemplate(params: {
  id: string;
  name: string;
  category: string;
  content: string;
}): Promise<{ error?: string; success?: string }> {
  const session = await getSession();
  if (!session) redirect("/login");

  const [existing] = await db
    .select({ isSystem: methodologyTemplates.isSystem })
    .from(methodologyTemplates)
    .where(eq(methodologyTemplates.id, params.id))
    .limit(1);

  if (!existing) return { error: "Template not found" };
  if (existing.isSystem) return { error: "System templates cannot be edited" };

  const name = params.name.trim();
  if (!name) return { error: "Template name is required" };
  if (!params.content.trim()) return { error: "Methodology content is empty" };

  await db
    .update(methodologyTemplates)
    .set({
      name,
      category: params.category as typeof methodologyTemplates.$inferInsert.category,
      content: params.content.trim(),
      updatedAt: new Date(),
    })
    .where(eq(methodologyTemplates.id, params.id));

  return { success: "Template updated" };
}

/**
 * Delete a custom methodology template (system templates are protected).
 */
export async function deleteMethodologyTemplate(
  templateId: string
): Promise<{ error?: string; success?: string }> {
  const session = await getSession();
  if (!session) redirect("/login");

  const [existing] = await db
    .select({ isSystem: methodologyTemplates.isSystem })
    .from(methodologyTemplates)
    .where(eq(methodologyTemplates.id, templateId))
    .limit(1);

  if (!existing) return { error: "Template not found" };
  if (existing.isSystem)
    return { error: "System templates cannot be deleted" };

  await db
    .delete(methodologyTemplates)
    .where(eq(methodologyTemplates.id, templateId));

  return { success: "Template deleted" };
}
