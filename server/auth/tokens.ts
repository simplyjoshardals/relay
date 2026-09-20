import { createHash, randomBytes } from "crypto";

/**
 * Refresh tokens are opaque random values, not JWTs — the `refresh_tokens`
 * row (with its own `expires_at`/`revoked_at`) is the source of truth;
 * the token itself is just a high-entropy lookup key handed to the
 * client. Hashed with a plain fast hash (SHA-256) rather than password.ts's
 * scrypt: this is already 256 bits of randomness, so there's nothing for
 * a slow KDF to protect against that a fast hash doesn't already cover —
 * the entire point of a slow KDF is compensating for a *low*-entropy
 * secret like a password.
 */
export function generateRefreshToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
