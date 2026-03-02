import { db } from "@/db";
import { notifications, userKnownIps } from "@/db/schema";
import { eq, and, gte, desc } from "drizzle-orm";

export type SecurityNotificationType =
  | "security_login_success"
  | "security_login_failed"
  | "security_password_changed"
  | "security_totp_enabled"
  | "security_session_hijack";

/**
 * Create a security notification (no engagement context, no actor).
 */
export async function createSecurityNotification(params: {
  userId: string;
  type: SecurityNotificationType;
  metadata: Record<string, unknown>;
}): Promise<void> {
  try {
    await db.insert(notifications).values({
      userId: params.userId,
      type: params.type,
      engagementId: null,
      actorId: null,
      metadata: params.metadata,
    });
  } catch (error) {
    console.error("[security-notifications] Failed to create:", error);
  }
}

/**
 * Check if an IP is known for a user. If new, inserts it.
 * If known, updates lastSeenAt. Returns { isNew }.
 */
export async function checkAndRecordIp(params: {
  userId: string;
  ipAddress: string;
  userAgent?: string | null;
}): Promise<{ isNew: boolean }> {
  const { userId, ipAddress, userAgent } = params;
  if (!ipAddress) return { isNew: false };

  try {
    const [existing] = await db
      .select({ id: userKnownIps.id })
      .from(userKnownIps)
      .where(
        and(
          eq(userKnownIps.userId, userId),
          eq(userKnownIps.ipAddress, ipAddress)
        )
      )
      .limit(1);

    if (existing) {
      await db
        .update(userKnownIps)
        .set({
          lastSeenAt: new Date(),
          ...(userAgent != null ? { userAgent } : {}),
        })
        .where(eq(userKnownIps.id, existing.id));
      return { isNew: false };
    }

    await db.insert(userKnownIps).values({
      userId,
      ipAddress,
      userAgent: userAgent ?? null,
    });
    return { isNew: true };
  } catch (error) {
    console.error("[security-notifications] IP check failed:", error);
    return { isNew: false };
  }
}

const FAILED_LOGIN_BATCH_WINDOW_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Notify about failed login attempts with batching.
 * If an unread security_login_failed notification exists within 30 min,
 * increment its count instead of creating a new one.
 */
export async function notifyFailedLogin(params: {
  userId: string;
  ipAddress?: string | null;
}): Promise<void> {
  const { userId, ipAddress } = params;
  const cutoff = new Date(Date.now() - FAILED_LOGIN_BATCH_WINDOW_MS);

  try {
    const [existing] = await db
      .select({
        id: notifications.id,
        metadata: notifications.metadata,
      })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.type, "security_login_failed"),
          eq(notifications.read, false),
          gte(notifications.createdAt, cutoff)
        )
      )
      .orderBy(desc(notifications.createdAt))
      .limit(1);

    if (existing) {
      const meta = (existing.metadata ?? {}) as Record<string, unknown>;
      const count =
        (typeof meta.count === "number" ? meta.count : 1) + 1;
      const ips = Array.isArray(meta.ips) ? [...meta.ips] : [];
      if (ipAddress && !ips.includes(ipAddress)) ips.push(ipAddress);

      await db
        .update(notifications)
        .set({
          metadata: {
            ...meta,
            count,
            ips,
            lastAttempt: new Date().toISOString(),
          },
        })
        .where(eq(notifications.id, existing.id));
    } else {
      await createSecurityNotification({
        userId,
        type: "security_login_failed",
        metadata: {
          count: 1,
          ips: ipAddress ? [ipAddress] : [],
          lastAttempt: new Date().toISOString(),
        },
      });
    }
  } catch (error) {
    console.error("[security-notifications] Failed login notify failed:", error);
  }
}
