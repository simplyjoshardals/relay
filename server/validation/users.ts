import { z } from "zod";

/**
 * §11: single source of truth for team-management input, same role as
 * server/validation/tickets.ts/services.ts. `TeamInviteModal` runs the
 * invite schema (server/validation/invitations.ts) through `.safeParse()`
 * on submit per the resolved React-Hook-Form decision in
 * BACKEND_ROADMAP.md; the role-change control is a single `<select>`, so
 * it has nothing to validate client-side beyond the enum itself.
 *
 * Deactivation has no schema: it takes only the target user's id, which
 * is a URL/argument parameter rather than a body — the application layer
 * looks it up org-scoped, so a malformed or foreign id is just "not
 * found".
 */

export const roleSchema = z.enum(["MEMBER", "MANAGER"]);

export const updateMemberRoleInputSchema = z.object({
  role: roleSchema,
});

export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleInputSchema>;
