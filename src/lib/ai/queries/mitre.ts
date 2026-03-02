import { and, ilike, eq, or } from "drizzle-orm";
import { db } from "@/db";
import { tags } from "@/db/schema";

export async function searchMitreTechniques(
  args: { query?: string; tactic?: string }
): Promise<string> {
  const conditions = [];

  // Only MITRE tags have a mitreId
  conditions.push(ilike(tags.mitreId, "%T%"));

  if (args.query) {
    const q = `%${args.query}%`;
    // Search in name OR mitreId
    conditions.push(
      or(ilike(tags.name, q), ilike(tags.mitreId, q))!
    );
  }

  if (args.tactic) {
    conditions.push(eq(tags.tactic, args.tactic));
  }

  const techniques = await db
    .select({
      name: tags.name,
      mitreId: tags.mitreId,
      tactic: tags.tactic,
    })
    .from(tags)
    .where(and(...conditions))
    .orderBy(tags.mitreId)
    .limit(30);

  if (techniques.length === 0) {
    return "No MITRE ATT&CK techniques match the search.";
  }

  const lines = techniques.map(
    (t) => `- ${t.mitreId} — ${t.name} [${t.tactic}]`
  );

  return `Found ${techniques.length} technique(s):\n\n${lines.join("\n")}`;
}
