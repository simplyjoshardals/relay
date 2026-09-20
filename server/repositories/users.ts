import { prisma } from "@/lib/prisma";

/**
 * README §3, Layer 1: every repository function takes `orgId` as its
 * required first parameter, sourced only from a verified session — that's
 * the actual org-scoping enforcement until RLS (Layer 2) lands, and it's
 * a code-review rule as much as a type signature. The two functions
 * below are the deliberate, documented exceptions: login and refresh are
 * exactly the moment a session doesn't exist yet, so there's no orgId to
 * scope by. Every other user lookup in the app must go through
 * `findUserById`, not these two.
 */

/**
 * Login-time lookup, before any session exists. Schema-wise, email is
 * unique per org (§1), not globally — a real multi-org product needs an
 * org-disambiguation step before this (a subdomain, an org picker), which
 * doesn't exist yet (see the deferred /register decision). For the
 * current single-org reality this returns the first match, which is
 * correct as long as that holds.
 */
export async function findUserByEmailForLogin(email: string) {
  return prisma.user.findFirst({ where: { email } });
}

/**
 * Refresh-time lookup: the refresh token's DB row tells us a `userId`,
 * but re-establishing a session from it is, like login, the moment
 * before we have a verified orgId to scope by — the refresh token record
 * itself (looked up by its own hash, already org-implicit via the user
 * it belongs to) is what stands in for authorization here.
 */
export async function findUserByIdForSession(userId: string) {
  return prisma.user.findFirst({ where: { id: userId } });
}

/** The org-scoped lookup every other part of the app should use once a
 *  session exists. */
export async function findUserById(orgId: string, userId: string) {
  return prisma.user.findFirst({ where: { id: userId, orgId } });
}

export async function listUsersForOrg(orgId: string) {
  return prisma.user.findMany({ where: { orgId }, orderBy: { name: "asc" } });
}
