import { NextRequest, NextResponse } from "next/server";
import { eq, desc, sql } from "drizzle-orm";
import { db } from "@/db";
import { notifications, users } from "@/db/schema";
import { getSession } from "@/lib/auth/session";

const PAGE_SIZE = 20;

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const page = Math.max(
    1,
    parseInt(request.nextUrl.searchParams.get("page") ?? "1", 10) || 1
  );
  const offset = (page - 1) * PAGE_SIZE;

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notifications)
    .where(eq(notifications.userId, session.userId));

  const items = await db
    .select({
      id: notifications.id,
      type: notifications.type,
      engagementId: notifications.engagementId,
      actorId: notifications.actorId,
      actorUsername: users.username,
      actorDisplayName: users.displayName,
      actorAvatarPath: users.avatarPath,
      metadata: notifications.metadata,
      read: notifications.read,
      createdAt: notifications.createdAt,
    })
    .from(notifications)
    .leftJoin(users, eq(notifications.actorId, users.id))
    .where(eq(notifications.userId, session.userId))
    .orderBy(desc(notifications.createdAt))
    .limit(PAGE_SIZE)
    .offset(offset);

  return NextResponse.json({
    notifications: items,
    page,
    totalPages: Math.max(1, Math.ceil(count / PAGE_SIZE)),
    totalCount: count,
  });
}
