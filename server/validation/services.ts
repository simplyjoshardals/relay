import { z } from "zod";

/**
 * §11: single source of truth for "is this input valid," mirroring
 * server/validation/tickets.ts. Only the catalog fields a human actually
 * edits (name/description, plus archived/restore) appear here — status,
 * latencyMs, and errorRate are telemetry-owned (README §13) and never
 * come from a client-submitted form, so there's no schema field for them
 * at all; updateServiceTelemetry (server/application/services.ts) takes
 * those as plain function arguments from the worker, not parsed input.
 *
 * Same resolved decision as tickets applies here: ServiceModal keeps its
 * `useState` form and runs this through `.safeParse()` on submit rather
 * than adopting React Hook Form.
 */

export const createServiceInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  description: z.string().trim().default(""),
});

export type CreateServiceInput = z.infer<typeof createServiceInputSchema>;

export const updateServiceInputSchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    name: z.string().trim().min(1, "Name is required").optional(),
    description: z.string().trim().optional(),
    /** Archive/restore (README §19) travels through this same
     *  version-checked update rather than a separate endpoint — same
     *  reasoning updateTicketInputSchema documents for status/priority. */
    archived: z.boolean().optional(),
  })
  .refine(
    (input) =>
      input.name !== undefined ||
      input.description !== undefined ||
      input.archived !== undefined,
    { message: "At least one field must change." },
  );

export type UpdateServiceInput = z.infer<typeof updateServiceInputSchema>;
