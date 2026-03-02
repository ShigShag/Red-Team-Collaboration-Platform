import pino from "pino";
import { headers } from "next/headers";
import { db } from "@/db";
import { securityEvents } from "@/db/schema";

const logger = pino({ name: "security" });

// Events that get persisted to the database
const DB_EVENTS = new Set([
  "user_registered",
  "login_success",
  "login_failed",
  "totp_login_success",
  "totp_invalid_code",
  "totp_decryption_failed",
  "file_decryption_failed",
  "totp_enabled",
  "totp_enable_password_failed",
  "password_changed",
  "password_change_failed",
  "password_change_totp_failed",
  "password_change_decrypt_failed",
  "account_deleted",
  "account_delete_failed",
  "recovery_code_login",
  "recovery_codes_generated",
  "recovery_codes_regenerated",
  "recovery_code_login_failed",
  "admin_user_disabled",
  "admin_user_enabled",
  "admin_user_deleted",
  "admin_force_password_reset",
  "admin_grant_admin",
  "admin_revoke_admin",
  "admin_settings_changed",
  "admin_password_reset",
  "admin_grant_coordinator",
  "admin_revoke_coordinator",
  "session_hijack_detected",
] as const);

export type SecurityEventType =
  | "user_registered"
  | "login_success"
  | "login_failed"
  | "login_2fa_required"
  | "totp_login_success"
  | "totp_invalid_code"
  | "totp_session_expired"
  | "totp_decryption_failed"
  | "file_decryption_failed"
  | "totp_enabled"
  | "totp_enable_password_failed"
  | "password_changed"
  | "password_change_failed"
  | "password_change_totp_failed"
  | "password_change_decrypt_failed"
  | "account_deleted"
  | "account_delete_failed"
  | "logout"
  | "recovery_code_login"
  | "recovery_codes_generated"
  | "recovery_codes_regenerated"
  | "recovery_code_login_failed"
  | "admin_user_disabled"
  | "admin_user_enabled"
  | "admin_user_deleted"
  | "admin_force_password_reset"
  | "admin_grant_admin"
  | "admin_revoke_admin"
  | "admin_settings_changed"
  | "admin_password_reset"
  | "admin_grant_coordinator"
  | "admin_revoke_coordinator"
  | "session_hijack_detected";

type DbEventType = typeof DB_EVENTS extends Set<infer T> ? T : never;

export async function getRequestContext() {
  const headerStore = await headers();
  return {
    ipAddress:
      headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: headerStore.get("user-agent") ?? null,
  };
}

export async function logSecurityEvent(params: {
  eventType: SecurityEventType;
  userId?: string | null;
  username?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const { eventType, userId, username, ipAddress, userAgent, metadata } =
    params;

  // Always log to pino
  const logData = {
    eventType,
    userId: userId ?? undefined,
    username: username ?? undefined,
    ipAddress: ipAddress ?? undefined,
    ...metadata,
  };

  const isCritical =
    eventType === "totp_decryption_failed" ||
    eventType === "password_change_decrypt_failed" ||
    eventType === "file_decryption_failed" ||
    eventType === "session_hijack_detected";

  if (isCritical) {
    logger.error(logData, `CRITICAL security event: ${eventType}`);
  } else if (eventType.includes("failed") || eventType.includes("invalid")) {
    logger.warn(logData, `Security event: ${eventType}`);
  } else {
    logger.info(logData, `Security event: ${eventType}`);
  }

  // Persist important events to the database
  if (DB_EVENTS.has(eventType as DbEventType)) {
    try {
      await db.insert(securityEvents).values({
        eventType: eventType as DbEventType,
        userId: userId ?? null,
        username: username ?? null,
        ipAddress: ipAddress ?? null,
        userAgent: userAgent ?? null,
        metadata: metadata ?? {},
      });
    } catch (error) {
      logger.error(
        { error, eventType },
        "Failed to persist security event to database"
      );
    }
  }

  // Dispatch security notifications for relevant events
  if (userId) {
    try {
      const {
        createSecurityNotification,
        checkAndRecordIp,
        notifyFailedLogin,
      } = await import("@/lib/security-notifications");

      if (
        eventType === "login_success" ||
        eventType === "totp_login_success"
      ) {
        const { isNew } = await checkAndRecordIp({
          userId,
          ipAddress: ipAddress ?? "",
          userAgent,
        });
        if (isNew) {
          await createSecurityNotification({
            userId,
            type: "security_login_success",
            metadata: {
              ipAddress: ipAddress ?? null,
              isNewIp: true,
              userAgent: userAgent ?? null,
            },
          });
        }
      }

      if (eventType === "login_failed") {
        await notifyFailedLogin({ userId, ipAddress });
      }

      if (eventType === "password_changed") {
        await createSecurityNotification({
          userId,
          type: "security_password_changed",
          metadata: { ipAddress: ipAddress ?? null },
        });
      }

      if (eventType === "totp_enabled") {
        await createSecurityNotification({
          userId,
          type: "security_totp_enabled",
          metadata: { ipAddress: ipAddress ?? null },
        });
      }

      if (eventType === "session_hijack_detected") {
        await createSecurityNotification({
          userId,
          type: "security_session_hijack",
          metadata: {
            expectedIp: (metadata?.expectedIp as string) ?? null,
            actualIp: (metadata?.actualIp as string) ?? null,
            mismatchType: (metadata?.mismatchType as string) ?? "unknown",
          },
        });
      }
    } catch (error) {
      logger.warn(
        { error, eventType },
        "Failed to dispatch security notification"
      );
    }
  }
}
