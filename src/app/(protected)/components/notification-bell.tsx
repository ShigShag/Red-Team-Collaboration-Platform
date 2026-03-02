"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { describeNotification } from "@/lib/notification-helpers";

interface Notification {
  id: string;
  type: string;
  engagementId: string | null;
  actorId: string | null;
  actorUsername: string | null;
  actorDisplayName: string | null;
  actorAvatarPath: string | null;
  metadata: Record<string, string | null>;
  read: boolean;
  createdAt: string;
}

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffSec = Math.floor((now - then) / 1000);

  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

const POLL_INTERVAL = 60_000;

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Poll unread count
  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications/unread-count");
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.count);
      }
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  // Fetch notifications when dropdown opens
  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    setLoading(true);

    fetch("/api/notifications?page=1")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) {
          setItems(data.notifications);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  // Click-outside and Escape
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setIsOpen(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  async function handleMarkAllRead() {
    try {
      await fetch("/api/notifications/mark-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {
      // silent
    }
  }

  async function handleDeleteAll() {
    try {
      await fetch("/api/notifications/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      setItems([]);
      setUnreadCount(0);
    } catch {
      // silent
    }
  }

  async function handleDeleteOne(e: React.MouseEvent, notificationId: string, wasUnread: boolean) {
    e.stopPropagation();
    try {
      await fetch("/api/notifications/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId }),
      });
      setItems((prev) => prev.filter((n) => n.id !== notificationId));
      if (wasUnread) setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      // silent
    }
  }

  async function handleClickNotification(notification: Notification) {
    if (!notification.read) {
      try {
        await fetch("/api/notifications/mark-read", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notificationId: notification.id }),
        });
        setItems((prev) =>
          prev.map((n) =>
            n.id === notification.id ? { ...n, read: true } : n
          )
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch {
        // silent
      }
    }

    setIsOpen(false);
    if (notification.engagementId) {
      const m = notification.metadata;
      // Deep-link to the category page for comment notifications
      if (
        (notification.type === "comment_mention" || notification.type === "comment_reply") &&
        m.categoryId
      ) {
        const hash = m.targetType && m.targetId ? `#${m.targetType}-${m.targetId}` : "";
        router.push(
          `/engagements/${notification.engagementId}/categories/${m.categoryId}${hash}`
        );
      } else {
        router.push(`/engagements/${notification.engagementId}`);
      }
    } else {
      router.push("/settings");
    }
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative w-8 h-8 rounded-full flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-bg-elevated/50 transition-colors duration-100 cursor-pointer"
      >
        <svg
          className="w-[18px] h-[18px]"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
          />
        </svg>

        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-accent text-[9px] font-bold text-white flex items-center justify-center leading-none animate-pulse-glow">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="animate-dropdown absolute right-0 top-full mt-2 w-80 bg-bg-surface border border-border-default rounded-lg shadow-lg shadow-black/30 z-50 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-border-default flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-medium text-text-secondary uppercase tracking-wider">
                Notifications
              </h3>
              {unreadCount > 0 && (
                <span className="min-w-[18px] h-[18px] px-1.5 rounded-full bg-accent/15 text-[10px] font-semibold text-accent flex items-center justify-center leading-none">
                  {unreadCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-[10px] font-medium text-accent hover:text-accent-bright transition-colors duration-100 cursor-pointer"
                >
                  Mark all read
                </button>
              )}
              {items.length > 0 && (
                <button
                  onClick={handleDeleteAll}
                  className="text-[10px] font-medium text-text-muted hover:text-danger transition-colors duration-100 cursor-pointer"
                >
                  Clear all
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="px-4 py-8 text-center">
                <div className="inline-block w-4 h-4 border-2 border-border-default border-t-accent rounded-full animate-spin" />
              </div>
            ) : items.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <svg
                  className="w-6 h-6 text-text-muted/40 mx-auto mb-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
                  />
                </svg>
                <p className="text-xs text-text-muted">No notifications yet</p>
              </div>
            ) : (
              items.map((notification) => {
                const { highlight, text } = describeNotification(notification);
                const isSecurityNotification = !notification.actorId;
                const initial = (
                  notification.actorDisplayName ||
                  notification.actorUsername ||
                  "S"
                )
                  .charAt(0)
                  .toUpperCase();

                return (
                  <div
                    key={notification.id}
                    onClick={() => handleClickNotification(notification)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === "Enter") handleClickNotification(notification); }}
                    className={`group w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-bg-elevated/50 transition-colors duration-100 cursor-pointer border-l-2 ${
                      notification.read
                        ? "border-l-transparent"
                        : "border-l-accent"
                    }`}
                  >
                    {/* Avatar / Security icon */}
                    {isSecurityNotification ? (
                      <div className="w-7 h-7 rounded-full bg-warning/10 border border-warning/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <svg className="w-3.5 h-3.5 text-warning" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0-10.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                        </svg>
                      </div>
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-bg-elevated border border-border-default flex items-center justify-center text-[10px] font-semibold text-text-secondary flex-shrink-0 mt-0.5 overflow-hidden">
                        {notification.actorAvatarPath ? (
                          <img
                            src={`/api/avatar/${notification.actorId}`}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          initial
                        )}
                      </div>
                    )}

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-text-secondary leading-relaxed">
                        <span className="font-medium text-text-primary">
                          {highlight}
                        </span>{" "}
                        {text}
                      </p>
                      <p className="text-[10px] text-text-muted font-mono mt-1">
                        {relativeTime(notification.createdAt)}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 flex-shrink-0 mt-1">
                      {!notification.read && (
                        <div className="w-1.5 h-1.5 rounded-full bg-accent" />
                      )}
                      <button
                        onClick={(e) => handleDeleteOne(e, notification.id, !notification.read)}
                        className="w-5 h-5 rounded flex items-center justify-center text-text-muted/0 group-hover:text-text-muted hover:!text-danger hover:bg-danger/10 transition-all duration-100 cursor-pointer"
                        title="Delete notification"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
