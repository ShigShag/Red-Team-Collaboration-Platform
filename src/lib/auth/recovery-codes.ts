import { randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { recoveryCodes } from "@/db/schema";
import { hashPassword, verifyPassword } from "./password";

const CODE_COUNT = 8;
const CODE_LENGTH = 8;
const CHARSET = "abcdefghijklmnopqrstuvwxyz0123456789";

function generateCode(): string {
  const bytes = randomBytes(CODE_LENGTH);
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CHARSET[bytes[i] % CHARSET.length];
  }
  return code;
}

export function formatCodeForDisplay(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

export function normalizeCode(input: string): string {
  return input.replace(/[-\s]/g, "").toLowerCase();
}

export async function generateRecoveryCodes(
  userId: string
): Promise<string[]> {
  // Delete existing codes
  await db.delete(recoveryCodes).where(eq(recoveryCodes.userId, userId));

  const plaintextCodes: string[] = [];
  const hashPromises: Promise<{ userId: string; codeHash: string }>[] = [];

  for (let i = 0; i < CODE_COUNT; i++) {
    const code = generateCode();
    plaintextCodes.push(code);
    hashPromises.push(
      hashPassword(code).then((codeHash) => ({ userId, codeHash }))
    );
  }

  const rows = await Promise.all(hashPromises);
  await db.insert(recoveryCodes).values(rows);

  return plaintextCodes;
}

export async function verifyRecoveryCode(
  userId: string,
  code: string
): Promise<boolean> {
  const normalized = normalizeCode(code);

  const storedCodes = await db
    .select({ id: recoveryCodes.id, codeHash: recoveryCodes.codeHash })
    .from(recoveryCodes)
    .where(eq(recoveryCodes.userId, userId));

  if (storedCodes.length === 0) return false;

  for (const stored of storedCodes) {
    const match = await verifyPassword(stored.codeHash, normalized);
    if (match) {
      // Delete used code (single-use)
      await db.delete(recoveryCodes).where(eq(recoveryCodes.id, stored.id));
      return true;
    }
  }

  return false;
}

export async function getRecoveryCodeCount(userId: string): Promise<number> {
  const codes = await db
    .select({ id: recoveryCodes.id })
    .from(recoveryCodes)
    .where(eq(recoveryCodes.userId, userId));
  return codes.length;
}
