"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import {
  scopeTargets,
  scopeExclusions,
  scopeConstraints,
  contacts,
  scopeDocuments,
  engagementMembers,
} from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import {
  addScopeTargetSchema,
  addScopeExclusionSchema,
  addScopeConstraintSchema,
  addContactSchema,
} from "@/lib/validations";
import { logActivity } from "@/lib/activity-log";
import {
  requireWriteAccessWithStatus,
  checkContentWritable,
} from "@/lib/engagement-access";
import {
  encryptFieldValue,
  decryptFieldValue,
} from "@/lib/crypto/resource-crypto";

export type ScopeState = {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string[]>;
};

// ── Scope Targets ─────────────────────────────────────────────────────

export async function addScopeTarget(
  _prev: ScopeState,
  formData: FormData
): Promise<ScopeState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const engagementId = formData.get("engagementId") as string;
  if (!engagementId) return { error: "Missing engagement ID" };

  const access = await requireWriteAccessWithStatus(engagementId, session.userId);
  if (!access) return { error: "You need write access to modify scope" };
  const lockError = checkContentWritable(access);
  if (lockError) return { error: lockError };

  const raw = {
    type: formData.get("type") as string,
    value: (formData.get("value") as string)?.trim(),
    notes: (formData.get("notes") as string)?.trim() || undefined,
  };

  const parsed = addScopeTargetSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0]?.toString() ?? "_";
      fieldErrors[key] = fieldErrors[key] ?? [];
      fieldErrors[key].push(issue.message);
    }
    return { fieldErrors };
  }

  await db.insert(scopeTargets).values({
    engagementId,
    type: parsed.data.type,
    value: parsed.data.value,
    notes: parsed.data.notes ?? null,
    createdBy: session.userId,
  });

  await logActivity({
    engagementId,
    actorId: session.userId,
    eventType: "scope_target_added",
    metadata: {
      targetType: parsed.data.type,
      targetValue: parsed.data.value,
    },
  });

  revalidatePath(`/engagements/${engagementId}/scope`);
  revalidatePath(`/engagements/${engagementId}`);
  return { success: "Target added to scope" };
}

export async function removeScopeTarget(
  _prev: ScopeState,
  formData: FormData
): Promise<ScopeState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const engagementId = formData.get("engagementId") as string;
  const targetId = formData.get("targetId") as string;
  if (!engagementId || !targetId) return { error: "Missing required fields" };

  const access = await requireWriteAccessWithStatus(engagementId, session.userId);
  if (!access) return { error: "You need write access to modify scope" };
  const lockError = checkContentWritable(access);
  if (lockError) return { error: lockError };

  const [target] = await db
    .select({ type: scopeTargets.type, value: scopeTargets.value })
    .from(scopeTargets)
    .where(
      and(
        eq(scopeTargets.id, targetId),
        eq(scopeTargets.engagementId, engagementId)
      )
    )
    .limit(1);

  if (!target) return { error: "Target not found" };

  await db
    .delete(scopeTargets)
    .where(
      and(
        eq(scopeTargets.id, targetId),
        eq(scopeTargets.engagementId, engagementId)
      )
    );

  await logActivity({
    engagementId,
    actorId: session.userId,
    eventType: "scope_target_removed",
    metadata: {
      targetType: target.type,
      targetValue: target.value,
    },
  });

  revalidatePath(`/engagements/${engagementId}/scope`);
  revalidatePath(`/engagements/${engagementId}`);
  return { success: "Target removed from scope" };
}

// ── Scope Exclusions ──────────────────────────────────────────────────

export async function addScopeExclusion(
  _prev: ScopeState,
  formData: FormData
): Promise<ScopeState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const engagementId = formData.get("engagementId") as string;
  if (!engagementId) return { error: "Missing engagement ID" };

  const access = await requireWriteAccessWithStatus(engagementId, session.userId);
  if (!access) return { error: "You need write access to modify scope" };
  const lockError = checkContentWritable(access);
  if (lockError) return { error: lockError };

  const raw = {
    type: formData.get("type") as string,
    value: (formData.get("value") as string)?.trim(),
    justification: (formData.get("justification") as string)?.trim(),
  };

  const parsed = addScopeExclusionSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0]?.toString() ?? "_";
      fieldErrors[key] = fieldErrors[key] ?? [];
      fieldErrors[key].push(issue.message);
    }
    return { fieldErrors };
  }

  await db.insert(scopeExclusions).values({
    engagementId,
    type: parsed.data.type,
    value: parsed.data.value,
    justification: parsed.data.justification,
    createdBy: session.userId,
  });

  await logActivity({
    engagementId,
    actorId: session.userId,
    eventType: "scope_exclusion_added",
    metadata: {
      targetType: parsed.data.type,
      targetValue: parsed.data.value,
    },
  });

  revalidatePath(`/engagements/${engagementId}/scope`);
  revalidatePath(`/engagements/${engagementId}`);
  return { success: "Exclusion added" };
}

export async function removeScopeExclusion(
  _prev: ScopeState,
  formData: FormData
): Promise<ScopeState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const engagementId = formData.get("engagementId") as string;
  const exclusionId = formData.get("exclusionId") as string;
  if (!engagementId || !exclusionId) return { error: "Missing required fields" };

  const access = await requireWriteAccessWithStatus(engagementId, session.userId);
  if (!access) return { error: "You need write access to modify scope" };
  const lockError = checkContentWritable(access);
  if (lockError) return { error: lockError };

  const [exclusion] = await db
    .select({ type: scopeExclusions.type, value: scopeExclusions.value })
    .from(scopeExclusions)
    .where(
      and(
        eq(scopeExclusions.id, exclusionId),
        eq(scopeExclusions.engagementId, engagementId)
      )
    )
    .limit(1);

  if (!exclusion) return { error: "Exclusion not found" };

  await db
    .delete(scopeExclusions)
    .where(
      and(
        eq(scopeExclusions.id, exclusionId),
        eq(scopeExclusions.engagementId, engagementId)
      )
    );

  await logActivity({
    engagementId,
    actorId: session.userId,
    eventType: "scope_exclusion_removed",
    metadata: {
      targetType: exclusion.type,
      targetValue: exclusion.value,
    },
  });

  revalidatePath(`/engagements/${engagementId}/scope`);
  revalidatePath(`/engagements/${engagementId}`);
  return { success: "Exclusion removed" };
}

// ── Scope Constraints ─────────────────────────────────────────────────

export async function addScopeConstraint(
  _prev: ScopeState,
  formData: FormData
): Promise<ScopeState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const engagementId = formData.get("engagementId") as string;
  if (!engagementId) return { error: "Missing engagement ID" };

  const access = await requireWriteAccessWithStatus(engagementId, session.userId);
  if (!access) return { error: "You need write access to modify scope" };
  const lockError = checkContentWritable(access);
  if (lockError) return { error: lockError };

  const raw = {
    constraint: (formData.get("constraint") as string)?.trim(),
  };

  const parsed = addScopeConstraintSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0]?.toString() ?? "_";
      fieldErrors[key] = fieldErrors[key] ?? [];
      fieldErrors[key].push(issue.message);
    }
    return { fieldErrors };
  }

  await db.insert(scopeConstraints).values({
    engagementId,
    constraint: parsed.data.constraint,
    createdBy: session.userId,
  });

  await logActivity({
    engagementId,
    actorId: session.userId,
    eventType: "scope_constraint_added",
    metadata: {
      constraintText: parsed.data.constraint,
    },
  });

  revalidatePath(`/engagements/${engagementId}/scope`);
  revalidatePath(`/engagements/${engagementId}`);
  return { success: "Constraint added" };
}

export async function addScopeConstraintsBatch(
  _prev: ScopeState,
  formData: FormData
): Promise<ScopeState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const engagementId = formData.get("engagementId") as string;
  if (!engagementId) return { error: "Missing engagement ID" };

  const access = await requireWriteAccessWithStatus(engagementId, session.userId);
  if (!access) return { error: "You need write access to modify scope" };
  const lockError = checkContentWritable(access);
  if (lockError) return { error: lockError };

  const constraintsJson = formData.get("constraints") as string;
  if (!constraintsJson) return { error: "No constraints provided" };

  let constraints: string[];
  try {
    constraints = JSON.parse(constraintsJson);
  } catch {
    return { error: "Invalid constraints data" };
  }

  constraints = constraints.map((c) => c.trim()).filter((c) => c.length > 0);
  if (constraints.length === 0) return { error: "No constraints provided" };

  await db.insert(scopeConstraints).values(
    constraints.map((constraint) => ({
      engagementId,
      constraint,
      createdBy: session.userId,
    }))
  );

  for (const constraint of constraints) {
    await logActivity({
      engagementId,
      actorId: session.userId,
      eventType: "scope_constraint_added",
      metadata: { constraintText: constraint },
    });
  }

  revalidatePath(`/engagements/${engagementId}/scope`);
  revalidatePath(`/engagements/${engagementId}`);
  return {
    success: `${constraints.length} constraint${constraints.length === 1 ? "" : "s"} added`,
  };
}

export async function removeScopeConstraint(
  _prev: ScopeState,
  formData: FormData
): Promise<ScopeState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const engagementId = formData.get("engagementId") as string;
  const constraintId = formData.get("constraintId") as string;
  if (!engagementId || !constraintId) return { error: "Missing required fields" };

  const access = await requireWriteAccessWithStatus(engagementId, session.userId);
  if (!access) return { error: "You need write access to modify scope" };
  const lockError = checkContentWritable(access);
  if (lockError) return { error: lockError };

  const [constraint] = await db
    .select({ constraint: scopeConstraints.constraint })
    .from(scopeConstraints)
    .where(
      and(
        eq(scopeConstraints.id, constraintId),
        eq(scopeConstraints.engagementId, engagementId)
      )
    )
    .limit(1);

  if (!constraint) return { error: "Constraint not found" };

  await db
    .delete(scopeConstraints)
    .where(
      and(
        eq(scopeConstraints.id, constraintId),
        eq(scopeConstraints.engagementId, engagementId)
      )
    );

  await logActivity({
    engagementId,
    actorId: session.userId,
    eventType: "scope_constraint_removed",
    metadata: {
      constraintText: constraint.constraint,
    },
  });

  revalidatePath(`/engagements/${engagementId}/scope`);
  revalidatePath(`/engagements/${engagementId}`);
  return { success: "Constraint removed" };
}

// ── Contacts ────────────────────────────────────────────────

export async function addContact(
  _prev: ScopeState,
  formData: FormData
): Promise<ScopeState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const engagementId = formData.get("engagementId") as string;
  if (!engagementId) return { error: "Missing engagement ID" };

  const access = await requireWriteAccessWithStatus(engagementId, session.userId);
  if (!access) return { error: "You need write access to modify contacts" };
  const lockError = checkContentWritable(access);
  if (lockError) return { error: lockError };

  const raw = {
    name: (formData.get("name") as string)?.trim(),
    title: (formData.get("title") as string)?.trim() || undefined,
    email: (formData.get("email") as string)?.trim() || undefined,
    phone: (formData.get("phone") as string)?.trim() || undefined,
    isPrimary: formData.get("isPrimary") === "true",
  };

  const parsed = addContactSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0]?.toString() ?? "_";
      fieldErrors[key] = fieldErrors[key] ?? [];
      fieldErrors[key].push(issue.message);
    }
    return { fieldErrors };
  }

  let encryptedPhone: string | null = null;
  if (parsed.data.phone) {
    try {
      encryptedPhone = encryptFieldValue(parsed.data.phone, engagementId);
    } catch {
      return { error: "Encryption key error — check RESOURCE_MASTER_KEY in .env" };
    }
  }

  await db.insert(contacts).values({
    engagementId,
    name: parsed.data.name,
    title: parsed.data.title ?? null,
    email: parsed.data.email || null,
    encryptedPhone,
    isPrimary: parsed.data.isPrimary ?? false,
    createdBy: session.userId,
  });

  await logActivity({
    engagementId,
    actorId: session.userId,
    eventType: "contact_added",
    metadata: {
      contactName: parsed.data.name,
    },
  });

  revalidatePath(`/engagements/${engagementId}/scope`);
  revalidatePath(`/engagements/${engagementId}`);
  return { success: "Contact added" };
}

export async function removeContact(
  _prev: ScopeState,
  formData: FormData
): Promise<ScopeState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const engagementId = formData.get("engagementId") as string;
  const contactId = formData.get("contactId") as string;
  if (!engagementId || !contactId) return { error: "Missing required fields" };

  const access = await requireWriteAccessWithStatus(engagementId, session.userId);
  if (!access) return { error: "You need write access to modify contacts" };
  const lockError = checkContentWritable(access);
  if (lockError) return { error: lockError };

  const [contact] = await db
    .select({ name: contacts.name })
    .from(contacts)
    .where(
      and(
        eq(contacts.id, contactId),
        eq(contacts.engagementId, engagementId)
      )
    )
    .limit(1);

  if (!contact) return { error: "Contact not found" };

  await db
    .delete(contacts)
    .where(
      and(
        eq(contacts.id, contactId),
        eq(contacts.engagementId, engagementId)
      )
    );

  await logActivity({
    engagementId,
    actorId: session.userId,
    eventType: "contact_removed",
    metadata: {
      contactName: contact.name,
    },
  });

  revalidatePath(`/engagements/${engagementId}/scope`);
  revalidatePath(`/engagements/${engagementId}`);
  return { success: "Contact removed" };
}

// ── Decrypt phone (read-only server action) ───────────────────────────

export async function decryptPhone(
  engagementId: string,
  encryptedPhone: string
): Promise<string | null> {
  const session = await getSession();
  if (!session) return null;

  const [member] = await db
    .select({ role: engagementMembers.role })
    .from(engagementMembers)
    .where(
      and(
        eq(engagementMembers.engagementId, engagementId),
        eq(engagementMembers.userId, session.userId)
      )
    )
    .limit(1);

  if (!member) return null;

  try {
    return decryptFieldValue(encryptedPhone, engagementId);
  } catch {
    return null;
  }
}

// ── Scope Documents ───────────────────────────────────────────────────

export async function removeScopeDocument(
  _prev: ScopeState,
  formData: FormData
): Promise<ScopeState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const engagementId = formData.get("engagementId") as string;
  const documentId = formData.get("documentId") as string;
  if (!engagementId || !documentId) return { error: "Missing required fields" };

  const access = await requireWriteAccessWithStatus(engagementId, session.userId);
  if (!access) return { error: "You need write access to manage documents" };
  const lockError = checkContentWritable(access);
  if (lockError) return { error: lockError };

  const [doc] = await db
    .select({
      name: scopeDocuments.name,
      documentType: scopeDocuments.documentType,
      diskPath: scopeDocuments.diskPath,
    })
    .from(scopeDocuments)
    .where(
      and(
        eq(scopeDocuments.id, documentId),
        eq(scopeDocuments.engagementId, engagementId)
      )
    )
    .limit(1);

  if (!doc) return { error: "Document not found" };

  await db
    .delete(scopeDocuments)
    .where(
      and(
        eq(scopeDocuments.id, documentId),
        eq(scopeDocuments.engagementId, engagementId)
      )
    );

  // Clean up file on disk
  const { unlink } = await import("fs/promises");
  const { join } = await import("path");
  const diskPath = join(process.cwd(), "data", "resources", doc.diskPath);
  unlink(diskPath).catch(() => {});

  await logActivity({
    engagementId,
    actorId: session.userId,
    eventType: "scope_document_removed",
    metadata: {
      documentType: doc.documentType,
      documentName: doc.name,
    },
  });

  revalidatePath(`/engagements/${engagementId}/scope`);
  revalidatePath(`/engagements/${engagementId}`);
  return { success: "Document removed" };
}
