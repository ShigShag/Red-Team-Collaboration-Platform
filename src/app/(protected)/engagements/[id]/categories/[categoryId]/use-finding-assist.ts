"use client";

import { useState, useCallback, useRef, useEffect } from "react";

type AssistField = "overview" | "impact" | "recommendation";

interface FindingContext {
  title: string;
  severity: string;
  cvssScore: string | null;
  overview: string;
  overviewFormat: string;
  impact: string;
  impactFormat: string;
  recommendation: string;
  recommendationFormat: string;
  linkedResourceIds?: string[];
}

interface UseFindingAssistReturn {
  streamingContent: string;
  finalContent: string | null;
  isStreaming: boolean;
  error: string | null;
  modelName: string | null;
  requestAssist: (
    engagementId: string,
    findingId: string | null,
    field: AssistField,
    prompt: string,
    context?: FindingContext
  ) => Promise<void>;
  stopStreaming: () => void;
  reset: () => void;
}

export function useFindingAssist(): UseFindingAssistReturn {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [finalContent, setFinalContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modelName, setModelName] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
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
    setStreamingContent(streamRef.current);
  }

  const requestAssist = useCallback(
    async (
      engagementId: string,
      findingId: string | null,
      field: AssistField,
      prompt: string,
      context?: FindingContext
    ) => {
      if (isStreaming) return;

      setError(null);
      setIsStreaming(true);
      setFinalContent(null);
      setModelName(null);
      streamRef.current = "";
      setStreamingContent("");
      startStreamSync();

      try {
        abortRef.current = new AbortController();

        const payload: Record<string, unknown> = { engagementId, field, prompt };
        if (findingId) payload.findingId = findingId;
        if (context) payload.context = context;

        const response = await fetch("/api/findings/ai-assist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
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
                case "meta":
                  if (event.model) setModelName(event.model);
                  break;
                case "token":
                  streamRef.current += event.content;
                  break;
                case "done":
                  break;
                case "error":
                  throw new Error(event.message);
              }
            } catch (e) {
              if (
                e instanceof Error &&
                e.message !== "Unexpected end of JSON input"
              ) {
                throw e;
              }
            }
          }
        }

        // Set final result
        setFinalContent(streamRef.current);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          // User cancelled — discard partial content
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
        abortRef.current = null;
      }
    },
    [isStreaming]
  );

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
    setStreamingContent("");
    setFinalContent(null);
    setError(null);
    setModelName(null);
    streamRef.current = "";
  }, []);

  return {
    streamingContent,
    finalContent,
    isStreaming,
    error,
    modelName,
    requestAssist,
    stopStreaming,
    reset,
  };
}
