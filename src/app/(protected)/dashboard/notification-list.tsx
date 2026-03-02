"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { describeNotification } from "@/lib/notification-helpers";

interface NotificationItem {
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

export function NotificationList({
  notifications: initialNotifications,
}: {
  notifications: NotificationItem[];
}) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [markingAll, setMarkingAll] = useState(false);
  const router = useRouter();

  const unreadCount = notifications.filter((n) => !n.read).length;

  async function handleMarkAllRead() {
    setMarkingAll(true);
    try {
      await fetch("/api/notifications/mark-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      router.refresh();
    } catch {
      // silent
    } finally {
      setMarkingAll(false);
    }
  }

  async function handleDeleteAll() {
    try {
      await fetch("/api/notifications/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      setNotifications([]);
      router.refresh();
    } catch {
      // silent
    }
  }

  async function handleDeleteOne(e: React.MouseEvent, notificationId: string) {
    e.stopPropagation();
    try {
      await fetch("/api/notifications/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId }),
      });
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
      router.refresh();
    } catch {
      // silent
    }
  }

  async function handleClick(notification: NotificationItem) {
    if (!notification.read) {
      try {
        await fetch("/api/notifications/mark-read", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notificationId: notification.id }),
        });
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notification.id ? { ...n, read: true } : n
          )
        );
      } catch {
        // silent
      }
    }
    if (notification.engagementId) {
      const m = notification.metadata;
      if (
        (notification.type === "comment_mention" || notification.type === "comment_reply") &&
        m.targetType === "report_section" &&
        m.targetId
      ) {
        // Navigate to report with specific QA field activated if available
        const sectionKey = m.sectionKey;
        const fieldPath = m.fieldPath;
        const qaField = sectionKey && fieldPath ? `?qaField=${encodeURIComponent(`${sectionKey}:${fieldPath}`)}` : "";
        router.push(`/engagements/${notification.engagementId}/reports${qaField}`);
      } else if (
        (notification.type === "comment_mention" || notification.type === "comment_reply") &&
        m.categoryId
      ) {
        const hash = m.targetType && m.targetId ? `#${m.targetType}-${m.targetId}` : "";
        router.push(
          `/engagements/${notification.engagementId}/categories/${m.categoryId}${hash}`
        );
      } else if (notification.type === "report_qa_comment") {
        const sectionKey = m.sectionKey;
        const fieldPath = m.fieldPath;
        const qaField = sectionKey && fieldPath ? `?qaField=${encodeURIComponent(`${sectionKey}:${fieldPath}`)}` : "";
        router.push(`/engagements/${notification.engagementId}/reports${qaField}`);
      } else if (
        notification.type === "report_qa_requested" ||
        notification.type === "report_qa_signed_off"
      ) {
        router.push(`/engagements/${notification.engagementId}/reports`);
      } else {
        router.push(`/engagements/${notification.engagementId}`);
      }
    } else {
      router.push("/settings");
    }
  }

  if (notifications.length === 0) {
    return null;
  }

  return (
    <div className="relative bg-bg-surface/80 border border-border-default rounded-lg p-5">
      <div className="absolute top-0 left-5 right-5 h-px bg-gradient-to-r from-transparent via-border-default to-transparent" />
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-medium text-text-secondary uppercase tracking-wider">
            Notifications
          </h2>
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
              disabled={markingAll}
              className="text-[10px] font-medium text-accent hover:text-accent-bright transition-colors duration-100 cursor-pointer disabled:opacity-50"
            >
              Mark all read
            </button>
          )}
          <button
            onClick={handleDeleteAll}
            className="text-[10px] font-medium text-text-muted hover:text-danger transition-colors duration-100 cursor-pointer"
          >
            Clear all
          </button>
        </div>
      </div>

      <div className="space-y-0.5">
        {notifications.map((notification) => {
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
              onClick={() => handleClick(notification)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter") handleClick(notification); }}
              className={`group w-full text-left flex items-start gap-3 px-3 py-2.5 rounded hover:bg-bg-elevated/50 active:scale-[0.99] transition-all duration-100 cursor-pointer border-l-2 ${
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
                <p className="text-sm text-text-secondary leading-relaxed">
                  <span className="font-medium text-text-primary">
                    {highlight}
                  </span>{" "}
                  {text}
                </p>
                <p className="text-[10px] text-text-muted font-mono mt-0.5">
                  {relativeTime(notification.createdAt)}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1.5 flex-shrink-0 mt-1">
                {!notification.read && (
                  <div className="w-1.5 h-1.5 rounded-full bg-accent" />
                )}
                <button
                  onClick={(e) => handleDeleteOne(e, notification.id)}
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
        })}
      </div>
    </div>
  );
}
