import { prisma } from "@/lib/prisma";
import { Prisma } from "@/lib/generated/prisma/client";
import type { Role } from "@/types";
import { revokeAllRefreshTokensForUser } from "@/server/repositories/refresh-tokens";

/**
 * README §3, Layer 1: every repository function takes `orgId` as its
 * required first parameter, sourced only from a verified session — that's
 * the actual org-scoping enforcement until RLS (Layer 2) lands, and it's
 * a code-review rule as much as a type signature. The two functions
 * below are the deliberate, documented exceptions: login and refresh are
 * exactly the moment a session doesn't exist yet, so there's no orgId to
 * scope by. Every other user lookup in the app must go through
 * `findUserById`, not these two.
 *
 * Milestone 10: `findUserByEmailForLogin`, `findUserByIdForSession` and
 * `findUserById` all only match *active* users — a deactivated member
 * can't log in, can't redeem a refresh token, and stops resolving as a
 * session user (`getCurrentUser`). `listUsersForOrg` deliberately does
 * NOT filter: history (activity actors, ticket assignees) must keep
 * resolving to a real name after someone leaves.
 */

type Db = Prisma.TransactionClient;

/**
 * Login-time lookup, before any session exists. Schema-wise, email is
 * unique per org (§1), not globally — a real multi-org product needs an
 * org-disambiguation step before this (a subdomain, an org picker), which
 * doesn't exist yet (see the deferred /register decision). For the
 * current single-org reality this returns the first match, which is
 * correct as long as that holds.
 *
 * Case-insensitive: invitations store emails lower-cased, and someone
 * typing `Jane@Acme.com` at the login form is still Jane.
 */
export async function findUserByEmailForLogin(email: string) {
  return prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" }, active: true },
  });
}

/**
 * Refresh-time lookup: the refresh token's DB row tells us a `userId`,
 * but re-establishing a session from it is, like login, the moment
 * before we have a verified orgId to scope by — the refresh token record
 * itself (looked up by its own hash, already org-implicit via the user
 * it belongs to) is what stands in for authorization here.
 */
export async function findUserByIdForSession(userId: string) {
  return prisma.user.findFirst({ where: { id: userId, active: true } });
}

/** The org-scoped lookup every other part of the app should use once a
 *  session exists. Active users only — see the block comment above. */
export async function findUserById(orgId: string, userId: string) {
  return prisma.user.findFirst({ where: { id: userId, orgId, active: true } });
}

/** Every user in the org, deactivated ones included (see the block
 *  comment above) — callers that offer people as a choice filter on
 *  `active` themselves. */
export async function listUsersForOrg(orgId: string) {
  return prisma.user.findMany({ where: { orgId }, orderBy: { name: "asc" } });
}

/** Any user in the org with this email, active or not — used to reject
 *  inviting someone who's already on the team, and to find a previously
 *  deactivated member an invitation should bring back. Case-insensitive
 *  for the same reason as `findUserByEmailForLogin`. */
export async function findUserByEmailInOrg(
  orgId: string,
  email: string,
  db: Db = prisma,
) {
  return db.user.findFirst({
    where: { orgId, email: { equals: email, mode: "insensitive" } },
  });
}

export interface CreateUserData {
  email: string;
  name: string;
  role: Role;
  passwordHash: string;
}

/** Called at invitation-*accept* time, never at invite time
 *  (BACKEND_ROADMAP.md, Milestone 10, decision 1). */
export async function createUser(
  orgId: string,
  data: CreateUserData,
  db: Db = prisma,
) {
  return db.user.create({ data: { ...data, orgId } });
}

/** Brings a previously deactivated member back (decision 2: rows are
 *  never deleted, so accepting a fresh invitation for the same email
 *  re-uses the row rather than colliding with
 *  `@@unique([orgId, email])`). Everything they were attached to —
 *  tickets, incidents, activity — is still attached. */
export async function reactivateUser(
  orgId: string,
  userId: string,
  data: { name: string; role: Role; passwordHash: string },
  db: Db = prisma,
) {
  await db.user.updateMany({
    where: { id: userId, orgId, active: false },
    data: { ...data, active: true },
  });
  return db.user.findFirstOrThrow({ where: { id: userId, orgId } });
}

/** True for the unique-violation two concurrent acceptances of invitations
 *  for the same email would race into on `@@unique([orgId, email])`. */
export function isUserEmailTakenError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

type UserRow = NonNullable<Awaited<ReturnType<typeof findUserByEmailInOrg>>>;

/**
 * The operations a team-membership change needs, all bound to one
 * transaction *and* one org — so nothing done through this object can
 * accidentally touch another org, and everything in it commits or rolls
 * back together.
 */
export interface TeamTx {
  /** An *active* member of this org, or null. */
  findMember(userId: string): Promise<UserRow | null>;
  /** Active Managers in this org, counted at this moment under the lock. */
  countActiveManagers(): Promise<number>;
  setRole(userId: string, role: Role): Promise<void>;
  deactivate(userId: string): Promise<void>;
  /** The existing `revokeAllRefreshTokensForUser`, on this transaction's
   *  client — `deactivateMember`'s "kill their sessions" half. */
  revokeRefreshTokens(userId: string): Promise<void>;
}

/**
 * Runs `fn` inside a transaction that first takes a row lock on the
 * org, so every team-membership change for an org is serialized.
 *
 * Why it exists (BACKEND_ROADMAP.md, Milestone 10, decision 4): "count
 * active Managers, then demote/deactivate one" is a check-then-write.
 * Without a lock, two Managers demoting *each other* at the same moment
 * both read a count of 2, both pass the guard, and the org ends up with
 * none. The self-protection rules don't help here — neither request is
 * acting on its own row.
 *
 * `FOR NO KEY UPDATE`, not `FOR UPDATE`: every insert into a table with
 * a foreign key to `organizations` (tickets, incidents, …) takes a
 * `FOR KEY SHARE` lock on that org row, and `FOR UPDATE` would make all
 * of them wait behind a role change. `NO KEY UPDATE` conflicts with
 * itself (which is all we need) but not with `KEY SHARE`.
 */
export async function withTeamLock<T>(
  orgId: string,
  fn: (tx: TeamTx) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (db) => {
    await db.$queryRaw`SELECT id FROM organizations WHERE id = ${orgId}::uuid FOR NO KEY UPDATE`;

    const tx: TeamTx = {
      findMember: (userId) =>
        db.user.findFirst({ where: { id: userId, orgId, active: true } }),
      countActiveManagers: () =>
        db.user.count({ where: { orgId, role: "MANAGER", active: true } }),
      setRole: async (userId, role) => {
        await db.user.updateMany({
          where: { id: userId, orgId, active: true },
          data: { role },
        });
      },
      deactivate: async (userId) => {
        await db.user.updateMany({
          where: { id: userId, orgId, active: true },
          data: { active: false },
        });
      },
      revokeRefreshTokens: (userId) =>
        revokeAllRefreshTokensForUser(userId, db),
    };

    return fn(tx);
  });
}
