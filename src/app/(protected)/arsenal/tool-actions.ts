"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import {
  arsenalTools,
  arsenalToolTactics,
} from "@/db/schema";
import { eq, ilike, and, sql } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import {
  createArsenalToolSchema,
  updateArsenalToolSchema,
} from "@/lib/validations";

export type ArsenalToolData = {
  id: string;
  name: string;
  description: string | null;
  url: string | null;
  category: string;
  notes: string | null;
  notesFormat: string;
  createdBy: string;
  createdAt: string;
  creatorName: string;
  tacticIds: string[];
};

export async function createArsenalTool(formData: {
  name: string;
  description?: string;
  url?: string;
  category: string;
  notes?: string;
  notesFormat: string;
  tacticIds?: string[];
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const parsed = createArsenalToolSchema.safeParse(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Invalid input" };
  }

  const { name, description, url, category, notes, notesFormat, tacticIds } =
    parsed.data;

  // Check for duplicate name
  const existing = await db
    .select({ id: arsenalTools.id })
    .from(arsenalTools)
    .where(ilike(arsenalTools.name, name))
    .limit(1);

  if (existing.length > 0) {
    return { error: "A tool with this name already exists" };
  }

  const cleanUrl = url && url.trim() !== "" ? url.trim() : null;

  const [tool] = await db
    .insert(arsenalTools)
    .values({
      name,
      description: description || null,
      url: cleanUrl,
      category: category as typeof arsenalTools.category.enumValues[number],
      notes: notes || null,
      notesFormat,
      createdBy: session.userId,
    })
    .returning({ id: arsenalTools.id });

  // Link tactics
  if (tacticIds && tacticIds.length > 0) {
    await db.insert(arsenalToolTactics).values(
      tacticIds.map((tacticId) => ({
        toolId: tool.id,
        tacticId,
      }))
    );
  }

  revalidatePath("/arsenal");
  return { success: "Tool created" };
}

export async function updateArsenalTool(formData: {
  toolId: string;
  name: string;
  description?: string;
  url?: string;
  category: string;
  notes?: string;
  notesFormat: string;
  tacticIds?: string[];
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const parsed = updateArsenalToolSchema.safeParse(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Invalid input" };
  }

  const { toolId, name, description, url, category, notes, notesFormat, tacticIds } =
    parsed.data;

  // Verify ownership
  const [existing] = await db
    .select({ createdBy: arsenalTools.createdBy })
    .from(arsenalTools)
    .where(eq(arsenalTools.id, toolId));

  if (!existing) return { error: "Tool not found" };
  if (existing.createdBy !== session.userId && !session.isAdmin) {
    return { error: "Only the creator or an admin can modify this" };
  }

  // Check for duplicate name (excluding self)
  const duplicate = await db
    .select({ id: arsenalTools.id })
    .from(arsenalTools)
    .where(and(ilike(arsenalTools.name, name), sql`${arsenalTools.id} != ${toolId}`))
    .limit(1);

  if (duplicate.length > 0) {
    return { error: "A tool with this name already exists" };
  }

  const cleanUrl = url && url.trim() !== "" ? url.trim() : null;

  await db
    .update(arsenalTools)
    .set({
      name,
      description: description || null,
      url: cleanUrl,
      category: category as typeof arsenalTools.category.enumValues[number],
      notes: notes || null,
      notesFormat,
      updatedAt: new Date(),
    })
    .where(eq(arsenalTools.id, toolId));

  // Replace tactic links
  await db
    .delete(arsenalToolTactics)
    .where(eq(arsenalToolTactics.toolId, toolId));

  if (tacticIds && tacticIds.length > 0) {
    await db.insert(arsenalToolTactics).values(
      tacticIds.map((tacticId) => ({
        toolId,
        tacticId,
      }))
    );
  }

  revalidatePath("/arsenal");
  return { success: "Tool updated" };
}

export async function deleteArsenalTool(toolId: string) {
  const session = await getSession();
  if (!session) redirect("/login");

  const [existing] = await db
    .select({ createdBy: arsenalTools.createdBy })
    .from(arsenalTools)
    .where(eq(arsenalTools.id, toolId));

  if (!existing) return { error: "Tool not found" };
  if (existing.createdBy !== session.userId && !session.isAdmin) {
    return { error: "Only the creator or an admin can delete this" };
  }

  await db.delete(arsenalTools).where(eq(arsenalTools.id, toolId));

  revalidatePath("/arsenal");
  return { success: "Tool deleted" };
}
