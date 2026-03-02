"use client";

import { MarkdownRenderer } from "../markdown-renderer";
import type { ChatMessage as ChatMessageType } from "./use-chat-stream";

interface ChatMessageProps {
  message: ChatMessageType;
  isStreaming?: boolean;
  streamingContent?: string;
}

function ToolCallBadge({
  name,
  isActive,
}: {
  name: string;
  isActive?: boolean;
}) {
  const labels: Record<string, string> = {
    get_engagement_summary: "Engagement Summary",
    list_findings: "Findings",
    get_finding_detail: "Finding Detail",
    list_actions: "Actions",
    list_categories: "Categories",
    list_scope_targets: "Scope Targets",
    list_scope_exclusions: "Scope Exclusions",
    search_mitre_techniques: "MITRE ATT&CK",
    list_resources: "Resources",
    get_engagement_stats: "Statistics",
    list_ip_geolocations: "IP Geolocations",
    list_activity: "Activity Log",
    search_content: "Content Search",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-mono transition-all ${
        isActive
          ? "bg-accent/15 border border-accent/30 text-accent"
          : "bg-accent/8 border border-accent/15 text-accent/70"
      }`}
    >
      {isActive ? (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
        </span>
      ) : (
        <svg
          className="w-2.5 h-2.5"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4.5 12.75l6 6 9-13.5"
          />
        </svg>
      )}
      {labels[name] ?? name}
      {isActive && (
        <div className="h-[2px] w-8 rounded-full overflow-hidden">
          <div className="h-full ai-tool-shimmer rounded-full" />
        </div>
      )}
    </span>
  );
}

function ThinkingIndicator() {
  return (
    <span className="text-xs text-text-secondary">
      Thinking
      <span className="ai-dot-wave ml-0.5">
        <span>.</span>
        <span>.</span>
        <span>.</span>
      </span>
    </span>
  );
}

export function ChatMessage({
  message,
  isStreaming,
  streamingContent,
}: ChatMessageProps) {
  const isUser = message.role === "user";
  const content = isStreaming ? streamingContent ?? "" : message.content;
  const hasActiveToolCalls =
    isStreaming &&
    message.toolCalls &&
    message.toolCalls.some((tc) => !tc.resultSummary);

  return (
    <div
      className={`flex ${isUser ? "justify-end" : "justify-start"} animate-fade-in`}
    >
      <div
        className={`max-w-[85%] rounded-lg px-3.5 py-2.5 text-sm ${
          isUser
            ? "bg-accent/10 border border-accent/20 text-text-primary"
            : "bg-bg-elevated border border-border-subtle text-text-primary"
        }`}
      >
        {/* Tool call badges */}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {message.toolCalls.map((tc, i) => (
              <ToolCallBadge
                key={i}
                name={tc.name}
                isActive={isStreaming && !tc.resultSummary}
              />
            ))}
          </div>
        )}

        {/* Content */}
        {content ? (
          <div
            className={`prose prose-sm prose-invert max-w-none [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5 [&_pre]:my-2 [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm ${
              isStreaming ? "ai-stream-cursor" : ""
            }`}
          >
            <MarkdownRenderer content={content} />
          </div>
        ) : isStreaming ? (
          <ThinkingIndicator />
        ) : null}
      </div>
    </div>
  );
}
