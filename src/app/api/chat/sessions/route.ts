import { NextRequest, NextResponse } from "next/server";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { chatSessions, engagementMembers } from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { chatSessionCreateSchema } from "@/lib/validations";

// List chat sessions for an engagement
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rawEngagementId = request.nextUrl.searchParams.get("engagementId");
  const uuidResult = z.string().uuid().safeParse(rawEngagementId);
  if (!uuidResult.success) {
    return NextResponse.json(
      { error: "Valid engagementId is required" },
      { status: 400 }
    );
  }
  const engagementId = uuidResult.data;

  // Verify membership
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

  if (!member) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  const sessions = await db
    .select({
      id: chatSessions.id,
      title: chatSessions.title,
      createdAt: chatSessions.createdAt,
      updatedAt: chatSessions.updatedAt,
    })
    .from(chatSessions)
    .where(
      and(
        eq(chatSessions.engagementId, engagementId),
        eq(chatSessions.userId, session.userId)
      )
    )
    .orderBy(desc(chatSessions.updatedAt))
    .limit(50);

  return NextResponse.json({ sessions });
}

// Create a new chat session
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = chatSessionCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Valid engagementId is required" },
      { status: 400 }
    );
  }
  const { engagementId } = parsed.data;

  // Verify membership
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

  if (!member) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  const [newSession] = await db
    .insert(chatSessions)
    .values({
      engagementId,
      userId: session.userId,
    })
    .returning({
      id: chatSessions.id,
      createdAt: chatSessions.createdAt,
    });

  return NextResponse.json({ session: newSession });
}
