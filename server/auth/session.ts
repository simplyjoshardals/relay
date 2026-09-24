import { cookies } from "next/headers";
import { verifyAccessToken, type AccessTokenClaims } from "@/server/auth/jwt";
import { findUserById } from "@/server/repositories/users";
import { ACCESS_TOKEN_COOKIE } from "@/server/auth/cookies";
import { initialsFor } from "@/lib/initials";
import type { User } from "@/types";

/**
 * README §4/§9's getSessionFromRequest(): the one place an access token
 * is read and verified. Every Server Action and Route Handler that needs
 * "who is this, and what org/role do they have" calls this — never reads
 * or trusts a client-supplied org id or role directly (AUTH-06).
 *
 * Replaces lib/dev-self.ts's cookie-based fake session — same idea (a
 * cookie names who you are), but this one is a signed, verified JWT
 * instead of a bare user id anyone could hand-edit in devtools.
 */
export async function getSession(): Promise<AccessTokenClaims | null> {
  const store = await cookies();
  const token = store.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!token) return null;
  return verifyAccessToken(token);
}

/** For routes that should be unreachable without a session — throws
 *  rather than returning null, so a route can't accidentally proceed
 *  with `session` typed as possibly-null and forget the check. */
export async function requireSession(): Promise<AccessTokenClaims> {
  const session = await getSession();
  if (!session) {
    throw new Error("Not authenticated");
  }
  return session;
}

/**
 * Resolves the full user record for display (name, email, role) rather
 * than just the JWT's claims — what every page that used to call
 * getDevSelf() actually needs. Org-scoped via the verified session's
 * orgId, per §3 Layer 1; never trusts a client-supplied org id.
 *
 * Returns the client-safe `User` shape (§types), not Prisma's raw model —
 * that record also carries `passwordHash`, which must never reach a
 * Client Component prop even hashed. This is the one place that
 * boundary gets drawn, rather than leaving every caller to remember to
 * strip it themselves. `initials` is derived here rather than stored,
 * same as the invite-a-member path (lib/initials.ts).
 */
export async function getCurrentUser(): Promise<User | null> {
  const session = await getSession();
  if (!session) return null;

  const record = await findUserById(session.orgId, session.sub);
  if (!record) return null;

  return {
    id: record.id,
    orgId: record.orgId,
    email: record.email,
    name: record.name,
    role: record.role,
    initials: initialsFor(record.name),
    // findUserById only matches active users (Milestone 10), so anyone
    // who gets this far is active by construction — a deactivated user
    // with a still-unexpired access token resolves to null above and is
    // bounced to /login by the dashboard layout.
    active: true,
  };
}
