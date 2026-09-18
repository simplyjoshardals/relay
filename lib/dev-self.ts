import { cookies } from "next/headers";
import { users } from "@/lib/mock-data";
import type { Role, User } from "@/types";

/**
 * Stand-in for real auth (README §5/§16, Milestone 1) until it lands.
 * There's no login yet, so "who am I" is a dev-only toggle stored in a
 * cookie instead of a session — see DevRoleSwitcher and setDevRoleAction.
 *
 * This is the one place that reads the cookie. Every Server Component
 * that needs "the signed-in user" should call getDevSelf() rather than
 * reaching into mock-data directly, so swapping this out for a real
 * session lookup later is a one-file change.
 */
export const DEV_ROLE_COOKIE = "relay-dev-role";

const DEFAULT_ROLE: Role = "MANAGER";

// One representative mock user per role — the switcher picks a role, not
// an individual person, since which specific Member you're "logged in
// as" doesn't matter for testing a permission boundary.
const representativeByRole: Record<Role, User> = {
  MANAGER: users.find((u) => u.role === "MANAGER")!,
  MEMBER: users.find((u) => u.role === "MEMBER")!,
};

export async function getDevSelf(): Promise<User> {
  const store = await cookies();
  const cookieValue = store.get(DEV_ROLE_COOKIE)?.value;
  const role: Role = cookieValue === "MEMBER" ? "MEMBER" : DEFAULT_ROLE;
  return representativeByRole[role];
}
