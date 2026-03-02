"use client";

import { useState, useCallback, useRef, useEffect } from "react";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: { name: string; args: Record<string, unknown>; resultSummary: string }[];
  createdAt?: string;
}

interface ToolCallEvent {
  name: string;
  args: Record<string, unknown>;
}

const TOOLS_HELP = `**Available tools:**

| Tool | Description |
|------|-------------|
| \`get_engagement_summary\` | Overview: name, status, dates, team size, finding/action counts |
| \`list_findings\` | Query findings by severity or category |
| \`get_finding_detail\` | Full detail of a specific finding (overview, impact, recommendation) |
| \`list_actions\` | Actions/operations timeline by category |
| \`list_categories\` | All categories with finding & action counts |
| \`list_scope_targets\` | In-scope targets (IPs, CIDRs, domains, URLs) |
| \`list_scope_exclusions\` | Out-of-scope exclusions with justification |
| \`search_mitre_techniques\` | Search MITRE ATT&CK by name, ID, or tactic |
| \`list_resources\` | Resources (evidence) — metadata only, no secrets |
| \`get_engagement_stats\` | Severity distribution, CVSS stats, counts |
| \`list_ip_geolocations\` | IP addresses with country data |
| \`list_activity\` | Audit log — who did what and when (filterable by actor) |
| \`search_content\` | Full-text search across findings, actions & resources |

**Slash commands:** \`/tools\` — this list, \`/clear\` — clear chat`;

export function useChatStream(engagementId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [activeToolCalls, setActiveToolCalls] = useState<ToolCallEvent[]>([]);
  const [chatSessionId, setChatSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Use a ref for accumulated streaming content to avoid re-renders on every token.
  // A setInterval loop syncs the ref to state at ~10fps instead of per-token.
  const streamRef = useRef("");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current !== null) clearInterval(intervalRef.current);
    };
  }, []);

  function startStreamSync() {
    let lastSynced = "";
    intervalRef.current = setInterval(() => {
      const current = streamRef.current;
      if (current !== lastSynced) {
        lastSynced = current;
        setStreamingContent(current);
      }
    }, 100);
  }

  function stopStreamSync() {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    // Final sync
    setStreamingContent(streamRef.current);
  }

  const sendMessage = useCallback(
    async (message: string) => {
      if (isStreaming) return;

      const trimmed = message.trim().toLowerCase();

      // Handle local slash commands
      if (trimmed === "/tools" || trimmed === "/help") {
        const userMsg: ChatMessage = {
          id: `temp-${Date.now()}`,
          role: "user",
          content: message,
        };
        const assistantMsg: ChatMessage = {
          id: `msg-${Date.now()}`,
          role: "assistant",
          content: TOOLS_HELP,
        };
        setMessages((prev) => [...prev, userMsg, assistantMsg]);
        return;
      }

      if (trimmed === "/clear") {
        setMessages([]);
        setError(null);
        return;
      }

      setError(null);
      setIsStreaming(true);
      streamRef.current = "";
      setStreamingContent("");
      setActiveToolCalls([]);
      startStreamSync();

      // Add user message immediately
      const userMsg: ChatMessage = {
        id: `temp-${Date.now()}`,
        role: "user",
        content: message,
      };
      setMessages((prev) => [...prev, userMsg]);

      const toolCalls: ChatMessage["toolCalls"] = [];

      try {
        abortRef.current = new AbortController();

        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            engagementId,
            message,
            chatSessionId,
          }),
          signal: abortRef.current.signal,
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || `Request failed (${response.status})`);
        }

        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const event = JSON.parse(line.slice(6));

              switch (event.type) {
                case "token":
                  streamRef.current += event.content;
                  break;

                case "tool_call":
                  setActiveToolCalls((prev) => [
                    ...prev,
                    { name: event.name, args: event.args },
                  ]);
                  break;

                case "tool_result":
                  toolCalls.push({
                    name: event.name,
                    args: {},
                    resultSummary: event.summary,
                  });
                  setActiveToolCalls([]);
                  break;

                case "done":
                  if (event.chatSessionId) {
                    setChatSessionId(event.chatSessionId);
                  }
                  break;

                case "error":
                  throw new Error(event.message);
              }
            } catch (e) {
              if (e instanceof Error && e.message !== "Unexpected end of JSON input") {
                throw e;
              }
            }
          }
        }

        // Add assistant message
        const assistantMsg: ChatMessage = {
          id: `msg-${Date.now()}`,
          role: "assistant",
          content: streamRef.current,
          toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          // User cancelled — preserve whatever was streamed so far
          const partial = streamRef.current;
          if (partial) {
            const assistantMsg: ChatMessage = {
              id: `msg-${Date.now()}`,
              role: "assistant",
              content: partial,
              toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
            };
            setMessages((prev) => [...prev, assistantMsg]);
          }
        } else {
          setError(
            err instanceof Error ? err.message : "An error occurred"
          );
        }
      } finally {
        stopStreamSync();
        setIsStreaming(false);
        streamRef.current = "";
        setStreamingContent("");
        setActiveToolCalls([]);
        abortRef.current = null;
      }
    },
    [engagementId, chatSessionId, isStreaming]
  );

  const loadSession = useCallback(
    async (sessionId: string) => {
      try {
        const res = await fetch(`/api/chat/sessions/${sessionId}`);
        if (!res.ok) throw new Error("Failed to load session");
        const data = await res.json();
        setChatSessionId(sessionId);
        setMessages(
          data.messages.map((m: { id: string; role: string; content: string; toolCalls: unknown; createdAt: string }) => ({
            id: m.id,
            role: m.role as "user" | "assistant",
            content: m.content,
            toolCalls: m.toolCalls as ChatMessage["toolCalls"],
            createdAt: m.createdAt,
          }))
        );
        setError(null);
      } catch {
        setError("Failed to load chat session");
      }
    },
    []
  );

  const startNewSession = useCallback(() => {
    setChatSessionId(null);
    setMessages([]);
    setError(null);
  }, []);

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return {
    messages,
    isStreaming,
    streamingContent,
    activeToolCalls,
    chatSessionId,
    error,
    sendMessage,
    loadSession,
    startNewSession,
    stopStreaming,
  };
}
