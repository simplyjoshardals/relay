import { z } from "zod";
import { TICKET_PRIORITIES, TICKET_STATUSES } from "@/server/domain/ticket";

/**
 * §11: the single source of truth for "is this input valid," checked
 * here before anything reaches application logic. Per the resolved
 * decision in BACKEND_ROADMAP.md, the client doesn't get React Hook
 * Form + zodResolver — TicketModal's existing `useState`-based form
 * runs this same schema through `.safeParse()` on submit instead, so
 * there's still exactly one definition of "a valid ticket."
 */

const uuid = z.string().uuid();

export const createTicketInputSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  description: z.string().trim().default(""),
  priority: z.enum(TICKET_PRIORITIES).default("MEDIUM"),
  assigneeId: uuid.nullable().optional(),
});

export type CreateTicketInput = z.infer<typeof createTicketInputSchema>;

export const updateTicketInputSchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    title: z.string().trim().min(1, "Title is required").optional(),
    description: z.string().trim().optional(),
    status: z.enum(TICKET_STATUSES).optional(),
    priority: z.enum(TICKET_PRIORITIES).optional(),
    assigneeId: uuid.nullable().optional(),
  })
  .refine(
    (input) =>
      input.title !== undefined ||
      input.description !== undefined ||
      input.status !== undefined ||
      input.priority !== undefined ||
      input.assigneeId !== undefined,
    { message: "At least one field must change." },
  );

export type UpdateTicketInput = z.infer<typeof updateTicketInputSchema>;