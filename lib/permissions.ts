import type { Role } from "@/types";

/**
 * Single source of truth for role-gated capabilities (RELAY_README.md §3).
 *
 * Resolved for MVP (see ROADMAP_ROLES.md): only two capabilities are
 * actually split by role. Everything else — tickets, incidents, activity
 * (including full history), presence, the dashboard itself — is identical
 * for Member and Manager, so it needs no permission check at all; any
 * authenticated org member can do it.
 *
 * Every role check in the app should call one of these rather than
 * comparing `role === "MANAGER"` inline, so there's exactly one place to
 * update if a boundary ever changes.
 */

export function canManageServices(role: Role): boolean {
  return role === "MANAGER";
}

export function canManageTeam(role: Role): boolean {
  return role === "MANAGER";
}
