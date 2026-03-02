"use client";

import { useState, useEffect, useRef } from "react";

interface ChatSessionItem {
  id: string;
  title: string | null;
  updatedAt: string;
}

interface ChatSessionListProps {
  engagementId: string;
  currentSessionId: string | null;
  onSelect: (sessionId: string) => void;
  onNew: () => void;
  onDelete: (sessionId: string) => void;
}

export function ChatSessionList({
  engagementId,
  currentSessionId,
  onSelect,
  onNew,
  onDelete,
}: ChatSessionListProps) {
  const [open, setOpen] = useState(false);
  const [sessions, setSessions] = useState<ChatSessionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch(`/api/chat/sessions?engagementId=${engagementId}`)
      .then((r) => r.json())
      .then((data) => setSessions(data.sessions ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open, engagementId]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
        setConfirmDelete(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function handleDelete(sessionId: string) {
    if (confirmDelete === sessionId) {
      // Optimistic: remove from UI immediately
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      setConfirmDelete(null);
      onDelete(sessionId);
      // Fire API in background
      fetch(`/api/chat/sessions/${sessionId}`, { method: "DELETE" }).catch(() => {});
    } else {
      setConfirmDelete(sessionId);
    }
  }

  function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60_000) return "Just now";
    if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`;
    return d.toLocaleDateString();
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-xs text-text-muted hover:text-text-secondary transition-colors cursor-pointer"
        title="Chat sessions"
      >
        <svg
          className="w-3.5 h-3.5"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155"
          />
        </svg>
        Sessions
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-bg-surface border border-border-default rounded-lg shadow-xl z-50 animate-dropdown">
          {/* New chat button */}
          <button
            type="button"
            onClick={() => {
              onNew();
              setOpen(false);
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-accent hover:bg-accent/5 transition-colors cursor-pointer border-b border-border-subtle"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4.5v15m7.5-7.5h-15"
              />
            </svg>
            New Chat
          </button>

          {/* Session list */}
          <div className="max-h-60 overflow-y-auto">
            {loading ? (
              <div className="px-3 py-4 text-xs text-text-muted text-center">
                Loading...
              </div>
            ) : sessions.length === 0 ? (
              <div className="px-3 py-4 text-xs text-text-muted text-center">
                No chat sessions yet
              </div>
            ) : (
              sessions.map((s) => (
                <div
                  key={s.id}
                  className={`flex items-center gap-2 px-3 py-2 group ${
                    s.id === currentSessionId
                      ? "bg-accent/5"
                      : "hover:bg-bg-elevated/50"
                  } transition-colors`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(s.id);
                      setOpen(false);
                    }}
                    className="flex-1 text-left min-w-0 cursor-pointer"
                  >
                    <div className="text-xs text-text-primary truncate">
                      {s.title ?? "Untitled chat"}
                    </div>
                    <div className="text-[10px] text-text-muted">
                      {formatDate(s.updatedAt)}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(s.id);
                    }}
                    className={`shrink-0 w-5 h-5 flex items-center justify-center rounded transition-colors cursor-pointer ${
                      confirmDelete === s.id
                        ? "text-danger bg-danger/10"
                        : "text-text-muted/0 group-hover:text-text-muted hover:text-danger"
                    }`}
                    title={
                      confirmDelete === s.id
                        ? "Click again to confirm"
                        : "Delete session"
                    }
                  >
                    <svg
                      className="w-3 h-3"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                      />
                    </svg>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
