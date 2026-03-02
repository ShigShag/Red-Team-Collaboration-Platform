import { hash, verify } from "@node-rs/argon2";

// OWASP recommended Argon2id parameters
// https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
const ARGON2_OPTIONS = {
  memoryCost: 19456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
};

export async function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(
  hashed: string,
  password: string
): Promise<boolean> {
  return verify(hashed, password);
}
