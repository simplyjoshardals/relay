import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scrypt = promisify(scryptCallback);

const KEY_LENGTH = 64;

/**
 * Password hashing via Node's built-in scrypt — no extra dependency, no
 * native-binary compile step (unlike bcrypt's node-gyp requirement,
 * which is one more thing that can fail to build in a constrained
 * deploy environment). scrypt is a slow, memory-hard KDF, which is what
 * a low-entropy secret like a password actually needs; contrast with
 * refresh tokens (server/auth/tokens.ts), which are already
 * high-entropy random values and use a fast hash instead.
 *
 * Stored as `salt:derivedKey`, both hex-encoded, in the existing
 * `password_hash` column.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<boolean> {
  const [salt, hashHex] = storedHash.split(":");
  if (!salt || !hashHex) return false;

  const derived = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
  const stored = Buffer.from(hashHex, "hex");

  // timingSafeEqual throws on a length mismatch rather than returning
  // false — guard explicitly so a corrupt/short stored hash can't crash
  // a login attempt.
  if (derived.length !== stored.length) return false;

  return timingSafeEqual(derived, stored);
}
