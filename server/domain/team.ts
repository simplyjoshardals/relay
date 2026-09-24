import type { Role } from "@/types";

/**
 * Team-management invariants (BACKEND_ROADMAP.md, Milestone 10) — pure
 * functions, no DB, same role `ticket.ts`/`incident.ts`/`service.ts` play
 * for their domains. The application layer (`server/application/users.ts`)
 * gathers the facts (who's acting, who's the target, how many active
 * Managers exist *right now*, read under a lock — see
 * `withTeamLock` in `server/repositories/users.ts`) and asks these
 * functions whether the change is allowed.
 */

/** How long an invitation link stays redeemable. */
export const INVITATION_TTL_DAYS = 7;
export const INVITATION_TTL_MS = INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000;

export type TeamRuleViolation =
  | "self_role_change"
  | "self_deactivation"
  | "last_manager";

interface MemberChange {
  actorId: string;
  targetId: string;
  targetRole: Role;
  /** Active Managers in the org *including* the target, counted inside
   *  the same locked transaction as the write this guards. */
  activeManagerCount: number;
}

/** AUTH-07: the UI already disables these controls for your own row
 *  (`TeamView`'s `isSelf`), but the UI is never the enforcement — the
 *  server refuses too. Decision 4: an org can never drop to zero active
 *  Managers, whoever is asking. */
export function roleChangeViolation(
  change: MemberChange & { newRole: Role },
): TeamRuleViolation | null {
  if (change.actorId === change.targetId) return "self_role_change";

  const demoting =
    change.targetRole === "MANAGER" && change.newRole !== "MANAGER";
  if (demoting && change.activeManagerCount <= 1) return "last_manager";

  return null;
}

export function deactivationViolation(
  change: MemberChange,
): TeamRuleViolation | null {
  if (change.actorId === change.targetId) return "self_deactivation";

  if (change.targetRole === "MANAGER" && change.activeManagerCount <= 1) {
    return "last_manager";
  }

  return null;
}

/** Client-facing wording for each violation — kept next to the rules so
 *  the message can't drift from what's actually being enforced. */
export const teamRuleMessages: Record<TeamRuleViolation, string> = {
  self_role_change: "You can't change your own role.",
  self_deactivation: "You can't remove yourself from the team.",
  last_manager:
    "An organization must keep at least one active Manager. Promote someone else first.",
};
