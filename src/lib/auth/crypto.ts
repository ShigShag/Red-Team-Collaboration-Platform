import {
  randomBytes,
  createCipheriv,
  createDecipheriv,
  pbkdf2Sync,
} from "crypto";

const PBKDF2_ITERATIONS = 600_000;
const KEY_LENGTH = 32; // AES-256
const IV_LENGTH = 12; // GCM standard
const TAG_LENGTH = 16; // GCM auth tag
const VERSION = 0x01;

// ── TOTP secret encryption key derivation ──────────────────────────

export function generateKeySalt(): string {
  return randomBytes(16).toString("hex");
}

export function deriveEncryptionKey(password: string, saltHex: string): Buffer {
  const salt = Buffer.from(saltHex, "hex");
  return pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH, "sha256");
}

// ── TOTP secret encrypt / decrypt (AES-256-GCM) ───────────────────

export function encryptTotpSecret(secret: string, key: Buffer): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(secret, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  // version(1) || iv(12) || tag(16) || ciphertext(variable)
  const payload = Buffer.concat([Buffer.from([VERSION]), iv, tag, ciphertext]);
  return payload.toString("base64");
}

export function decryptTotpSecret(encrypted: string, key: Buffer): string {
  const payload = Buffer.from(encrypted, "base64");
  const version = payload[0];
  if (version !== VERSION) throw new Error("Unsupported encryption version");
  const iv = payload.subarray(1, 1 + IV_LENGTH);
  const tag = payload.subarray(1 + IV_LENGTH, 1 + IV_LENGTH + TAG_LENGTH);
  const ciphertext = payload.subarray(1 + IV_LENGTH + TAG_LENGTH);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(ciphertext) + decipher.final("utf8");
}

/** Distinguish encrypted (versioned) from plaintext Base32 secrets. */
export function isEncryptedSecret(value: string): boolean {
  try {
    const buf = Buffer.from(value, "base64");
    // Minimum: 1 (version) + 12 (iv) + 16 (tag) + 1 (ciphertext)
    return buf.length >= 30 && buf[0] === VERSION;
  } catch {
    return false;
  }
}

// ── Pending-2FA key wrapping (AES-256-GCM with server key) ─────────

export function wrapKey(derivedKey: Buffer, wrappingKeyHex: string): string {
  const wrappingKey = Buffer.from(wrappingKeyHex, "hex");
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", wrappingKey, iv);
  const ciphertext = Buffer.concat([
    cipher.update(derivedKey),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  // iv(12) || tag(16) || ciphertext(32)
  return Buffer.concat([iv, tag, ciphertext]).toString("base64");
}

export function unwrapKey(wrapped: string, wrappingKeyHex: string): Buffer {
  const wrappingKey = Buffer.from(wrappingKeyHex, "hex");
  const payload = Buffer.from(wrapped, "base64");
  const iv = payload.subarray(0, IV_LENGTH);
  const tag = payload.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = payload.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = createDecipheriv("aes-256-gcm", wrappingKey, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}
