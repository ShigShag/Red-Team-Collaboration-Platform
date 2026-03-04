"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { eq, and, gt, sql, isNull } from "drizzle-orm";
import { db } from "@/db";
import { users, pending2fa, inviteCodes } from "@/db/schema";
import { getSetting } from "@/lib/platform-settings";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession, getSession, deleteSession } from "@/lib/auth/session";
import { verifyTotp, generateTotpSecret, generateQrCode } from "@/lib/auth/totp";
import {
  deriveEncryptionKey,
  generateKeySalt,
  encryptTotpSecret,
  decryptTotpSecret,
  isEncryptedSecret,
  wrapKey,
  unwrapKey,
} from "@/lib/auth/crypto";
import { validateCaptchacatToken } from "@captchacat/nextjs/server";
import { registerSchema, loginSchema, totpSchema, enableTotpSchema, recoveryCodeSchema } from "@/lib/validations";
import { generateRecoveryCodes, verifyRecoveryCode } from "@/lib/auth/recovery-codes";
import { getClientIp } from "@/lib/get-client-ip";
import { authIpLimiter, totpIpLimiter } from "@/lib/rate-limit";
import { logSecurityEvent, getRequestContext } from "@/lib/security-logger";
import { timingSafeEqual } from "crypto";

const PENDING_2FA_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getTotpPendingKey(): string {
  const key = process.env.TOTP_PENDING_KEY;
  if (!key || key.length !== 64) {
    throw new Error("TOTP_PENDING_KEY must be set to a 64-character hex string");
  }
  return key;
}

async function validateCaptcha(formData: FormData): Promise<string | null> {
  if (process.env.CAPTCHA_ENABLED !== "true") return null;
  const token = formData.get("captchacat-token") as string;
  if (!token) return "CAPTCHA verification required";
  const result = await validateCaptchacatToken({
    apiKey: process.env.CAPTCHACAT_API_KEY!,
    token,
  });
  if (!result.valid) return "CAPTCHA verification failed";
  return null;
}

export type AuthState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  needs2fa?: boolean;
  pendingUserId?: string;
  recoveryCodes?: string[];
};

export async function register(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const ip = await getClientIp();
  const ipCheck = authIpLimiter.consume(ip);
  if (!ipCheck.allowed) {
    return { error: `Too many requests. Try again in ${Math.ceil(ipCheck.retryAfterMs / 1000)} seconds.` };
  }

  const registrationMode = await getSetting("registration_mode");
  if (registrationMode === "disabled") {
    return { error: "Registration is disabled" };
  }
  if (registrationMode === "code") {
    const securityCode = formData.get("securityCode") as string;
    const expectedCode = process.env.REGISTRATION_CODE ?? "";
    if (!securityCode || !expectedCode ||
      securityCode.length !== expectedCode.length ||
      !timingSafeEqual(Buffer.from(securityCode), Buffer.from(expectedCode))
    ) {
      return { error: "Invalid security code" };
    }
  }
  if (registrationMode === "invite") {
    const inviteCode = formData.get("inviteCode") as string;
    if (!inviteCode) {
      return { error: "Invite code is required" };
    }
    const [code] = await db
      .select({ id: inviteCodes.id })
      .from(inviteCodes)
      .where(
        and(
          eq(inviteCodes.code, inviteCode.trim()),
          isNull(inviteCodes.usedBy),
          gt(inviteCodes.expiresAt, new Date())
        )
      )
      .limit(1);
    if (!code) {
      return { error: "Invalid or expired invite code" };
    }
  }

  const captchaError = await validateCaptcha(formData);
  if (captchaError) return { error: captchaError };

  const raw = {
    username: formData.get("username") as string,
    password: formData.get("password") as string,
    confirmPassword: formData.get("confirmPassword") as string,
  };

  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }

  const { username, password } = parsed.data;

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username.toLowerCase()))
    .limit(1);

  if (existing.length > 0) {
    return { error: "Username is already taken" };
  }

  const passwordHash = await hashPassword(password);

  // Check if this is the first user (auto-promote to admin)
  const [{ count: userCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users);
  const isFirstUser = userCount === 0;

  const [user] = await db
    .insert(users)
    .values({
      username: username.toLowerCase(),
      passwordHash,
      isAdmin: isFirstUser,
    })
    .returning({ id: users.id });

  // Mark invite code as used if applicable
  if (registrationMode === "invite") {
    const inviteCode = (formData.get("inviteCode") as string).trim();
    await db
      .update(inviteCodes)
      .set({ usedBy: user.id, usedAt: new Date() })
      .where(eq(inviteCodes.code, inviteCode));
  }

  const ctx = await getRequestContext();
  await logSecurityEvent({
    eventType: "user_registered",
    userId: user.id,
    username: username.toLowerCase(),
    ...ctx,
    metadata: isFirstUser ? { autoAdmin: true } : undefined,
  });

  await createSession(user.id);

  // Enforce 2FA if required by platform setting
  const require2fa = await getSetting("require_2fa");
  if (require2fa === "true") {
    const cookieStore = await cookies();
    cookieStore.set("force_2fa_setup", "1", {
      httpOnly: true,
      secure: process.env.NODE_ENV !== "development",
      sameSite: "lax",
      path: "/",
    });
    redirect("/setup-2fa");
  }

  redirect("/dashboard");
}

export async function login(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const ip = await getClientIp();
  const ipCheck = authIpLimiter.consume(ip);
  if (!ipCheck.allowed) {
    return { error: `Too many requests. Try again in ${Math.ceil(ipCheck.retryAfterMs / 1000)} seconds.` };
  }

  const captchaError = await validateCaptcha(formData);
  if (captchaError) return { error: captchaError };

  const raw = {
    username: formData.get("username") as string,
    password: formData.get("password") as string,
  };

  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }

  const { username, password } = parsed.data;

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.username, username.toLowerCase()))
    .limit(1);

  if (!user) {
    const ctx = await getRequestContext();
    await logSecurityEvent({
      eventType: "login_failed",
      username: username.toLowerCase(),
      ...ctx,
      metadata: { reason: "user_not_found" },
    });
    return { error: "Invalid username or password" };
  }

  const valid = await verifyPassword(user.passwordHash, password);
  if (!valid) {
    const ctx = await getRequestContext();
    await logSecurityEvent({
      eventType: "login_failed",
      userId: user.id,
      username: user.username,
      ...ctx,
      metadata: { reason: "invalid_password" },
    });
    return { error: "Invalid username or password" };
  }

  // Block disabled accounts
  if (user.disabledAt) {
    const ctx = await getRequestContext();
    await logSecurityEvent({
      eventType: "login_failed",
      userId: user.id,
      username: user.username,
      ...ctx,
      metadata: { reason: "account_disabled" },
    });
    return { error: "This account has been disabled. Contact an administrator." };
  }

  if (user.totpEnabled && user.totpSecret) {
    // Lazy-migrate plaintext secrets to encrypted
    let salt = user.totpKeySalt;
    if (!salt || !isEncryptedSecret(user.totpSecret)) {
      salt = generateKeySalt();
      const derivedKey = deriveEncryptionKey(password, salt);
      const encrypted = encryptTotpSecret(user.totpSecret, derivedKey);
      await db
        .update(users)
        .set({ totpSecret: encrypted, totpKeySalt: salt, updatedAt: new Date() })
        .where(eq(users.id, user.id));
      derivedKey.fill(0);
    }

    // Derive key and store wrapped in pending_2fa for the TOTP step
    const derivedKey = deriveEncryptionKey(password, salt);
    const wrapped = wrapKey(derivedKey, getTotpPendingKey());
    derivedKey.fill(0);

    // Clean up old/expired pending rows, then insert new one
    await db.delete(pending2fa).where(
      eq(pending2fa.userId, user.id)
    );
    await db.insert(pending2fa).values({
      userId: user.id,
      wrappedKey: wrapped,
      expiresAt: new Date(Date.now() + PENDING_2FA_TTL_MS),
    });

    const ctx = await getRequestContext();
    await logSecurityEvent({
      eventType: "login_2fa_required",
      userId: user.id,
      username: user.username,
      ...ctx,
    });

    return { needs2fa: true, pendingUserId: user.id };
  }

  const ctx = await getRequestContext();
  await logSecurityEvent({
    eventType: "login_success",
    userId: user.id,
    username: user.username,
    ...ctx,
  });

  await createSession(user.id);

  if (user.passwordResetRequired) {
    const cookieStore = await cookies();
    cookieStore.set("force_password_reset", "1", {
      httpOnly: true,
      secure: process.env.NODE_ENV !== "development",
      sameSite: "lax",
      path: "/",
    });
    redirect("/reset-password");
  }

  // Enforce 2FA if required by platform setting and user hasn't set it up
  if (!user.totpEnabled) {
    const require2fa = await getSetting("require_2fa");
    if (require2fa === "true") {
      const cookieStore = await cookies();
      cookieStore.set("force_2fa_setup", "1", {
        httpOnly: true,
        secure: process.env.NODE_ENV !== "development",
        sameSite: "lax",
        path: "/",
      });
      redirect("/setup-2fa");
    }
  }

  redirect("/dashboard");
}

const MAX_TOTP_ATTEMPTS = 3;

export async function verifyTotpLogin(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const ip = await getClientIp();
  const ipCheck = totpIpLimiter.consume(ip);
  if (!ipCheck.allowed) {
    return { error: `Too many requests. Try again in ${Math.ceil(ipCheck.retryAfterMs / 1000)} seconds.` };
  }

  const userId = formData.get("userId") as string;
  const raw = { code: formData.get("code") as string };

  const parsed = totpSchema.safeParse(raw);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }

  const [user] = await db
    .select({ id: users.id, username: users.username, totpSecret: users.totpSecret, disabledAt: users.disabledAt, passwordResetRequired: users.passwordResetRequired })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user || !user.totpSecret) {
    return { error: "Invalid request" };
  }

  if (user.disabledAt) {
    return { error: "This account has been disabled. Contact an administrator." };
  }

  let secret: string;

  if (isEncryptedSecret(user.totpSecret)) {
    const [pendingRow] = await db
      .select({
        id: pending2fa.id,
        wrappedKey: pending2fa.wrappedKey,
        attempts: pending2fa.attempts,
      })
      .from(pending2fa)
      .where(
        and(
          eq(pending2fa.userId, userId),
          gt(pending2fa.expiresAt, new Date())
        )
      )
      .limit(1);

    if (!pendingRow) {
      const ctx = await getRequestContext();
      await logSecurityEvent({
        eventType: "totp_session_expired",
        userId,
        ...ctx,
      });
      return { error: "Session expired. Please log in again." };
    }

    if (pendingRow.attempts >= MAX_TOTP_ATTEMPTS) {
      await db.delete(pending2fa).where(eq(pending2fa.id, pendingRow.id));
      return { error: "Too many verification attempts. Please log in again." };
    }

    const derivedKey = unwrapKey(pendingRow.wrappedKey, getTotpPendingKey());
    try {
      secret = decryptTotpSecret(user.totpSecret, derivedKey);
    } catch {
      const ctx = await getRequestContext();
      await logSecurityEvent({
        eventType: "totp_decryption_failed",
        userId,
        ...ctx,
      });
      return { error: "Decryption failed. Please log in again." };
    } finally {
      derivedKey.fill(0);
    }

    if (!verifyTotp(secret, parsed.data.code)) {
      const newAttempts = pendingRow.attempts + 1;
      const ctx = await getRequestContext();
      await logSecurityEvent({
        eventType: "totp_invalid_code",
        userId,
        ...ctx,
        metadata: { attempt: newAttempts },
      });
      if (newAttempts >= MAX_TOTP_ATTEMPTS) {
        await db.delete(pending2fa).where(eq(pending2fa.id, pendingRow.id));
        return { error: "Too many verification attempts. Please log in again." };
      }
      await db
        .update(pending2fa)
        .set({ attempts: newAttempts })
        .where(eq(pending2fa.id, pendingRow.id));
      return { error: "Invalid authentication code" };
    }

    // Clean up the pending_2fa row
    await db.delete(pending2fa).where(eq(pending2fa.id, pendingRow.id));
  } else {
    // Fallback for plaintext secrets (migration window)
    secret = user.totpSecret;

    if (!verifyTotp(secret, parsed.data.code)) {
      const ctx = await getRequestContext();
      await logSecurityEvent({
        eventType: "totp_invalid_code",
        userId,
        ...ctx,
      });
      return { error: "Invalid authentication code" };
    }

    await db.delete(pending2fa).where(eq(pending2fa.userId, userId));
  }

  const ctx = await getRequestContext();
  await logSecurityEvent({
    eventType: "totp_login_success",
    userId: user.id,
    username: user.username,
    ...ctx,
  });

  await createSession(user.id);

  if (user.passwordResetRequired) {
    const cookieStore = await cookies();
    cookieStore.set("force_password_reset", "1", {
      httpOnly: true,
      secure: process.env.NODE_ENV !== "development",
      sameSite: "lax",
      path: "/",
    });
    redirect("/reset-password");
  }

  redirect("/dashboard");
}

export async function verifyRecoveryCodeLogin(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const ip = await getClientIp();
  const ipCheck = totpIpLimiter.consume(ip);
  if (!ipCheck.allowed) {
    return { error: `Too many requests. Try again in ${Math.ceil(ipCheck.retryAfterMs / 1000)} seconds.` };
  }

  const userId = formData.get("userId") as string;
  const raw = { code: formData.get("code") as string };

  const parsed = recoveryCodeSchema.safeParse(raw);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }

  // Verify the user exists and has 2FA enabled
  const [user] = await db
    .select({ id: users.id, username: users.username, totpEnabled: users.totpEnabled, disabledAt: users.disabledAt, passwordResetRequired: users.passwordResetRequired })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user || !user.totpEnabled) {
    return { error: "Invalid request" };
  }

  if (user.disabledAt) {
    return { error: "This account has been disabled. Contact an administrator." };
  }

  // Check pending_2fa row exists (proves they passed password check)
  const [pendingRow] = await db
    .select({ id: pending2fa.id, attempts: pending2fa.attempts })
    .from(pending2fa)
    .where(
      and(
        eq(pending2fa.userId, userId),
        gt(pending2fa.expiresAt, new Date())
      )
    )
    .limit(1);

  if (!pendingRow) {
    return { error: "Session expired. Please log in again." };
  }

  if (pendingRow.attempts >= MAX_TOTP_ATTEMPTS) {
    await db.delete(pending2fa).where(eq(pending2fa.id, pendingRow.id));
    return { error: "Too many verification attempts. Please log in again." };
  }

  const valid = await verifyRecoveryCode(userId, parsed.data.code);

  if (!valid) {
    const newAttempts = pendingRow.attempts + 1;
    const ctx = await getRequestContext();
    await logSecurityEvent({
      eventType: "recovery_code_login_failed",
      userId,
      username: user.username,
      ...ctx,
      metadata: { attempt: newAttempts },
    });
    if (newAttempts >= MAX_TOTP_ATTEMPTS) {
      await db.delete(pending2fa).where(eq(pending2fa.id, pendingRow.id));
      return { error: "Too many verification attempts. Please log in again." };
    }
    await db
      .update(pending2fa)
      .set({ attempts: newAttempts })
      .where(eq(pending2fa.id, pendingRow.id));
    return { error: "Invalid recovery code" };
  }

  // Clean up the pending_2fa row
  await db.delete(pending2fa).where(eq(pending2fa.id, pendingRow.id));

  const ctx = await getRequestContext();
  await logSecurityEvent({
    eventType: "recovery_code_login",
    userId: user.id,
    username: user.username,
    ...ctx,
  });

  await createSession(user.id);

  if (user.passwordResetRequired) {
    const cookieStore = await cookies();
    cookieStore.set("force_password_reset", "1", {
      httpOnly: true,
      secure: process.env.NODE_ENV !== "development",
      sameSite: "lax",
      path: "/",
    });
    redirect("/reset-password");
  }

  redirect("/dashboard");
}

export async function setupTotp() {
  const session = await getSession();
  if (!session) redirect("/login");

  const { secret, otpauthUri } = generateTotpSecret(session.username);
  const qrCode = await generateQrCode(otpauthUri);

  return { secret, qrCode };
}

export async function enableTotp(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const secret = formData.get("secret") as string;
  const raw = {
    code: formData.get("code") as string,
    password: formData.get("password") as string,
  };

  const parsed = enableTotpSchema.safeParse(raw);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }

  // Verify password before enabling 2FA
  const [user] = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);

  if (!user) redirect("/login");

  const valid = await verifyPassword(user.passwordHash, parsed.data.password);
  if (!valid) {
    const ctx = await getRequestContext();
    await logSecurityEvent({
      eventType: "totp_enable_password_failed",
      userId: session.userId,
      username: session.username,
      ...ctx,
    });
    return { error: "Incorrect password" };
  }

  // Verify TOTP code against plaintext secret
  if (!verifyTotp(secret, parsed.data.code)) {
    return { error: "Invalid code. Please try again." };
  }

  // Encrypt the TOTP secret with a key derived from the password
  const salt = generateKeySalt();
  const derivedKey = deriveEncryptionKey(parsed.data.password, salt);
  const encryptedSecret = encryptTotpSecret(secret, derivedKey);
  derivedKey.fill(0);

  await db
    .update(users)
    .set({
      totpSecret: encryptedSecret,
      totpKeySalt: salt,
      totpEnabled: true,
      updatedAt: new Date(),
    })
    .where(eq(users.id, session.userId));

  // Generate recovery codes
  const codes = await generateRecoveryCodes(session.userId);

  const ctx = await getRequestContext();
  await logSecurityEvent({
    eventType: "totp_enabled",
    userId: session.userId,
    username: session.username,
    ...ctx,
  });
  await logSecurityEvent({
    eventType: "recovery_codes_generated",
    userId: session.userId,
    username: session.username,
    ...ctx,
  });

  // Clear force_2fa_setup cookie if it was set during login/registration
  const cookieStore = await cookies();
  cookieStore.delete("force_2fa_setup");

  return { recoveryCodes: codes };
}

export async function logout() {
  const session = await getSession();
  if (session) {
    const ctx = await getRequestContext();
    await logSecurityEvent({
      eventType: "logout",
      userId: session.userId,
      username: session.username,
      ...ctx,
    });
  }
  await deleteSession();
}
