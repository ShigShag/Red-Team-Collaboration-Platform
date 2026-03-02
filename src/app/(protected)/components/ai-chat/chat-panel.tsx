"use client";

import { useRef, useEffect } from "react";
import { useChatStream } from "./use-chat-stream";
import { ChatMessage } from "./chat-message";
import { ChatInput } from "./chat-input";
import { ChatSessionList } from "./chat-session-list";

interface ChatPanelProps {
  engagementId: string;
  engagementName: string;
  modelName: string;
  open: boolean;
  onClose: () => void;
}

export function ChatPanel({
  engagementId,
  engagementName,
  modelName,
  open,
  onClose,
}: ChatPanelProps) {
  const {
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
  } = useChatStream(engagementId);

  const scrollRef = useRef<HTMLDivElement>(null);
  const userScrolledRef = useRef(false);

  // Track whether the user has scrolled away from the bottom
  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    userScrolledRef.current = !atBottom;
  }

  // Reset scroll lock when streaming starts (new message)
  useEffect(() => {
    if (isStreaming) userScrolledRef.current = false;
  }, [isStreaming]);

  // Auto-scroll on new content only if user hasn't scrolled up
  useEffect(() => {
    if (userScrolledRef.current) return;
    const el = scrollRef.current;
    if (!el) return;
    const raf = requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
    return () => cancelAnimationFrame(raf);
  }, [messages, streamingContent]);

  // Close on Escape (only when open)
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed top-14 right-0 h-[calc(100vh-3.5rem)] w-[420px] max-w-[calc(100vw-48px)] z-40 flex flex-col bg-bg-surface/95 backdrop-blur-sm border-l border-border-default shadow-2xl shadow-black/40 animate-slide-in-right">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-border-default">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-6 h-6 rounded-md bg-accent/15 flex items-center justify-center shrink-0">
            <svg
              className="w-3.5 h-3.5 text-accent"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z"
              />
            </svg>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium text-text-primary truncate">
                AI Assistant
              </h3>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-bg-elevated border border-border-subtle text-[10px] font-mono text-text-muted truncate max-w-[140px]">
                {modelName}
              </span>
            </div>
            <ChatSessionList
              engagementId={engagementId}
              currentSessionId={chatSessionId}
              onSelect={loadSession}
              onNew={startNewSession}
              onDelete={(id) => {
                if (id === chatSessionId) startNewSession();
              }}
            />
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center rounded-md text-text-muted hover:text-text-primary hover:bg-bg-elevated/50 transition-colors cursor-pointer"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && !isStreaming && (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center mb-3">
              <svg
                className="w-5 h-5 text-accent"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
                />
              </svg>
            </div>
            <p className="text-sm font-medium text-text-primary mb-1">
              Ask about &ldquo;{engagementName}&rdquo;
            </p>
            <p className="text-xs text-text-muted leading-relaxed">
              I can query findings, actions, scope targets, MITRE techniques,
              and more. Try &ldquo;Show me all critical findings&rdquo; or
              &ldquo;What MITRE techniques were used?&rdquo;
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}

        {/* Streaming message */}
        {isStreaming && (
          <ChatMessage
            message={{
              id: "streaming",
              role: "assistant",
              content: "",
              toolCalls: activeToolCalls.map((tc) => ({
                name: tc.name,
                args: tc.args,
                resultSummary: "",
              })),
            }}
            isStreaming
            streamingContent={streamingContent}
          />
        )}

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">
            <svg
              className="w-4 h-4 text-danger shrink-0 mt-0.5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
              />
            </svg>
            <p className="text-xs text-danger">{error}</p>
          </div>
        )}
      </div>

      {/* Input */}
      <ChatInput
        onSend={sendMessage}
        disabled={isStreaming}
        onStop={stopStreaming}
        isStreaming={isStreaming}
      />
    </div>
  );
}
