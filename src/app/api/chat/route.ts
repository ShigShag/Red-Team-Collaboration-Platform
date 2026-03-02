import { NextRequest, NextResponse } from "next/server";
import { eq, and, desc } from "drizzle-orm";
import { db } from "@/db";
import {
  engagements,
  engagementMembers,
  chatSessions,
  chatMessages,
} from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { chatLimiter } from "@/lib/rate-limit";
import {
  ollamaChat,
  parseOllamaStream,
  isOllamaConfigured,
  type OllamaMessage,
} from "@/lib/ai/ollama-client";
import { chatTools } from "@/lib/ai/tool-definitions";
import { executeTool } from "@/lib/ai/tool-executor";
import { buildSystemPrompt } from "@/lib/ai/system-prompt";

const MAX_MESSAGE_LENGTH = 2000;
const MAX_HISTORY_MESSAGES = 20;
const MAX_TOOL_ROUNDS = 8;

// Valid tool names for text-based tool call parsing
const TOOL_NAMES = new Set(
  chatTools.map((t) => t.function.name)
);

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await isOllamaConfigured())) {
    return NextResponse.json(
      { error: "AI assistant is not configured" },
      { status: 503 }
    );
  }

  // Rate limit
  const rl = chatLimiter.consume(session.userId);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many messages. Please wait." },
      { status: 429 }
    );
  }

  const body = (await request.json()) as {
    engagementId?: string;
    message?: string;
    chatSessionId?: string;
  };

  const { engagementId, message, chatSessionId } = body;

  if (!engagementId || !message) {
    return NextResponse.json(
      { error: "engagementId and message are required" },
      { status: 400 }
    );
  }

  // Sanitize message
  const cleanMessage = message
    .slice(0, MAX_MESSAGE_LENGTH)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "")
    .trim();

  if (!cleanMessage) {
    return NextResponse.json(
      { error: "Message cannot be empty" },
      { status: 400 }
    );
  }

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

  // Get engagement context for system prompt
  const [engagement] = await db
    .select({
      name: engagements.name,
      description: engagements.description,
      status: engagements.status,
      startDate: engagements.startDate,
      endDate: engagements.endDate,
    })
    .from(engagements)
    .where(eq(engagements.id, engagementId))
    .limit(1);

  if (!engagement) {
    return NextResponse.json(
      { error: "Engagement not found" },
      { status: 404 }
    );
  }

  const memberRows = await db
    .select({ role: engagementMembers.role })
    .from(engagementMembers)
    .where(eq(engagementMembers.engagementId, engagementId));
  const memberCount = memberRows.length;

  // Create or load chat session
  let sessionId = chatSessionId;
  if (!sessionId) {
    const [newSession] = await db
      .insert(chatSessions)
      .values({
        engagementId,
        userId: session.userId,
      })
      .returning({ id: chatSessions.id });
    sessionId = newSession.id;
  } else {
    // Verify session belongs to this user and engagement
    const [existing] = await db
      .select({ id: chatSessions.id })
      .from(chatSessions)
      .where(
        and(
          eq(chatSessions.id, sessionId),
          eq(chatSessions.userId, session.userId),
          eq(chatSessions.engagementId, engagementId)
        )
      )
      .limit(1);
    if (!existing) {
      return NextResponse.json(
        { error: "Chat session not found" },
        { status: 404 }
      );
    }
  }

  // Load history
  const history = await db
    .select({ role: chatMessages.role, content: chatMessages.content })
    .from(chatMessages)
    .where(eq(chatMessages.sessionId, sessionId))
    .orderBy(desc(chatMessages.createdAt))
    .limit(MAX_HISTORY_MESSAGES);

  history.reverse();

  // Build messages array
  const systemPrompt = buildSystemPrompt({
    name: engagement.name,
    description: engagement.description,
    status: engagement.status ?? "active",
    startDate: engagement.startDate ?? null,
    endDate: engagement.endDate ?? null,
    memberCount: Number(memberCount) || 0,
  });

  // console.log("[AI Chat] System prompt:\n", systemPrompt);

  const ollamaMessages: OllamaMessage[] = [
    { role: "system", content: systemPrompt },
    ...history.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user", content: cleanMessage },
  ];

  // Save user message immediately
  await db.insert(chatMessages).values({
    sessionId,
    role: "user",
    content: cleanMessage,
  });

  // Stream response via SSE
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      function send(data: Record<string, unknown>) {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
          );
        } catch {
          closed = true;
        }
      }

      try {
        let fullContent = "";
        const allToolCalls: { name: string; args: Record<string, unknown>; resultSummary: string }[] = [];
        let messages = [...ollamaMessages];
        let toolRound = 0;

        // Tool-use loop: LLM may request tools, we execute and feed back
        while (toolRound < MAX_TOOL_ROUNDS) {
          // console.log(`\n[AI Chat] === Tool round ${toolRound} ===`);
          // console.log(`[AI Chat] Sending ${messages.length} messages to Ollama`);
          const ollamaStream = await ollamaChat(messages, chatTools);
          let roundContent = "";
          let roundToolCalls: { function: { name: string; arguments: Record<string, unknown> } }[] = [];

          // Stream tokens in real-time. For native tool-calling models,
          // tool calls arrive as structured data (not content), so streaming
          // content immediately is safe. For text-based tool call fallback,
          // we buffer only when the first chunk looks like a tool call pattern.
          let buffering = false;
          const bufferedChunks: string[] = [];

          for await (const chunk of parseOllamaStream(ollamaStream)) {
            if (chunk.message?.tool_calls && chunk.message.tool_calls.length > 0) {
              roundToolCalls.push(...chunk.message.tool_calls);
            }
            if (chunk.message?.content) {
              roundContent += chunk.message.content;

              // On first content chunk, check if it looks like a text-based tool call
              if (!buffering && bufferedChunks.length === 0 && roundToolCalls.length === 0) {
                const trimmedStart = roundContent.trimStart();
                const looksLikeToolCall =
                  /^\w+\[ARGS\]/i.test(trimmedStart) ||
                  /^\w+\(\{/i.test(trimmedStart) ||
                  trimmedStart.startsWith("<tool_call>") ||
                  trimmedStart.startsWith('{"name"');
                if (looksLikeToolCall) {
                  buffering = true;
                }
              }

              if (buffering) {
                bufferedChunks.push(chunk.message.content);
              } else if (roundToolCalls.length === 0) {
                // Stream token to client immediately
                send({ type: "token", content: chunk.message.content });
              }
            }
          }

          // If we were buffering, check for text-based tool calls
          if (buffering && roundToolCalls.length === 0 && roundContent) {
            const parsed = parseTextToolCalls(roundContent);
            if (parsed.length > 0) {
              // console.log("[AI Chat] Parsed text-based tool calls:", JSON.stringify(parsed, null, 2));
              roundToolCalls = parsed;
              roundContent = "";
            } else {
              // False alarm — flush buffered content as tokens
              for (const c of bufferedChunks) {
                send({ type: "token", content: c });
              }
            }
          }

          // console.log(`[AI Chat] Round ${toolRound} content:`, roundContent.slice(0, 200) || "(empty)");
          // console.log(`[AI Chat] Round ${toolRound} tool calls:`, roundToolCalls.length);

          // If there are tool calls, execute them and continue the loop
          if (roundToolCalls.length > 0) {
            // Add the assistant message with tool calls to the conversation
            messages.push({
              role: "assistant",
              content: roundContent,
              tool_calls: roundToolCalls,
            });

            for (const tc of roundToolCalls) {
              // console.log(`[AI Chat] Executing tool: ${tc.function.name}`, JSON.stringify(tc.function.arguments));
              send({
                type: "tool_call",
                name: tc.function.name,
                args: tc.function.arguments,
              });

              const result = await executeTool(
                tc.function.name,
                tc.function.arguments,
                engagementId
              );

              // console.log(`[AI Chat] Tool result (${tc.function.name}):`, result.slice(0, 300) + (result.length > 300 ? "..." : ""));

              // Summarize for storage (keep it reasonable)
              const summary =
                result.length > 500
                  ? result.slice(0, 500) + "..."
                  : result;

              allToolCalls.push({
                name: tc.function.name,
                args: tc.function.arguments,
                resultSummary: summary,
              });

              send({
                type: "tool_result",
                name: tc.function.name,
                summary,
              });

              // Add tool result to conversation
              messages.push({
                role: "tool",
                content: result,
              });
            }

            fullContent += roundContent;
            toolRound++;
            continue;
          }

          // No tool calls — we're done
          fullContent += roundContent;
          // console.log(`[AI Chat] === Final response (${fullContent.length} chars) ===`);
          // console.log("[AI Chat] Full content:", fullContent.slice(0, 500) + (fullContent.length > 500 ? "..." : ""));
          break;
        }

        // Save assistant message
        await db.insert(chatMessages).values({
          sessionId: sessionId!,
          role: "assistant",
          content: fullContent,
          toolCalls: allToolCalls.length > 0 ? allToolCalls : null,
        });

        // Update session timestamp
        await db
          .update(chatSessions)
          .set({ updatedAt: new Date() })
          .where(eq(chatSessions.id, sessionId!));

        // Auto-title on first message
        if (!chatSessionId) {
          const title = cleanMessage.slice(0, 80) + (cleanMessage.length > 80 ? "..." : "");
          await db
            .update(chatSessions)
            .set({ title })
            .where(eq(chatSessions.id, sessionId!));
        }

        // Note: AI chat messages are NOT logged to the activity feed.
        // Chat history is already persisted in chatSessions/chatMessages tables.
        // Logging every message would flood the engagement activity timeline.

        send({ type: "done", chatSessionId: sessionId });
        closed = true;
        controller.close();
      } catch (error) {
        if (!closed) {
          console.error("Chat stream error:", error);
          send({
            type: "error",
            message:
              error instanceof Error
                ? error.message
                : "An error occurred",
          });
          closed = true;
          controller.close();
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

/**
 * Parse text-based tool calls from models that don't support native tool-calling.
 * Handles common patterns:
 *   tool_name[ARGS]{"key":"value"}
 *   tool_name({"key":"value"})
 *   {"name":"tool_name","arguments":{"key":"value"}}
 *   <tool_call>{"name":"tool_name","arguments":{"key":"value"}}</tool_call>
 */
function parseTextToolCalls(
  text: string
): { function: { name: string; arguments: Record<string, unknown> } }[] {
  const results: { function: { name: string; arguments: Record<string, unknown> } }[] = [];

  // Pattern 1: tool_name[ARGS]{...} or tool_name[ARGS] {...}
  const argsPattern = /(\w+)\[ARGS\]\s*(\{[^}]*\})/gi;
  for (const match of text.matchAll(argsPattern)) {
    const name = match[1];
    if (TOOL_NAMES.has(name)) {
      try {
        const args = JSON.parse(match[2]);
        results.push({ function: { name, arguments: args } });
      } catch { /* skip malformed JSON */ }
    }
  }
  if (results.length > 0) return results;

  // Pattern 2: tool_name({...})
  const parenPattern = /(\w+)\((\{[^}]*\})\)/gi;
  for (const match of text.matchAll(parenPattern)) {
    const name = match[1];
    if (TOOL_NAMES.has(name)) {
      try {
        const args = JSON.parse(match[2]);
        results.push({ function: { name, arguments: args } });
      } catch { /* skip */ }
    }
  }
  if (results.length > 0) return results;

  // Pattern 3: <tool_call>{"name":"...","arguments":{...}}</tool_call>
  const xmlPattern = /<tool_call>\s*(\{[\s\S]*?\})\s*<\/tool_call>/gi;
  for (const match of text.matchAll(xmlPattern)) {
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed.name && TOOL_NAMES.has(parsed.name)) {
        results.push({
          function: {
            name: parsed.name,
            arguments: parsed.arguments ?? parsed.parameters ?? {},
          },
        });
      }
    } catch { /* skip */ }
  }
  if (results.length > 0) return results;

  // Pattern 4: {"name":"tool_name","arguments":{...}} as standalone JSON
  const jsonPattern = /\{"name"\s*:\s*"(\w+)"\s*,\s*"(?:arguments|parameters)"\s*:\s*(\{[^}]*\})\s*\}/gi;
  for (const match of text.matchAll(jsonPattern)) {
    const name = match[1];
    if (TOOL_NAMES.has(name)) {
      try {
        const args = JSON.parse(match[2]);
        results.push({ function: { name, arguments: args } });
      } catch { /* skip */ }
    }
  }

  return results;
}
