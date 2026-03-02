"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import {
  arsenalTactics,
  arsenalTacticTags,
  arsenalToolTactics,
} from "@/db/schema";
import { eq, ilike, and, sql } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import {
  createArsenalTacticSchema,
  updateArsenalTacticSchema,
} from "@/lib/validations";

export type ArsenalTacticData = {
  id: string;
  name: string;
  description: string | null;
  content: string | null;
  contentFormat: string;
  category: string;
  createdBy: string;
  createdAt: string;
  creatorName: string;
  tagIds: string[];
  toolIds: string[];
};

export async function createArsenalTactic(formData: {
  name: string;
  description?: string;
  content?: string;
  contentFormat: string;
  category: string;
  tagIds?: string[];
  toolIds?: string[];
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const parsed = createArsenalTacticSchema.safeParse(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Invalid input" };
  }

  const { name, description, content, contentFormat, category, tagIds, toolIds } =
    parsed.data;

  // Check for duplicate name
  const existing = await db
    .select({ id: arsenalTactics.id })
    .from(arsenalTactics)
    .where(ilike(arsenalTactics.name, name))
    .limit(1);

  if (existing.length > 0) {
    return { error: "A tactic with this name already exists" };
  }

  const [tactic] = await db
    .insert(arsenalTactics)
    .values({
      name,
      description: description || null,
      content: content || null,
      contentFormat,
      category: category as typeof arsenalTactics.category.enumValues[number],
      createdBy: session.userId,
    })
    .returning({ id: arsenalTactics.id });

  // Link tags
  if (tagIds && tagIds.length > 0) {
    await db.insert(arsenalTacticTags).values(
      tagIds.map((tagId) => ({
        tacticId: tactic.id,
        tagId,
      }))
    );
  }

  // Link tools
  if (toolIds && toolIds.length > 0) {
    await db.insert(arsenalToolTactics).values(
      toolIds.map((toolId) => ({
        toolId,
        tacticId: tactic.id,
      }))
    );
  }

  revalidatePath("/arsenal");
  return { success: "Tactic created" };
}

export async function updateArsenalTactic(formData: {
  tacticId: string;
  name: string;
  description?: string;
  content?: string;
  contentFormat: string;
  category: string;
  tagIds?: string[];
  toolIds?: string[];
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const parsed = updateArsenalTacticSchema.safeParse(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Invalid input" };
  }

  const { tacticId, name, description, content, contentFormat, category, tagIds, toolIds } =
    parsed.data;

  // Verify ownership
  const [existing] = await db
    .select({ createdBy: arsenalTactics.createdBy })
    .from(arsenalTactics)
    .where(eq(arsenalTactics.id, tacticId));

  if (!existing) return { error: "Tactic not found" };
  if (existing.createdBy !== session.userId && !session.isAdmin) {
    return { error: "Only the creator or an admin can modify this" };
  }

  // Check for duplicate name (excluding self)
  const duplicate = await db
    .select({ id: arsenalTactics.id })
    .from(arsenalTactics)
    .where(and(ilike(arsenalTactics.name, name), sql`${arsenalTactics.id} != ${tacticId}`))
    .limit(1);

  if (duplicate.length > 0) {
    return { error: "A tactic with this name already exists" };
  }

  await db
    .update(arsenalTactics)
    .set({
      name,
      description: description || null,
      content: content || null,
      contentFormat,
      category: category as typeof arsenalTactics.category.enumValues[number],
      updatedAt: new Date(),
    })
    .where(eq(arsenalTactics.id, tacticId));

  // Replace tag links
  await db
    .delete(arsenalTacticTags)
    .where(eq(arsenalTacticTags.tacticId, tacticId));

  if (tagIds && tagIds.length > 0) {
    await db.insert(arsenalTacticTags).values(
      tagIds.map((tagId) => ({
        tacticId,
        tagId,
      }))
    );
  }

  // Replace tool links
  await db
    .delete(arsenalToolTactics)
    .where(eq(arsenalToolTactics.tacticId, tacticId));

  if (toolIds && toolIds.length > 0) {
    await db.insert(arsenalToolTactics).values(
      toolIds.map((toolId) => ({
        toolId,
        tacticId,
      }))
    );
  }

  revalidatePath("/arsenal");
  return { success: "Tactic updated" };
}

export async function deleteArsenalTactic(tacticId: string) {
  const session = await getSession();
  if (!session) redirect("/login");

  const [existing] = await db
    .select({ createdBy: arsenalTactics.createdBy })
    .from(arsenalTactics)
    .where(eq(arsenalTactics.id, tacticId));

  if (!existing) return { error: "Tactic not found" };
  if (existing.createdBy !== session.userId && !session.isAdmin) {
    return { error: "Only the creator or an admin can delete this" };
  }

  await db.delete(arsenalTactics).where(eq(arsenalTactics.id, tacticId));

  revalidatePath("/arsenal");
  return { success: "Tactic deleted" };
}
