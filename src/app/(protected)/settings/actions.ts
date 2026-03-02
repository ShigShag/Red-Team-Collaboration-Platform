"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { eq, and, sql } from "drizzle-orm";
import { z } from "zod";
import { writeFile, unlink, mkdir } from "fs/promises";
import { join } from "path";
import { randomBytes } from "crypto";
import { db } from "@/db";
import { users, engagementMembers } from "@/db/schema";
import { getSession, deleteSession } from "@/lib/auth/session";
import { verifyPassword, hashPassword } from "@/lib/auth/password";
import { generateRecoveryCodes } from "@/lib/auth/recovery-codes";
import { changePasswordSchema } from "@/lib/validations";
import { verifyTotp } from "@/lib/auth/totp";
import {
  deriveEncryptionKey,
  decryptTotpSecret,
  encryptTotpSecret,
  generateKeySalt,
} from "@/lib/auth/crypto";
import { logSecurityEvent, getRequestContext } from "@/lib/security-logger";

const AVATARS_DIR = join(process.cwd(), "data", "avatars");
const MAX_AVATAR_SIZE = 2 * 1024 * 1024; // 2 MB
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const EXT_MAP: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

export type SettingsState = {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string[]>;
};

const profileSchema = z.object({
  displayName: z
    .string()
    .max(100, "Display name must be under 100 characters")
    .optional(),
});

const deleteAccountSchema = z.object({
  password: z.string().min(1, "Password is required to confirm account deletion"),
});

export async function updateProfile(
  _prev: SettingsState,
  formData: FormData
): Promise<SettingsState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const raw = {
    displayName: (formData.get("displayName") as string) || undefined,
  };

  const parsed = profileSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  await db
    .update(users)
    .set({
      displayName: parsed.data.displayName?.trim() || null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, session.userId));

  revalidatePath("/", "layout");

  return { success: "Profile updated" };
}

export async function uploadAvatar(
  _prev: SettingsState,
  formData: FormData
): Promise<SettingsState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const file = formData.get("avatar") as File | null;
  if (!file || file.size === 0) {
    return { error: "No file selected" };
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return { error: "Invalid file type. Use JPEG, PNG, or WebP" };
  }

  if (file.size > MAX_AVATAR_SIZE) {
    return { error: "File too large. Maximum size is 2 MB" };
  }

  // Read and validate file bytes — check magic bytes
  const buffer = Buffer.from(await file.arrayBuffer());
  if (!isValidImage(buffer, file.type)) {
    return { error: "File content does not match a valid image" };
  }

  // Delete old avatar if exists
  const [currentUser] = await db
    .select({ avatarPath: users.avatarPath })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);

  if (currentUser?.avatarPath) {
    const oldFile = currentUser.avatarPath.split("/").pop();
    if (oldFile) {
      try {
        await unlink(join(AVATARS_DIR, oldFile));
      } catch {
        // Old file may already be gone
      }
    }
  }

  const ext = EXT_MAP[file.type];
  const filename = `${session.userId}-${randomBytes(8).toString("hex")}${ext}`;

  await mkdir(AVATARS_DIR, { recursive: true });
  await writeFile(join(AVATARS_DIR, filename), buffer);

  await db
    .update(users)
    .set({ avatarPath: filename, updatedAt: new Date() })
    .where(eq(users.id, session.userId));

  revalidatePath("/", "layout");
  return { success: "Avatar updated" };
}

export async function removeAvatar(
  _prev: SettingsState,
  _formData: FormData
): Promise<SettingsState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const [currentUser] = await db
    .select({ avatarPath: users.avatarPath })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);

  if (currentUser?.avatarPath) {
    const oldFile = currentUser.avatarPath.split("/").pop();
    if (oldFile) {
      try {
        await unlink(join(AVATARS_DIR, oldFile));
      } catch {
        // File may already be gone
      }
    }
  }

  await db
    .update(users)
    .set({ avatarPath: null, updatedAt: new Date() })
    .where(eq(users.id, session.userId));

  revalidatePath("/", "layout");
  return { success: "Avatar removed" };
}

function isValidImage(buffer: Buffer, mimeType: string): boolean {
  if (buffer.length < 8) return false;

  switch (mimeType) {
    case "image/jpeg":
      // JPEG: starts with FF D8 FF
      return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    case "image/png":
      // PNG: starts with 89 50 4E 47 0D 0A 1A 0A
      return (
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47 &&
        buffer[4] === 0x0d &&
        buffer[5] === 0x0a &&
        buffer[6] === 0x1a &&
        buffer[7] === 0x0a
      );
    case "image/webp":
      // WebP: starts with RIFF....WEBP
      return (
        buffer[0] === 0x52 &&
        buffer[1] === 0x49 &&
        buffer[2] === 0x46 &&
        buffer[3] === 0x46 &&
        buffer[8] === 0x57 &&
        buffer[9] === 0x45 &&
        buffer[10] === 0x42 &&
        buffer[11] === 0x50
      );
    default:
      return false;
  }
}

export async function changePassword(
  _prev: SettingsState,
  formData: FormData
): Promise<SettingsState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const raw = {
    currentPassword: formData.get("currentPassword") as string,
    newPassword: formData.get("newPassword") as string,
    confirmNewPassword: formData.get("confirmNewPassword") as string,
    totpCode: (formData.get("totpCode") as string) || undefined,
  };

  const parsed = changePasswordSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const [user] = await db
    .select({
      passwordHash: users.passwordHash,
      totpEnabled: users.totpEnabled,
      totpSecret: users.totpSecret,
      totpKeySalt: users.totpKeySalt,
    })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);

  if (!user) redirect("/login");

  // Verify current password
  const valid = await verifyPassword(user.passwordHash, parsed.data.currentPassword);
  if (!valid) {
    const ctx = await getRequestContext();
    await logSecurityEvent({
      eventType: "password_change_failed",
      userId: session.userId,
      username: session.username,
      ...ctx,
      metadata: { reason: "invalid_current_password" },
    });
    return { error: "Current password is incorrect" };
  }

  // If 2FA is enabled, require TOTP code
  if (user.totpEnabled) {
    if (!parsed.data.totpCode || parsed.data.totpCode.length !== 6) {
      return { error: "2FA code is required" };
    }

    if (!user.totpSecret || !user.totpKeySalt) {
      return { error: "2FA configuration is corrupted. Contact an administrator." };
    }

    // Decrypt the TOTP secret with the current password
    const oldKey = deriveEncryptionKey(parsed.data.currentPassword, user.totpKeySalt);
    let totpPlaintext: string;
    try {
      totpPlaintext = decryptTotpSecret(user.totpSecret, oldKey);
    } catch {
      const ctx = await getRequestContext();
      await logSecurityEvent({
        eventType: "password_change_decrypt_failed",
        userId: session.userId,
        username: session.username,
        ...ctx,
      });
      return { error: "Failed to verify 2FA. Try again." };
    }

    const totpValid = verifyTotp(totpPlaintext, parsed.data.totpCode);
    if (!totpValid) {
      const ctx = await getRequestContext();
      await logSecurityEvent({
        eventType: "password_change_totp_failed",
        userId: session.userId,
        username: session.username,
        ...ctx,
      });
      return { error: "Invalid 2FA code" };
    }

    // Re-encrypt the TOTP secret with the new password
    const newSalt = generateKeySalt();
    const newKey = deriveEncryptionKey(parsed.data.newPassword, newSalt);
    const newEncrypted = encryptTotpSecret(totpPlaintext, newKey);
    const newHash = await hashPassword(parsed.data.newPassword);

    await db
      .update(users)
      .set({
        passwordHash: newHash,
        totpSecret: newEncrypted,
        totpKeySalt: newSalt,
        passwordResetRequired: false,
        updatedAt: new Date(),
      })
      .where(eq(users.id, session.userId));
  } else {
    // No 2FA — just update the password
    const newHash = await hashPassword(parsed.data.newPassword);

    await db
      .update(users)
      .set({
        passwordHash: newHash,
        passwordResetRequired: false,
        updatedAt: new Date(),
      })
      .where(eq(users.id, session.userId));
  }

  // Clear force-password-reset cookie if it was set
  const cookieStore = await cookies();
  cookieStore.delete("force_password_reset");

  const ctx = await getRequestContext();
  await logSecurityEvent({
    eventType: "password_changed",
    userId: session.userId,
    username: session.username,
    ...ctx,
  });

  return { success: "Password changed successfully" };
}

export async function deleteAccount(
  _prev: SettingsState,
  formData: FormData
): Promise<SettingsState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const raw = { password: formData.get("password") as string };
  const parsed = deleteAccountSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

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
      eventType: "account_delete_failed",
      userId: session.userId,
      username: session.username,
      ...ctx,
      metadata: { reason: "invalid_password" },
    });
    return { error: "Incorrect password" };
  }

  // Check if user is sole owner of any engagement
  const ownedEngagements = await db
    .select({ engagementId: engagementMembers.engagementId })
    .from(engagementMembers)
    .where(
      and(
        eq(engagementMembers.userId, session.userId),
        eq(engagementMembers.role, "owner")
      )
    );

  for (const { engagementId } of ownedEngagements) {
    const [result] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(engagementMembers)
      .where(
        and(
          eq(engagementMembers.engagementId, engagementId),
          eq(engagementMembers.role, "owner")
        )
      );
    if (result.count <= 1) {
      return {
        error:
          "You are the sole owner of one or more engagements. Transfer ownership before deleting your account.",
      };
    }
  }

  const ctx = await getRequestContext();
  await logSecurityEvent({
    eventType: "account_deleted",
    userId: session.userId,
    username: session.username,
    ...ctx,
  });

  await db.delete(users).where(eq(users.id, session.userId));
  await deleteSession();
  redirect("/login");
}

export async function regenerateRecoveryCodes(
  _prev: SettingsState & { recoveryCodes?: string[] },
  formData: FormData
): Promise<SettingsState & { recoveryCodes?: string[] }> {
  const session = await getSession();
  if (!session) redirect("/login");

  const password = formData.get("password") as string;
  if (!password) {
    return { error: "Password is required" };
  }

  const [user] = await db
    .select({
      passwordHash: users.passwordHash,
      totpEnabled: users.totpEnabled,
    })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);

  if (!user) redirect("/login");

  if (!user.totpEnabled) {
    return { error: "2FA must be enabled to generate recovery codes" };
  }

  const valid = await verifyPassword(user.passwordHash, password);
  if (!valid) {
    return { error: "Incorrect password" };
  }

  const codes = await generateRecoveryCodes(session.userId);

  const ctx = await getRequestContext();
  await logSecurityEvent({
    eventType: "recovery_codes_regenerated",
    userId: session.userId,
    username: session.username,
    ...ctx,
  });

  return { success: "Recovery codes regenerated", recoveryCodes: codes };
}
