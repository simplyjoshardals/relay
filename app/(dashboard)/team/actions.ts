"use server";

import { requireSession } from "@/server/auth/session";
import { deactivateMember, updateMemberRole } from "@/server/application/users";
import {
  inviteMember,
  listPendingInvitations,
  revokeInvitation,
  type InviteMemberResult,
} from "@/server/application/invitations";
import { toActionError, type ActionError } from "@/server/application/errors";
import type { PendingInvitation, User } from "@/types";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ActionError };

// The member list itself is `listOrgUsersAction` (tickets/actions.ts) —
// the same query TicketModal, IncidentModal, PresenceRail and
// ActivityView already share, under the same `["org-users", "list"]`
// key. Only what's *new* to Team management lives here.

/** Used directly as TanStack Query's `queryFn` (§10), same as
 *  listServicesAction. Manager-only; a Member calling this directly gets
 *  a thrown ForbiddenError rather than the list (AUTH-04). */
export async function listPendingInvitationsAction(): Promise<
  PendingInvitation[]
> {
  const session = await requireSession();
  return listPendingInvitations(session);
}

export async function inviteMemberAction(
  input: unknown,
): Promise<ActionResult<InviteMemberResult>> {
  try {
    const session = await requireSession();
    const result = await inviteMember(session, input);
    return { ok: true, data: result };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

export async function revokeInvitationAction(
  invitationId: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireSession();
    await revokeInvitation(session, invitationId);
    return { ok: true, data: { id: invitationId } };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

export async function updateMemberRoleAction(
  userId: string,
  input: unknown,
): Promise<ActionResult<User>> {
  try {
    const session = await requireSession();
    const user = await updateMemberRole(session, userId, input);
    return { ok: true, data: user };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

/** The "Remove member" button's action — deactivates, never deletes
 *  (BACKEND_ROADMAP.md, Milestone 10, decision 2). */
export async function deactivateMemberAction(
  userId: string,
): Promise<ActionResult<User>> {
  try {
    const session = await requireSession();
    const user = await deactivateMember(session, userId);
    return { ok: true, data: user };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}
