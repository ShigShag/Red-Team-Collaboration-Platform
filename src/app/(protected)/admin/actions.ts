"use server";

import { revalidatePath } from "next/cache";
import { eq, sql, and, desc, isNull, gt, count as drizzleCount } from "drizzle-orm";
import { randomBytes } from "crypto";
import { db } from "@/db";
import {
  users,
  sessions,
  inviteCodes,
  securityEvents,
  engagementMembers,
  chatSessions,
  chatMessages,
} from "@/db/schema";
import { requireAdmin } from "@/lib/auth/admin";
import { hashPassword } from "@/lib/auth/password";
import { logSecurityEvent, getRequestContext } from "@/lib/security-logger";
import { updateSetting, getAllSettings } from "@/lib/platform-settings";

export type AdminState = {
  error?: string;
  success?: string;
};

// ── User Management ─────────────────────────────────────────────

export async function getUsers() {
  const session = await requireAdmin();

  const allUsers = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      avatarPath: users.avatarPath,
      isAdmin: users.isAdmin,
      totpEnabled: users.totpEnabled,
      disabledAt: users.disabledAt,
      passwordResetRequired: users.passwordResetRequired,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(desc(users.createdAt));

  return allUsers;
}

export async function disableUser(
  _prev: AdminState,
  formData: FormData
): Promise<AdminState> {
  const session = await requireAdmin();
  const userId = formData.get("userId") as string;

  if (userId === session.userId) {
    return { error: "Cannot disable your own account" };
  }

  await db
    .update(users)
    .set({ disabledAt: new Date(), updatedAt: new Date() })
    .where(eq(users.id, userId));

  // Terminate their sessions
  await db.delete(sessions).where(eq(sessions.userId, userId));

  const ctx = await getRequestContext();
  await logSecurityEvent({
    eventType: "admin_user_disabled",
    userId: session.userId,
    username: session.username,
    ...ctx,
    metadata: { targetUserId: userId },
  });

  revalidatePath("/admin");
  return { success: "User disabled" };
}

export async function enableUser(
  _prev: AdminState,
  formData: FormData
): Promise<AdminState> {
  const session = await requireAdmin();
  const userId = formData.get("userId") as string;

  await db
    .update(users)
    .set({ disabledAt: null, updatedAt: new Date() })
    .where(eq(users.id, userId));

  const ctx = await getRequestContext();
  await logSecurityEvent({
    eventType: "admin_user_enabled",
    userId: session.userId,
    username: session.username,
    ...ctx,
    metadata: { targetUserId: userId },
  });

  revalidatePath("/admin");
  return { success: "User enabled" };
}

export async function deleteUser(
  _prev: AdminState,
  formData: FormData
): Promise<AdminState> {
  const session = await requireAdmin();
  const userId = formData.get("userId") as string;

  if (userId === session.userId) {
    return { error: "Cannot delete your own account" };
  }

  // Check if target is the last admin
  const [target] = await db
    .select({ isAdmin: users.isAdmin, username: users.username })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!target) {
    return { error: "User not found" };
  }

  if (target.isAdmin) {
    const [{ count: adminCount }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(eq(users.isAdmin, true));

    if (adminCount <= 1) {
      return { error: "Cannot delete the last admin" };
    }
  }

  await db.delete(users).where(eq(users.id, userId));

  const ctx = await getRequestContext();
  await logSecurityEvent({
    eventType: "admin_user_deleted",
    userId: session.userId,
    username: session.username,
    ...ctx,
    metadata: { targetUserId: userId, targetUsername: target.username },
  });

  revalidatePath("/admin");
  return { success: "User deleted" };
}

export async function forcePasswordReset(
  _prev: AdminState,
  formData: FormData
): Promise<AdminState> {
  const session = await requireAdmin();
  const userId = formData.get("userId") as string;

  await db
    .update(users)
    .set({ passwordResetRequired: true, updatedAt: new Date() })
    .where(eq(users.id, userId));

  // Terminate their sessions to force re-authentication
  await db.delete(sessions).where(eq(sessions.userId, userId));

  const ctx = await getRequestContext();
  await logSecurityEvent({
    eventType: "admin_force_password_reset",
    userId: session.userId,
    username: session.username,
    ...ctx,
    metadata: { targetUserId: userId },
  });

  revalidatePath("/admin");
  return { success: "Password reset required for user" };
}

export async function adminResetPassword(
  _prev: AdminState,
  formData: FormData
): Promise<AdminState> {
  const session = await requireAdmin();
  const userId = formData.get("userId") as string;

  if (userId === session.userId) {
    return { error: "Cannot reset your own password from admin panel" };
  }

  const [target] = await db
    .select({ username: users.username, totpEnabled: users.totpEnabled })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!target) {
    return { error: "User not found" };
  }

  // Generate temporary password that satisfies the password policy:
  // 12+ chars, uppercase, lowercase, digit, special char
  const randomPart = randomBytes(9).toString("base64url"); // 12 chars, mixed case + digits
  const tempPassword = `${randomPart}!A1a`; // append guaranteed special + upper + digit + lower
  const passwordHash = await hashPassword(tempPassword);

  // Reset password and force change on next login
  // If TOTP was enabled, clear it — the secret was encrypted with the old password
  await db
    .update(users)
    .set({
      passwordHash,
      passwordResetRequired: true,
      ...(target.totpEnabled
        ? { totpSecret: null, totpKeySalt: null, totpEnabled: false }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));

  // Terminate all sessions
  await db.delete(sessions).where(eq(sessions.userId, userId));

  const ctx = await getRequestContext();
  await logSecurityEvent({
    eventType: "admin_password_reset",
    userId: session.userId,
    username: session.username,
    ...ctx,
    metadata: {
      targetUserId: userId,
      targetUsername: target.username,
      totpCleared: target.totpEnabled,
    },
  });

  revalidatePath("/admin");
  return { success: tempPassword };
}

export async function grantAdmin(
  _prev: AdminState,
  formData: FormData
): Promise<AdminState> {
  const session = await requireAdmin();
  const userId = formData.get("userId") as string;

  await db
    .update(users)
    .set({ isAdmin: true, updatedAt: new Date() })
    .where(eq(users.id, userId));

  const ctx = await getRequestContext();
  await logSecurityEvent({
    eventType: "admin_grant_admin",
    userId: session.userId,
    username: session.username,
    ...ctx,
    metadata: { targetUserId: userId },
  });

  revalidatePath("/admin");
  return { success: "Admin privileges granted" };
}

export async function revokeAdmin(
  _prev: AdminState,
  formData: FormData
): Promise<AdminState> {
  const session = await requireAdmin();
  const userId = formData.get("userId") as string;

  if (userId === session.userId) {
    // Check if we're the last admin
    const [{ count: adminCount }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(eq(users.isAdmin, true));

    if (adminCount <= 1) {
      return { error: "Cannot revoke the last admin" };
    }
  }

  await db
    .update(users)
    .set({ isAdmin: false, updatedAt: new Date() })
    .where(eq(users.id, userId));

  const ctx = await getRequestContext();
  await logSecurityEvent({
    eventType: "admin_revoke_admin",
    userId: session.userId,
    username: session.username,
    ...ctx,
    metadata: { targetUserId: userId },
  });

  revalidatePath("/admin");
  return { success: "Admin privileges revoked" };
}

// ── Platform Settings ───────────────────────────────────────────

export async function updatePlatformSettings(
  _prev: AdminState,
  formData: FormData
): Promise<AdminState> {
  const session = await requireAdmin();

  const registrationMode = formData.get("registrationMode") as string;
  const sessionTtlHours = formData.get("sessionTtlHours") as string;
  const require2fa = formData.get("require2fa") === "true";
  const ollamaBaseUrl = ((formData.get("ollamaBaseUrl") as string) || "").trim();
  const ollamaModel = ((formData.get("ollamaModel") as string) || "").trim();
  const ollamaFindingModel = ((formData.get("ollamaFindingModel") as string) || "").trim();

  const validModes = ["open", "code", "invite", "disabled"];
  if (!validModes.includes(registrationMode)) {
    return { error: "Invalid registration mode" };
  }

  const ttl = parseInt(sessionTtlHours, 10);
  if (isNaN(ttl) || ttl < 1 || ttl > 720) {
    return { error: "Session TTL must be between 1 and 720 hours" };
  }

  // Validate Ollama URL if provided
  if (ollamaBaseUrl) {
    try {
      const parsed = new URL(ollamaBaseUrl);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        return { error: "Ollama URL must use http or https protocol" };
      }
    } catch {
      return { error: "Invalid Ollama URL format" };
    }

    // Verify the model actually exists on the Ollama server
    if (ollamaModel) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const tagsRes = await fetch(
          `${ollamaBaseUrl.replace(/\/$/, "")}/api/tags`,
          { signal: controller.signal }
        );
        clearTimeout(timeout);

        if (!tagsRes.ok) {
          return { error: `Cannot reach Ollama server (status ${tagsRes.status}). Verify the URL and try again.` };
        }

        const tagsData = (await tagsRes.json()) as {
          models?: { name: string }[];
        };
        const available = (tagsData.models ?? []).map((m) => m.name);
        if (!available.includes(ollamaModel)) {
          const suggestion =
            available.length > 0
              ? ` Available models: ${available.join(", ")}`
              : " No models found on the server — pull a model first.";
          return {
            error: `Chat model "${ollamaModel}" is not available on the Ollama server.${suggestion}`,
          };
        }
        if (ollamaFindingModel && !available.includes(ollamaFindingModel)) {
          return {
            error: `Finding assist model "${ollamaFindingModel}" is not available on the Ollama server.`,
          };
        }
      } catch (err) {
        const msg =
          err instanceof DOMException && err.name === "AbortError"
            ? "Connection to Ollama timed out (5s)"
            : "Cannot connect to Ollama server to verify model";
        return { error: `${msg}. Save without a URL to skip validation.` };
      }
    }
  }

  await updateSetting("registration_mode", registrationMode, session.userId);
  await updateSetting("session_ttl_hours", String(ttl), session.userId);
  await updateSetting("require_2fa", String(require2fa), session.userId);
  await updateSetting("ollama_base_url", ollamaBaseUrl, session.userId);
  await updateSetting("ollama_model", ollamaModel || "llama3.1:70b", session.userId);
  await updateSetting("ollama_finding_model", ollamaFindingModel, session.userId);

  const ctx = await getRequestContext();
  await logSecurityEvent({
    eventType: "admin_settings_changed",
    userId: session.userId,
    username: session.username,
    ...ctx,
    metadata: { registrationMode, sessionTtlHours: ttl, require2fa, ollamaBaseUrl, ollamaModel, ollamaFindingModel },
  });

  revalidatePath("/admin");
  return { success: "Platform settings updated" };
}

// ── Invite Codes ────────────────────────────────────────────────

export async function createInviteCode(
  _prev: AdminState,
  formData: FormData
): Promise<AdminState> {
  const session = await requireAdmin();

  const expiresInHours = parseInt(
    (formData.get("expiresInHours") as string) || "72",
    10
  );
  if (isNaN(expiresInHours) || expiresInHours < 1 || expiresInHours > 720) {
    return { error: "Expiry must be between 1 and 720 hours" };
  }

  const code = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

  await db.insert(inviteCodes).values({
    code,
    createdBy: session.userId,
    expiresAt,
  });

  revalidatePath("/admin/invites");
  return { success: code };
}

export async function revokeInviteCode(
  _prev: AdminState,
  formData: FormData
): Promise<AdminState> {
  const session = await requireAdmin();
  const codeId = formData.get("codeId") as string;

  await db
    .delete(inviteCodes)
    .where(and(eq(inviteCodes.id, codeId), isNull(inviteCodes.usedBy)));

  revalidatePath("/admin/invites");
  return { success: "Invite code revoked" };
}

// ── Stats ───────────────────────────────────────────────────────

export async function getAdminStats() {
  await requireAdmin();

  const [userStats] = await db.select({
    total: sql<number>`count(*)::int`,
    active: sql<number>`count(*) FILTER (WHERE disabled_at IS NULL)::int`,
    admins: sql<number>`count(*) FILTER (WHERE is_admin = true)::int`,
  }).from(users);

  const [sessionStats] = await db.select({
    active: sql<number>`count(*)::int`,
  }).from(sessions).where(gt(sessions.expiresAt, new Date()));

  const settings = await getAllSettings();

  return {
    users: userStats,
    sessions: sessionStats,
    settings,
  };
}

export async function getSecurityLog(page: number = 1, pageSize: number = 50) {
  await requireAdmin();

  const offset = (page - 1) * pageSize;

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(securityEvents);

  const events = await db
    .select({
      id: securityEvents.id,
      eventType: securityEvents.eventType,
      userId: securityEvents.userId,
      username: securityEvents.username,
      ipAddress: securityEvents.ipAddress,
      metadata: securityEvents.metadata,
      createdAt: securityEvents.createdAt,
    })
    .from(securityEvents)
    .orderBy(desc(securityEvents.createdAt))
    .limit(pageSize)
    .offset(offset);

  return { events, total, page, pageSize };
}

export async function getInviteCodes() {
  await requireAdmin();

  const codes = await db
    .select({
      id: inviteCodes.id,
      code: inviteCodes.code,
      createdBy: inviteCodes.createdBy,
      creatorUsername: users.username,
      usedBy: inviteCodes.usedBy,
      expiresAt: inviteCodes.expiresAt,
      usedAt: inviteCodes.usedAt,
      createdAt: inviteCodes.createdAt,
    })
    .from(inviteCodes)
    .leftJoin(users, eq(inviteCodes.createdBy, users.id))
    .orderBy(desc(inviteCodes.createdAt));

  return codes;
}

// ── AI Chat Management ──────────────────────────────────────────

export async function getChatStats() {
  await requireAdmin();

  const [sessionCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(chatSessions);

  const [messageCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(chatMessages);

  return {
    sessions: sessionCount.count,
    messages: messageCount.count,
  };
}

export async function purgeAllChatData(
  _prev: AdminState,
  _formData: FormData
): Promise<AdminState> {
  const session = await requireAdmin();

  // Delete all messages first (FK constraint), then sessions
  await db.delete(chatMessages);
  await db.delete(chatSessions);

  const ctx = await getRequestContext();
  await logSecurityEvent({
    eventType: "admin_settings_changed",
    userId: session.userId,
    username: session.username,
    ...ctx,
    metadata: { action: "purge_all_chat_data" },
  });

  revalidatePath("/admin/settings");
  return { success: "All AI chat data has been purged" };
}
