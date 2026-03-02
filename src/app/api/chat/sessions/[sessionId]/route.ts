import { NextRequest, NextResponse } from "next/server";
import { eq, and, asc } from "drizzle-orm";
import { db } from "@/db";
import { chatSessions, chatMessages } from "@/db/schema";
import { getSession } from "@/lib/auth/session";

// Load messages for a chat session
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sessionId } = await params;

  // Verify session belongs to this user
  const [chatSession] = await db
    .select({
      id: chatSessions.id,
      title: chatSessions.title,
      engagementId: chatSessions.engagementId,
    })
    .from(chatSessions)
    .where(
      and(
        eq(chatSessions.id, sessionId),
        eq(chatSessions.userId, session.userId)
      )
    )
    .limit(1);

  if (!chatSession) {
    return NextResponse.json(
      { error: "Session not found" },
      { status: 404 }
    );
  }

  const messages = await db
    .select({
      id: chatMessages.id,
      role: chatMessages.role,
      content: chatMessages.content,
      toolCalls: chatMessages.toolCalls,
      createdAt: chatMessages.createdAt,
    })
    .from(chatMessages)
    .where(eq(chatMessages.sessionId, sessionId))
    .orderBy(asc(chatMessages.createdAt));

  return NextResponse.json({
    session: chatSession,
    messages,
  });
}

// Delete a chat session
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sessionId } = await params;

  // Verify session belongs to this user
  const [chatSession] = await db
    .select({ id: chatSessions.id })
    .from(chatSessions)
    .where(
      and(
        eq(chatSessions.id, sessionId),
        eq(chatSessions.userId, session.userId)
      )
    )
    .limit(1);

  if (!chatSession) {
    return NextResponse.json(
      { error: "Session not found" },
      { status: 404 }
    );
  }

  // CASCADE will delete messages
  await db.delete(chatSessions).where(eq(chatSessions.id, sessionId));

  return NextResponse.json({ ok: true });
}
