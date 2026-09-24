import { prisma } from "@/lib/prisma";
import type { Role } from "@/types";
import {
  createUser,
  findUserByEmailInOrg,
  reactivateUser,
  type CreateUserData,
} from "@/server/repositories/users";

/**
 * Invitations (BACKEND_ROADMAP.md, Milestone 10, decision 1). "Pending"
 * everywhere below means the same thing: not accepted, not revoked, not
 * past `expiresAt`.
 */

const pendingWhere = (now: Date) => ({
  acceptedAt: null,
  revokedAt: null,
  expiresAt: { gt: now },
});

export interface CreateInvitationData {
  email: string;
  name: string;
  role: Role;
  tokenHash: string;
  expiresAt: Date;
  invitedById: string;
}

/**
 * Creates the invitation, first revoking any *other* pending invitation
 * to the same email in this org — one live link per person at a time.
 * Re-inviting is how a Manager "resends" or fixes a role, and it must
 * kill the old link, not leave two redeemable ones. One transaction, so
 * there's never a moment with zero valid links after a re-invite.
 */
export async function createInvitationSupersedingPending(
  orgId: string,
  data: CreateInvitationData,
) {
  return prisma.$transaction(async (tx) => {
    await tx.invitation.updateMany({
      where: { orgId, email: data.email, ...pendingWhere(new Date()) },
      data: { revokedAt: new Date() },
    });

    return tx.invitation.create({ data: { ...data, orgId } });
  });
}

/** The Team page's "pending" rows. Newest first. */
export async function listPendingInvitationsForOrg(orgId: string) {
  return prisma.invitation.findMany({
    where: { orgId, ...pendingWhere(new Date()) },
    orderBy: { createdAt: "desc" },
  });
}

/** Withdraws a still-pending invitation. Returns how many rows changed —
 *  0 means it didn't exist in this org, or was already accepted, revoked
 *  or expired (the caller can't and needn't tell those apart). */
export async function revokePendingInvitation(orgId: string, id: string) {
  const result = await prisma.invitation.updateMany({
    where: { id, orgId, ...pendingWhere(new Date()) },
    data: { revokedAt: new Date() },
  });
  return result.count;
}

/**
 * Accept-time lookup by the hash of the link's token. Like
 * `findUserByEmailForLogin`, a deliberate exception to "orgId first":
 * the person opening an invitation link has no session, so the token
 * itself is the only thing that can say which org this is. The token is
 * 256 bits of randomness (server/auth/tokens.ts) and only its hash is
 * stored, so this is a lookup key, not a guessable identifier.
 *
 * Returns the row in *any* state (with the org's name for the accept
 * page); the application layer decides whether it's still usable.
 */
export async function findInvitationByTokenHash(tokenHash: string) {
  return prisma.invitation.findUnique({
    where: { tokenHash },
    include: { organization: { select: { name: true } } },
  });
}

/** Whether an invitation row (as returned above) can still be redeemed. */
export function isInvitationPending(invitation: {
  acceptedAt: Date | null;
  revokedAt: Date | null;
  expiresAt: Date;
}): boolean {
  return (
    invitation.acceptedAt === null &&
    invitation.revokedAt === null &&
    invitation.expiresAt.getTime() > Date.now()
  );
}

/**
 * What accepting an invitation needs, bound to one transaction — same
 * shape and reasoning as `TeamTx` in repositories/users.ts. The
 * application layer decides *what* to do (create a user or bring back a
 * deactivated one, reject an already-active member); the transaction is
 * what makes "claim the invitation" and "create the user" one atomic
 * step.
 */
export interface AcceptanceTx {
  /**
   * Atomically flips a still-pending invitation to accepted. Returns
   * false if it wasn't pending by the time this ran — already redeemed
   * by a concurrent request, revoked, or expired. Two people (or one
   * double-clicking) racing on the same link can only ever produce one
   * `true`.
   */
  claim(invitationId: string): Promise<boolean>;
  findUserByEmail(
    orgId: string,
    email: string,
  ): ReturnType<typeof findUserByEmailInOrg>;
  createUser(
    orgId: string,
    data: CreateUserData,
  ): ReturnType<typeof createUser>;
  reactivateUser(
    orgId: string,
    userId: string,
    data: { name: string; role: Role; passwordHash: string },
  ): ReturnType<typeof reactivateUser>;
}

export async function withAcceptanceTransaction<T>(
  fn: (tx: AcceptanceTx) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (db) =>
    fn({
      claim: async (invitationId) => {
        const result = await db.invitation.updateMany({
          where: { id: invitationId, ...pendingWhere(new Date()) },
          data: { acceptedAt: new Date() },
        });
        return result.count === 1;
      },
      findUserByEmail: (orgId, email) => findUserByEmailInOrg(orgId, email, db),
      createUser: (orgId, data) => createUser(orgId, data, db),
      reactivateUser: (orgId, userId, data) =>
        reactivateUser(orgId, userId, data, db),
    }),
  );
}
