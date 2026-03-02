import {
  randomBytes,
  hkdfSync,
  createCipheriv,
  createDecipheriv,
} from "crypto";

export const IV_LENGTH = 12; // GCM standard
export const TAG_LENGTH = 16; // GCM auth tag
const KEY_LENGTH = 32; // AES-256
const VERSION = 0x02; // Buffered format: version || iv || tag || ciphertext
export const STREAMING_VERSION = 0x03; // Streaming format: version || iv || ciphertext || tag

function getMasterKey(): Buffer {
  const hex = process.env.RESOURCE_MASTER_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      "RESOURCE_MASTER_KEY must be a 64-character hex string (32 bytes)"
    );
  }
  return Buffer.from(hex, "hex");
}

// ── Per-engagement key derivation (HKDF) ─────────────────────────────

function deriveKey(engagementId: string, info: string): Buffer {
  const master = getMasterKey();
  return Buffer.from(
    hkdfSync("sha256", master, engagementId, info, KEY_LENGTH)
  );
}

export function deriveFileKey(engagementId: string): Buffer {
  return deriveKey(engagementId, "resource-file");
}

function deriveFieldKey(engagementId: string): Buffer {
  return deriveKey(engagementId, "resource-field");
}

// ── File encryption (AES-256-GCM) ────────────────────────────────────
// Format v2: version(1) || iv(12) || tag(16) || ciphertext(variable)

export function encryptFileBuffer(
  plaintext: Buffer,
  engagementId: string
): Buffer {
  const key = deriveFileKey(engagementId);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([Buffer.from([VERSION]), iv, tag, ciphertext]);
}

// Decrypts both v2 (tag-before-ciphertext) and v3 (tag-after-ciphertext) formats
export function decryptFileBuffer(
  encrypted: Buffer,
  engagementId: string
): Buffer {
  if (encrypted.length < 1 + IV_LENGTH + TAG_LENGTH + 1) {
    throw new Error("Encrypted file too short");
  }
  const version = encrypted[0];

  if (version === VERSION) {
    // v2: version(1) || iv(12) || tag(16) || ciphertext(variable)
    const iv = encrypted.subarray(1, 1 + IV_LENGTH);
    const tag = encrypted.subarray(1 + IV_LENGTH, 1 + IV_LENGTH + TAG_LENGTH);
    const ciphertext = encrypted.subarray(1 + IV_LENGTH + TAG_LENGTH);

    const key = deriveFileKey(engagementId);
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } else if (version === STREAMING_VERSION) {
    // v3: version(1) || iv(12) || ciphertext(variable) || tag(16)
    const iv = encrypted.subarray(1, 1 + IV_LENGTH);
    const ciphertext = encrypted.subarray(1 + IV_LENGTH, encrypted.length - TAG_LENGTH);
    const tag = encrypted.subarray(encrypted.length - TAG_LENGTH);

    const key = deriveFileKey(engagementId);
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } else {
    throw new Error(`Unsupported encryption version: ${version}`);
  }
}

// ── DB field encryption (AES-256-GCM, base64) ────────────────────────
// Same format as file, but base64-encoded for text column storage

export function encryptFieldValue(
  plaintext: string,
  engagementId: string
): string {
  const key = deriveFieldKey(engagementId);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  const payload = Buffer.concat([Buffer.from([VERSION]), iv, tag, ciphertext]);
  return payload.toString("base64");
}

export function decryptFieldValue(
  encrypted: string,
  engagementId: string
): string {
  const payload = Buffer.from(encrypted, "base64");
  if (payload.length < 1 + IV_LENGTH + TAG_LENGTH + 1) {
    throw new Error("Encrypted field value too short");
  }
  const version = payload[0];
  if (version !== VERSION) {
    throw new Error(`Unsupported encryption version: ${version}`);
  }
  const iv = payload.subarray(1, 1 + IV_LENGTH);
  const tag = payload.subarray(1 + IV_LENGTH, 1 + IV_LENGTH + TAG_LENGTH);
  const ciphertext = payload.subarray(1 + IV_LENGTH + TAG_LENGTH);

  const key = deriveFieldKey(engagementId);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(ciphertext) + decipher.final("utf8");
}
