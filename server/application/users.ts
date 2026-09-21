import type { AccessTokenClaims } from "@/server/auth/jwt";
import { listUsersForOrg } from "@/server/repositories/users";
import { initialsFor } from "@/lib/initials";
import type { User } from "@/types";

/**
 * Real user data for the ticket assignee picker (TicketModal), so
 * `assigneeId` always references a row that actually exists — the
 * alternative (mock user ids) would violate the ticket→user foreign key
 * the moment a real database is behind this. The rest of Team
 * management is still mock data (that's Milestone 9); this one read is
 * pulled forward because Milestone 2's ticket assignment needs it to be
 * real to work at all.
 */
export async function listOrgUsers(
  session: AccessTokenClaims,
): Promise<User[]> {
  const users = await listUsersForOrg(session.orgId);
  return users.map((u) => ({
    id: u.id,
    orgId: u.orgId,
    email: u.email,
    name: u.name,
    role: u.role,
    initials: initialsFor(u.name),
  }));
}
