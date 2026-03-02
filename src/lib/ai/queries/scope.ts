import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { scopeTargets, scopeExclusions, scopeConstraints } from "@/db/schema";

export async function listScopeTargets(
  engagementId: string,
  args: { type?: string }
): Promise<string> {
  const conditions = [eq(scopeTargets.engagementId, engagementId)];
  if (args.type) {
    conditions.push(eq(scopeTargets.type, args.type as typeof scopeTargets.type.enumValues[number]));
  }

  const targets = await db
    .select({
      type: scopeTargets.type,
      value: scopeTargets.value,
      notes: scopeTargets.notes,
    })
    .from(scopeTargets)
    .where(and(...conditions))
    .orderBy(scopeTargets.type, scopeTargets.createdAt);

  if (targets.length === 0) return "No in-scope targets defined.";

  const lines = targets.map(
    (t, i) =>
      `${i + 1}. [${t.type.toUpperCase()}] ${t.value}${t.notes ? ` — ${t.notes}` : ""}`
  );

  return `${targets.length} in-scope target(s):\n\n${lines.join("\n")}`;
}

export async function listScopeExclusions(
  engagementId: string
): Promise<string> {
  const exclusions = await db
    .select({
      type: scopeExclusions.type,
      value: scopeExclusions.value,
      justification: scopeExclusions.justification,
    })
    .from(scopeExclusions)
    .where(eq(scopeExclusions.engagementId, engagementId))
    .orderBy(scopeExclusions.createdAt);

  if (exclusions.length === 0) return "No scope exclusions defined.";

  const lines = exclusions.map(
    (e, i) =>
      `${i + 1}. [${e.type.toUpperCase()}] ${e.value}${e.justification ? ` — Reason: ${e.justification}` : ""}`
  );

  return `${exclusions.length} exclusion(s):\n\n${lines.join("\n")}`;
}
