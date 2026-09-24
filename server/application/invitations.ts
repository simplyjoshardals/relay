import type { PendingInvitation, Role } from "@/types";
import type { AccessTokenClaims } from "@/server/auth/jwt";
import { canManageTeam } from "@/lib/permissions";
import { INVITATION_TTL_MS } from "@/server/domain/team";
import {
  acceptInvitationInputSchema,
  inviteMemberInputSchema,
} from "@/server/validation/invitations";
import {
  createInvitationSupersedingPending,
  findInvitationByTokenHash,
  isInvitationPending,
  listPendingInvitationsForOrg,
  revokePendingInvitation,
  withAcceptanceTransaction,
} from "@/server/repositories/invitations";
import {
  findUserByEmailInOrg,
  findUserById,
  isUserEmailTakenError,
} from "@/server/repositories/users";
import { generateRefreshToken, hashRefreshToken } from "@/server/auth/tokens";
import { hashPassword } from "@/server/auth/password";
import { issueSession, type IssuedSession } from "@/server/application/auth";
import { recordActivity } from "@/server/application/activities";
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/server/application/errors";
import { broadcastToOrg } from "@/server/realtime/broadcast";

/**
 * The invite-and-accept half of Milestone 10 (BACKEND_ROADMAP.md,
 * decision 1). Lives beside `auth.ts` rather than inside it: accepting
 * an invitation has to *issue a session*, which is auth's business, and
 * `auth.ts` is deliberately free of anything but login/refresh/logout.
 *
 * Like `auth.ts`, deliberately free of `next/headers` — the thin Server
 * Action that calls `acceptInvitation` (app/invite/[token]/actions.ts)
 * is where cookies are actually set.
 */

function toPendingShape(invitation: {
  id: string;
  orgId: string;
  email: string;
  name: string;
  role: string;
  invitedById: string;
  createdAt: Date;
  expiresAt: Date;
}): PendingInvitation {
  return {
    id: invitation.id,
    orgId: invitation.orgId,
    email: invitation.email,
    name: invitation.name,
    role: invitation.role as Role,
    invitedById: invitation.invitedById,
    createdAt: invitation.createdAt.toISOString(),
    expiresAt: invitation.expiresAt.toISOString(),
  };
}

/** JWT claim as a cheap first gate, then the database as the last word —
 *  see `assertManagerClaim` in server/application/users.ts for why the
 *  claim alone isn't enough for team changes. */
async function assertActingManager(
  session: AccessTokenClaims,
  message: string,
) {
  if (!canManageTeam(session.role)) throw new ForbiddenError(message);

  const actor = await findUserById(session.orgId, session.sub);
  if (!actor || !canManageTeam(actor.role as Role)) {
    throw new ForbiddenError(message);
  }
}

/** The Team page's pending rows. Manager-only — invited names and
 *  emails aren't something a regular member has any need to see. */
export async function listPendingInvitations(
  session: AccessTokenClaims,
): Promise<PendingInvitation[]> {
  await assertActingManager(
    session,
    "Only a Manager can view pending invitations.",
  );

  const invitations = await listPendingInvitationsForOrg(session.orgId);
  return invitations.map(toPendingShape);
}

export interface InviteMemberResult {
  invitation: PendingInvitation;
  /**
   * The one-time invitation token (plaintext). Only its SHA-256 is
   * stored, so this is the only moment it exists in readable form.
   *
   * There is no email transport in this repo yet (nothing under
   * `server/` sends mail), so for MVP the inviting Manager gets the
   * token back and TeamInviteModal shows them the accept link to pass
   * along themselves. Wiring real delivery later is a matter of sending
   * the link from right here and dropping this field from the result —
   * nothing about the data model or the accept flow changes.
   */
  token: string;
}

/**
 * Creates a *pending invitation* — deliberately not a `User` row. The
 * invited person picks their own password when they accept, so no
 * Manager ever generates or handles a credential.
 *
 *  - Inviting someone who's already an active member is rejected.
 *  - Inviting a previously *deactivated* member is allowed: accepting
 *    brings their old row back (see `acceptInvitation`).
 *  - Re-inviting an email that already has a pending invitation
 *    supersedes it — the old link stops working.
 */
export async function inviteMember(
  session: AccessTokenClaims,
  input: unknown,
): Promise<InviteMemberResult> {
  await assertActingManager(session, "Only a Manager can invite members.");

  const parsed = inviteMemberInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError(
      parsed.error.issues[0]?.message ?? "Invalid input.",
    );
  }

  const existing = await findUserByEmailInOrg(session.orgId, parsed.data.email);
  if (existing?.active) {
    throw new ValidationError(`${parsed.data.email} is already on the team.`);
  }

  // Same opaque-random-value-hashed-at-rest scheme as refresh tokens
  // (server/auth/tokens.ts), reused rather than inventing a second one:
  // 256 bits of randomness, so a fast hash is enough, and the DB row's
  // `expiresAt` is the source of truth for validity.
  const token = generateRefreshToken();

  const invitation = await createInvitationSupersedingPending(session.orgId, {
    email: parsed.data.email,
    name: parsed.data.name,
    role: parsed.data.role,
    tokenHash: hashRefreshToken(token),
    expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
    invitedById: session.sub,
  });

  await recordActivity(session.orgId, {
    actorId: session.sub,
    action: "MEMBER_INVITED",
    // No user exists yet, so this event's `targetId` is the invitation's
    // id (types/index.ts documents this on Activity.targetType).
    targetType: "user",
    targetId: invitation.id,
    metadata: { name: invitation.name, role: invitation.role },
  });

  await broadcastToOrg(session.orgId, "team.updated", {
    id: invitation.id,
    orgId: session.orgId,
  });

  return { invitation: toPendingShape(invitation), token };
}

/** Withdraws a pending invitation so its link can't be redeemed (a
 *  typo'd email, a changed mind). No Activity row: decision 3 lists four
 *  team events and this isn't one of them. */
export async function revokeInvitation(
  session: AccessTokenClaims,
  invitationId: string,
): Promise<void> {
  await assertActingManager(
    session,
    "Only a Manager can revoke an invitation.",
  );

  const count = await revokePendingInvitation(session.orgId, invitationId);
  if (count === 0) {
    throw new NotFoundError("Invitation not found or no longer pending.");
  }

  await broadcastToOrg(session.orgId, "team.updated", {
    id: invitationId,
    orgId: session.orgId,
  });
}

export type InvitationPreview =
  | {
      valid: true;
      name: string;
      email: string;
      role: Role;
      orgName: string;
    }
  | { valid: false };

/**
 * What the accept page shows before the person has typed anything. Every
 * way a link can be unusable — unknown token, already used, revoked,
 * expired — collapses into one `{ valid: false }`: the page tells the
 * visitor to ask for a new link either way, and there's no reason to let
 * someone probing tokens learn which of those it was.
 */
export async function previewInvitation(
  token: string,
): Promise<InvitationPreview> {
  if (!token) return { valid: false };

  const invitation = await findInvitationByTokenHash(hashRefreshToken(token));
  if (!invitation || !isInvitationPending(invitation)) {
    return { valid: false };
  }

  return {
    valid: true,
    name: invitation.name,
    email: invitation.email,
    role: invitation.role as Role,
    orgName: invitation.organization.name,
  };
}

export type AcceptInvitationResult =
  | { ok: true; session: IssuedSession }
  | { ok: false; error: "invalid_input"; message: string }
  | { ok: false; error: "invalid_invitation" }
  | { ok: false; error: "already_member" };

/**
 * The invitee's side: they set a display name and their own password,
 * and become a real `User` with the role the Manager chose.
 *
 * Everything that must be all-or-nothing happens in one transaction:
 * claiming the invitation (a conditional update — two requests racing on
 * one link can only produce one winner) and creating the user. If the
 * email belongs to a previously *deactivated* member, that row is
 * brought back instead of creating a second one, since
 * `@@unique([orgId, email])` forbids the second and decision 2 says
 * rows are never deleted — their old tickets, incidents and activity are
 * still attached.
 *
 * Returns a typed result, like `loginWithPassword`, rather than throwing
 * for the expected failures — a thrown error here should mean something
 * actually broke.
 */
export async function acceptInvitation(
  input: unknown,
): Promise<AcceptInvitationResult> {
  const parsed = acceptInvitationInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "invalid_input",
      message: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const invitation = await findInvitationByTokenHash(
    hashRefreshToken(parsed.data.token),
  );
  if (!invitation || !isInvitationPending(invitation)) {
    return { ok: false, error: "invalid_invitation" };
  }

  // scrypt is deliberately slow — do it before opening the transaction,
  // not while holding it.
  const passwordHash = await hashPassword(parsed.data.password);

  try {
    const outcome = await withAcceptanceTransaction(async (tx) => {
      const existing = await tx.findUserByEmail(
        invitation.orgId,
        invitation.email,
      );

      // Checked before claiming, so an already-active member doesn't
      // burn the invitation.
      if (existing?.active) return { kind: "already_member" as const };

      if (!(await tx.claim(invitation.id))) {
        return { kind: "invalid_invitation" as const };
      }

      const data = {
        name: parsed.data.name,
        role: invitation.role as Role,
        passwordHash,
      };

      const user = existing
        ? await tx.reactivateUser(invitation.orgId, existing.id, data)
        : await tx.createUser(invitation.orgId, {
            ...data,
            email: invitation.email,
          });

      return { kind: "joined" as const, user };
    });

    if (outcome.kind === "already_member") {
      return { ok: false, error: "already_member" };
    }
    if (outcome.kind === "invalid_invitation") {
      return { ok: false, error: "invalid_invitation" };
    }

    const { user } = outcome;

    await recordActivity(user.orgId, {
      actorId: user.id,
      action: "MEMBER_JOINED",
      targetType: "user",
      targetId: user.id,
      metadata: { role: user.role },
    });

    await broadcastToOrg(user.orgId, "team.updated", {
      id: user.id,
      orgId: user.orgId,
    });

    const session = await issueSession({
      id: user.id,
      orgId: user.orgId,
      email: user.email,
      name: user.name,
      role: user.role,
    });

    return { ok: true, session };
  } catch (error) {
    // Two invitations for the same email accepted at the same instant
    // (possible only if two were created concurrently — re-inviting
    // normally supersedes) race into the unique constraint.
    if (isUserEmailTakenError(error)) {
      return { ok: false, error: "already_member" };
    }
    throw error;
  }
}
