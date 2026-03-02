import { randomBytes, createHmac, timingSafeEqual } from "crypto";
import { cookies, headers } from "next/headers";
import { eq, and, gt } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { getClientIp } from "@/lib/get-client-ip";
import { logSecurityEvent } from "@/lib/security-logger";

const SESSION_COOKIE = "session_token";
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const RAW_TOKEN_RE = /^[0-9a-f]{64}$/;

function getSessionSecret(): Buffer {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "SESSION_SECRET must be set to at least 32 characters (generate with: openssl rand -hex 32)"
    );
  }
  return Buffer.from(secret);
}

function signToken(rawToken: string): string {
  const hmac = createHmac("sha256", getSessionSecret())
    .update(rawToken)
    .digest("hex");
  return `${rawToken}.${hmac}`;
}

function verifyAndExtractToken(signedToken: string): string | null {
  const dotIndex = signedToken.indexOf(".");

  // Legacy unsigned token (transition period): bare 64-char hex
  if (dotIndex === -1) {
    return RAW_TOKEN_RE.test(signedToken) ? signedToken : null;
  }

  const rawToken = signedToken.substring(0, dotIndex);
  const providedHmac = signedToken.substring(dotIndex + 1);

  if (!RAW_TOKEN_RE.test(rawToken) || !RAW_TOKEN_RE.test(providedHmac)) {
    return null;
  }

  const expectedHmac = createHmac("sha256", getSessionSecret())
    .update(rawToken)
    .digest("hex");

  if (!timingSafeEqual(Buffer.from(providedHmac), Buffer.from(expectedHmac))) {
    return null;
  }

  return rawToken;
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  const ipAddress = await getClientIp();
  const headerStore = await headers();
  const userAgent = headerStore.get("user-agent") ?? null;

  // Delete any existing sessions for this user (prevent duplicate logins)
  await db.delete(sessions).where(eq(sessions.userId, userId));

  await db.insert(sessions).values({
    userId,
    token,
    expiresAt,
    ipAddress,
    userAgent,
  });

  const signedToken = signToken(token);

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, signedToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV !== "development",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });

  return signedToken;
}

export async function getSession() {
  const cookieStore = await cookies();
  const signedToken = cookieStore.get(SESSION_COOKIE)?.value;
  if (!signedToken) return null;

  const token = verifyAndExtractToken(signedToken);
  if (!token) return null;

  const result = await db
    .select({
      sessionId: sessions.id,
      userId: sessions.userId,
      expiresAt: sessions.expiresAt,
      sessionIpAddress: sessions.ipAddress,
      sessionUserAgent: sessions.userAgent,
      username: users.username,
      displayName: users.displayName,
      avatarPath: users.avatarPath,
      totpEnabled: users.totpEnabled,
      isAdmin: users.isAdmin,
      disabledAt: users.disabledAt,
      passwordResetRequired: users.passwordResetRequired,
      onboardingDismissedAt: users.onboardingDismissedAt,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.token, token), gt(sessions.expiresAt, new Date())))
    .limit(1);

  if (result.length === 0) {
    return null;
  }

  const session = result[0];

  // Disabled accounts: invalidate session immediately
  // Note: only delete from DB — cookies can't be modified in Server Components.
  // The stale cookie is harmless since the token no longer exists in the DB.
  if (session.disabledAt) {
    await db.delete(sessions).where(eq(sessions.token, token));
    return null;
  }

  // Session fingerprint binding: reject if IP or User-Agent changed
  const currentIp = await getClientIp();
  const currentHeaders = await headers();
  const currentUserAgent = currentHeaders.get("user-agent") ?? null;

  const storedIp = session.sessionIpAddress;
  const storedUa = session.sessionUserAgent;

  const ipMismatch =
    storedIp != null && storedIp !== "unknown" && storedIp !== currentIp;
  const uaMismatch = storedUa != null && storedUa !== currentUserAgent;

  if (ipMismatch || uaMismatch) {
    await db.delete(sessions).where(eq(sessions.token, token));

    const mismatchType =
      ipMismatch && uaMismatch ? "both" : ipMismatch ? "ip" : "user_agent";

    logSecurityEvent({
      eventType: "session_hijack_detected",
      userId: session.userId,
      username: session.username,
      ipAddress: currentIp,
      userAgent: currentUserAgent,
      metadata: {
        expectedIp: storedIp,
        actualIp: currentIp,
        expectedUserAgent: storedUa,
        actualUserAgent: currentUserAgent,
        mismatchType,
        sessionId: session.sessionId,
      },
    }).catch(() => {});

    return null;
  }

  const { sessionIpAddress: _, sessionUserAgent: __, ...sessionData } = session;
  return sessionData;
}

export async function deleteSession() {
  const cookieStore = await cookies();
  const signedToken = cookieStore.get(SESSION_COOKIE)?.value;
  if (!signedToken) return;

  const token = verifyAndExtractToken(signedToken);
  if (token) {
    await db.delete(sessions).where(eq(sessions.token, token));
  }
  cookieStore.delete(SESSION_COOKIE);
}
