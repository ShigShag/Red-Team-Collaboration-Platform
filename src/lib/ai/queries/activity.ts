import { eq, and, desc, or, ilike } from "drizzle-orm";
import { db } from "@/db";
import { engagementActivityLog, users } from "@/db/schema";

export async function listActivity(
  engagementId: string,
  args: { eventType?: string; actor?: string; limit?: number }
): Promise<string> {
  const limit = Math.min(args.limit ?? 20, 50);

  const conditions = [eq(engagementActivityLog.engagementId, engagementId)];
  if (args.eventType) {
    conditions.push(
      eq(
        engagementActivityLog.eventType,
        args.eventType as typeof engagementActivityLog.eventType.enumValues[number]
      )
    );
  }
  if (args.actor) {
    const pattern = `%${args.actor}%`;
    conditions.push(
      or(
        ilike(users.displayName, pattern),
        ilike(users.username, pattern)
      )!
    );
  }

  const events = await db
    .select({
      id: engagementActivityLog.id,
      eventType: engagementActivityLog.eventType,
      metadata: engagementActivityLog.metadata,
      createdAt: engagementActivityLog.createdAt,
      actorName: users.displayName,
      actorUsername: users.username,
    })
    .from(engagementActivityLog)
    .innerJoin(users, eq(engagementActivityLog.actorId, users.id))
    .where(and(...conditions))
    .orderBy(desc(engagementActivityLog.createdAt))
    .limit(limit);

  if (events.length === 0) {
    const filters: string[] = [];
    if (args.eventType) filters.push(`type "${args.eventType}"`);
    if (args.actor) filters.push(`actor "${args.actor}"`);
    return filters.length > 0
      ? `No activity events found matching ${filters.join(" and ")}.`
      : "No activity events found in this engagement.";
  }

  const lines = events.map((e, i) => {
    const actor = e.actorName ?? e.actorUsername;
    const time = new Date(e.createdAt).toISOString().replace("T", " ").slice(0, 19);
    const label = e.eventType.replace(/_/g, " ");
    const meta = formatMetadata(e.metadata as Record<string, unknown>);
    return `${i + 1}. **${label}** by ${actor} — ${time}${meta}`;
  });

  return `Recent activity (${events.length} event${events.length > 1 ? "s" : ""}):\n\n${lines.join("\n")}`;
}

function formatMetadata(metadata: Record<string, unknown>): string {
  if (!metadata || Object.keys(metadata).length === 0) return "";
  const parts: string[] = [];
  for (const [key, value] of Object.entries(metadata)) {
    if (value === null || value === undefined) continue;
    const label = key.replace(/([A-Z])/g, " $1").toLowerCase().trim();
    parts.push(`${label}: ${String(value).slice(0, 100)}`);
  }
  return parts.length > 0 ? `\n   ${parts.join(" | ")}` : "";
}
