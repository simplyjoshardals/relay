import type { Role } from "@/types";
import { loginInputSchema } from "@/server/validation/auth";
import {
  findUserByEmailForLogin,
  findUserByIdForSession,
} from "@/server/repositories/users";
import {
  createRefreshToken,
  findValidRefreshToken,
  revokeRefreshToken,
} from "@/server/repositories/refresh-tokens";
import { verifyPassword } from "@/server/auth/password";
import { signAccessToken } from "@/server/auth/jwt";
import { generateRefreshToken, hashRefreshToken } from "@/server/auth/tokens";
import { REFRESH_TOKEN_TTL_SECONDS } from "@/server/auth/cookies";

interface SessionUser {
  id: string;
  orgId: string;
  email: string;
  name: string;
  role: Role;
}

export interface IssuedSession {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
  user: SessionUser;
}

/**
 * Deliberately free of `next/headers` — no `cookies()`, no `redirect()`.
 * That's what keeps these functions unit-testable with Vitest (§12)
 * without a Next.js request context to fake; the thin Server Action that
 * calls this (app/login/actions.ts) is where the actual cookie-setting
 * and redirect happen.
 */
async function issueSession(user: SessionUser): Promise<IssuedSession> {
  const accessToken = await signAccessToken({
    sub: user.id,
    orgId: user.orgId,
    role: user.role,
  });

  const refreshToken = generateRefreshToken();
  const refreshExpiresAt = new Date(
    Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000,
  );

  await createRefreshToken({
    userId: user.id,
    tokenHash: hashRefreshToken(refreshToken),
    expiresAt: refreshExpiresAt,
  });

  return { accessToken, refreshToken, refreshExpiresAt, user };
}

export type LoginResult =
  | { ok: true; session: IssuedSession }
  | { ok: false; error: "invalid_input" | "invalid_credentials" };

/**
 * The real credential check, replacing the dev role-switcher's
 * cookie-only fake session entirely. Returns a typed result rather than
 * throwing for the expected "wrong email or password" case — a thrown
 * error here should mean something actually went wrong (a DB outage),
 * not "the user mistyped their password."
 */
export async function loginWithPassword(input: unknown): Promise<LoginResult> {
  const parsed = loginInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const user = await findUserByEmailForLogin(parsed.data.email);
  if (!user) return { ok: false, error: "invalid_credentials" };

  const validPassword = await verifyPassword(
    parsed.data.password,
    user.passwordHash,
  );
  if (!validPassword) return { ok: false, error: "invalid_credentials" };

  const session = await issueSession({
    id: user.id,
    orgId: user.orgId,
    email: user.email,
    name: user.name,
    role: user.role,
  });

  return { ok: true, session };
}

export type RefreshResult =
  | { ok: true; session: IssuedSession }
  | { ok: false; error: "invalid_token" };

/**
 * README §4's rotation rule: a refresh token is single-use. Redeeming it
 * revokes it immediately and issues a brand-new access+refresh pair — so
 * a stolen, already-used refresh token is inert, and a legitimate client
 * that somehow tries to reuse one (a retry after a dropped response,
 * say) finds out right away instead of silently getting two valid
 * sessions from one token.
 */
export async function refreshSession(
  refreshTokenValue: string,
): Promise<RefreshResult> {
  const tokenHash = hashRefreshToken(refreshTokenValue);
  const existing = await findValidRefreshToken(tokenHash);
  if (!existing) return { ok: false, error: "invalid_token" };

  await revokeRefreshToken(existing.id);

  const user = await findUserByIdForSession(existing.userId);
  if (!user) return { ok: false, error: "invalid_token" };

  const session = await issueSession({
    id: user.id,
    orgId: user.orgId,
    email: user.email,
    name: user.name,
    role: user.role,
  });

  return { ok: true, session };
}

/** Revokes the refresh token if there is one; a missing or already-
 *  invalid token is not an error here — signing out an already-signed-
 *  out session should just succeed. */
export async function logout(refreshTokenValue: string | null): Promise<void> {
  if (!refreshTokenValue) return;

  const existing = await findValidRefreshToken(
    hashRefreshToken(refreshTokenValue),
  );
  if (existing) await revokeRefreshToken(existing.id);
}
