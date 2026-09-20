import { z } from "zod";

/**
 * README §11: Zod schemas are the single source of truth for "is this
 * input valid," checked server-side before anything reaches application
 * logic. Per the resolved decision in BACKEND_ROADMAP.md, the client
 * doesn't get its own React Hook Form + zodResolver wiring — the login
 * form's own `useState` runs this same schema through `.safeParse()` on
 * submit, so there's still exactly one definition of "a valid login",
 * just without RHF's form-state machinery on top.
 */
export const loginInputSchema = z.object({
  email: z.email({ message: "Enter a valid email" }),
  password: z.string().min(1, "Password is required"),
});

export type LoginInput = z.infer<typeof loginInputSchema>;
