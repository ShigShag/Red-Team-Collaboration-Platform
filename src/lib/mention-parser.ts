import { db } from "@/db";
import { users, engagementMembers } from "@/db/schema";
import { eq, inArray, and } from "drizzle-orm";

/**
 * Extract @username mentions from text content.
 * Returns unique lowercase usernames.
 */
export function parseMentions(content: string): string[] {
  const matches = content.match(/@([a-zA-Z0-9_-]+)/g);
  if (!matches) return [];
  const usernames = matches.map((m) => m.slice(1).toLowerCase());
  return [...new Set(usernames)];
}

/**
 * Resolve mentioned usernames to user records, filtered to engagement members only.
 */
export async function resolveMentionedUsers(
  usernames: string[],
  engagementId: string
): Promise<Array<{ id: string; username: string }>> {
  if (usernames.length === 0) return [];

  const results = await db
    .select({
      id: users.id,
      username: users.username,
    })
    .from(users)
    .innerJoin(
      engagementMembers,
      and(
        eq(engagementMembers.userId, users.id),
        eq(engagementMembers.engagementId, engagementId)
      )
    )
    .where(inArray(users.username, usernames));

  return results;
}
