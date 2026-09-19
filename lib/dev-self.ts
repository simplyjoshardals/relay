import { cookies } from "next/headers";
import { users } from "@/lib/mock-data";
import type { Role, User } from "@/types";

/**
 * Stand-in for real auth (README §5/§16, Milestone 1) until it lands.
 * There's no login yet, so "who am I" is a cookie holding a user id
 * instead of a real session — set either by /login (pick a person) or
 * DevRoleSwitcher (quick role flip while already "signed in").
 *
 * This is the one place that reads the cookie. Every Server Component
 * that needs "the signed-in user" should call getDevSelf() rather than
 * reaching into mock-data directly, so swapping this out for a real
 * session lookup later is a one-file change.
 */
export const DEV_SELF_COOKIE = "relay-dev-self-id";

const DEFAULT_ROLE: Role = "MANAGER";

// One representative mock user per role — DevRoleSwitcher picks a role,
// not an individual person, since which specific Member you're testing
// as doesn't matter for a permission-boundary check. /login picks a
// specific person from the full `users` list instead.
export const representativeByRole: Record<Role, User> = {
  MANAGER: users.find((u) => u.role === "MANAGER")!,
  MEMBER: users.find((u) => u.role === "MEMBER")!,
};

/**
 * Whether a (fake) session cookie is present and still points at a real
 * user — used only at the two entry gates (root page, dashboard layout)
 * to decide whether to send someone to /login. Deliberately does NOT
 * fall back to a default the way getDevSelf() does: a gate that always
 * resolves to "someone" would never actually require signing in.
 */
export async function hasDevSession(): Promise<boolean> {
  const store = await cookies();
  const id = store.get(DEV_SELF_COOKIE)?.value;
  return Boolean(id && users.some((u) => u.id === id));
}

/** Resolves "the signed-in user," defaulting to a Manager if the cookie
 *  is missing or stale. Safe to call from any already-gated dashboard
 *  page — the dashboard layout's hasDevSession() check is what actually
 *  enforces that a real choice was made upstream. */
export async function getDevSelf(): Promise<User> {
  const store = await cookies();
  const id = store.get(DEV_SELF_COOKIE)?.value;
  const match = id ? users.find((u) => u.id === id) : undefined;
  return match ?? representativeByRole[DEFAULT_ROLE];
}
