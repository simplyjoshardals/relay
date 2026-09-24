import { z } from "zod";
import { roleSchema } from "@/server/validation/users";

/**
 * Same single-source-of-truth role as the other validation modules
 * (§11). `inviteMemberInputSchema` is also what `TeamInviteModal` runs
 * through `.safeParse()` on submit.
 */

/** Trimmed and lower-cased *before* the format check, so what gets stored
 *  (and later compared against existing members) has one canonical form —
 *  `Jane@Acme.com` and `jane@acme.com` are the same person. */
const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ message: "Enter a valid email" }));

const nameSchema = z
  .string()
  .trim()
  .min(1, "Name is required")
  .max(100, "Name is too long");

export const inviteMemberInputSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  role: roleSchema,
});

export type InviteMemberInput = z.infer<typeof inviteMemberInputSchema>;

/** Password bounds: the floor is a basic sanity check, not a strength
 *  policy; the ceiling only exists so scrypt isn't handed an arbitrarily
 *  large input. */
export const acceptInvitationInputSchema = z
  .object({
    token: z.string().min(1, "This invitation link is invalid."),
    name: nameSchema,
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(128, "Password is too long"),
    confirmPassword: z.string(),
  })
  .refine((input) => input.password === input.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export type AcceptInvitationInput = z.infer<typeof acceptInvitationInputSchema>;
