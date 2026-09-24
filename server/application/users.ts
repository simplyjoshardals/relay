import type { AccessTokenClaims } from "@/server/auth/jwt";
import { canManageTeam } from "@/lib/permissions";
import {
  deactivationViolation,
  roleChangeViolation,
  teamRuleMessages,
} from "@/server/domain/team";
import { updateMemberRoleInputSchema } from "@/server/validation/users";
import { listUsersForOrg, withTeamLock } from "@/server/repositories/users";
import { recordActivity } from "@/server/application/activities";
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/server/application/errors";
import { broadcastToOrg } from "@/server/realtime/broadcast";
import { initialsFor } from "@/lib/initials";
import type { Role, User } from "@/types";

function toClientShape(u: {
  id: string;
  orgId: string;
  email: string;
  name: string;
  role: string;
  active: boolean;
}): User {
  return {
    id: u.id,
    orgId: u.orgId,
    email: u.email,
    name: u.name,
    role: u.role as Role,
    initials: initialsFor(u.name),
    active: u.active,
  };
}

/**
 * Real user data for the ticket assignee picker (TicketModal), so
 * `assigneeId` always references a row that actually exists — the
 * alternative (mock user ids) would violate the ticket→user foreign key
 * the moment a real database is behind this. Reused as-is by
 * IncidentModal, PresenceRail (Milestone 7), ActivityView (to resolve
 * `actorId` → a name) and, as of Milestone 10, the Team page.
 *
 * Returns *every* user in the org, deactivated ones included, flagged
 * via `active`: old tickets, incidents and activity still point at
 * people who've since left, and those need to keep resolving to a real
 * name rather than turning into "Unassigned"/"telemetry". Anything that
 * offers people as a *choice* (pickers, the presence roster, the team
 * list) filters on `active` itself.
 */
export async function listOrgUsers(
  session: AccessTokenClaims,
): Promise<User[]> {
  const users = await listUsersForOrg(session.orgId);
  return users.map(toClientShape);
}

/**
 * The JWT's `role` is a snapshot from when the access token was minted
 * (up to ~15 minutes old — server/auth/jwt.ts), so it's fine as a cheap
 * first gate but can't be the last word for team changes: someone
 * demoted or removed a minute ago still carries a token saying MANAGER.
 * Every team-membership write therefore *also* re-checks the actor
 * against the database, inside the same locked transaction as the write
 * itself (see the `withTeamLock` callbacks below).
 */
function assertManagerClaim(session: AccessTokenClaims, message: string) {
  if (!canManageTeam(session.role)) throw new ForbiddenError(message);
}

/**
 * Manager-only role change. Same shape as `updateService`'s gate
 * (`canManageServices`), plus what services never needed:
 *
 *  - self-protection (AUTH-07): you can't change your own role — checked
 *    here, server-side, in addition to `TeamView` disabling the control;
 *  - the last-Manager guard (decision 4): demoting the only remaining
 *    active Manager is rejected, not a warning to click through. The
 *    count and the write happen under `withTeamLock`, so two Managers
 *    demoting each other at once can't both succeed.
 *
 * Setting a role a member already has is a quiet no-op — no write, no
 * activity row, no broadcast.
 */
export async function updateMemberRole(
  session: AccessTokenClaims,
  userId: string,
  input: unknown,
): Promise<User> {
  assertManagerClaim(session, "Only a Manager can change a member's role.");

  const parsed = updateMemberRoleInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError(
      parsed.error.issues[0]?.message ?? "Invalid input.",
    );
  }
  const newRole = parsed.data.role;

  const outcome = await withTeamLock(session.orgId, async (tx) => {
    const actor = await tx.findMember(session.sub);
    if (!actor || !canManageTeam(actor.role as Role)) {
      throw new ForbiddenError("Only a Manager can change a member's role.");
    }

    const target = await tx.findMember(userId);
    if (!target) throw new NotFoundError("Member not found.");

    const violation = roleChangeViolation({
      actorId: session.sub,
      targetId: target.id,
      targetRole: target.role as Role,
      newRole,
      activeManagerCount: await tx.countActiveManagers(),
    });
    if (violation) throw new ForbiddenError(teamRuleMessages[violation]);

    if (target.role === newRole) {
      return { target, previousRole: target.role, changed: false };
    }

    await tx.setRole(target.id, newRole);
    return { target, previousRole: target.role, changed: true };
  });

  const updated = toClientShape({
    ...outcome.target,
    role: newRole,
  });

  if (!outcome.changed) return updated;

  await recordActivity(session.orgId, {
    actorId: session.sub,
    action: "MEMBER_ROLE_CHANGED",
    targetType: "user",
    targetId: outcome.target.id,
    // `member` is a display name, same reason TICKET_ASSIGNED stores
    // `assignee` as one: ActivityDescription renders it directly.
    metadata: {
      member: outcome.target.name,
      from: outcome.previousRole,
      to: newRole,
    },
  });

  await broadcastToOrg(session.orgId, "team.updated", {
    id: outcome.target.id,
    orgId: session.orgId,
  });

  return updated;
}

/**
 * "Remove member" (decision 2): deactivate, never delete. Sets
 * `active = false` and revokes every refresh token in one transaction,
 * so the person can't log in and can't quietly refresh an existing
 * session — but the row, and every ticket/incident/activity row that
 * references it, stays exactly as it was.
 *
 * Same self-protection and last-Manager rules as `updateMemberRole`,
 * under the same lock.
 *
 * Known residual gap (documented in BACKEND_ROADMAP.md, Milestone 10):
 * access tokens are verified by signature alone in `requireSession()`,
 * so a just-deactivated user's already-issued access token can still
 * pass for up to `ACCESS_TOKEN_TTL_SECONDS` (15 min). Their refresh token
 * is dead and login is blocked, so it can't be renewed; and the
 * dashboard layout's `getCurrentUser()` (which does hit the DB) bounces
 * them on their next page load.
 */
export async function deactivateMember(
  session: AccessTokenClaims,
  userId: string,
): Promise<User> {
  assertManagerClaim(session, "Only a Manager can remove a member.");

  const target = await withTeamLock(session.orgId, async (tx) => {
    const actor = await tx.findMember(session.sub);
    if (!actor || !canManageTeam(actor.role as Role)) {
      throw new ForbiddenError("Only a Manager can remove a member.");
    }

    const member = await tx.findMember(userId);
    if (!member) throw new NotFoundError("Member not found.");

    const violation = deactivationViolation({
      actorId: session.sub,
      targetId: member.id,
      targetRole: member.role as Role,
      activeManagerCount: await tx.countActiveManagers(),
    });
    if (violation) throw new ForbiddenError(teamRuleMessages[violation]);

    await tx.deactivate(member.id);
    await tx.revokeRefreshTokens(member.id);
    return member;
  });

  await recordActivity(session.orgId, {
    actorId: session.sub,
    action: "MEMBER_DEACTIVATED",
    targetType: "user",
    targetId: target.id,
    metadata: { member: target.name },
  });

  await broadcastToOrg(session.orgId, "team.updated", {
    id: target.id,
    orgId: session.orgId,
  });

  return toClientShape({ ...target, active: false });
}