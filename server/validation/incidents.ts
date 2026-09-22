import { z } from "zod";
import {
  INCIDENT_SEVERITIES,
  INCIDENT_STATUSES,
} from "@/server/domain/incident";

/**
 * §11: single source of truth for "is this input valid," same role as
 * server/validation/tickets.ts and services.ts. Per the resolved
 * decision in BACKEND_ROADMAP.md, IncidentModal keeps its `useState`
 * form and runs this through `.safeParse()` on submit rather than
 * adopting React Hook Form.
 *
 * Unlike TicketModal (status only shown in edit mode) and ServiceModal
 * (status never human-editable at all), IncidentModal shows a status
 * field in *both* create and edit mode — README's IN-01..IN-07 don't
 * distinguish "create with a status" from "create then immediately
 * change it," and the existing UI already lets a Manager open an
 * incident straight into IDENTIFIED if that's where it actually starts
 * (e.g. logging one after the fact). So `status` is accepted on create
 * too, defaulting to INVESTIGATING.
 *
 * `serviceIds`/`ticketIds` are the *desired full membership*, not a
 * delta — IncidentModal's checklists are checkbox state (§8.2's
 * incident↔service is a plain many-to-many; §8.1's incident↔ticket is
 * the one with the partial-unique-index constraint), so the server
 * diffs against current linkage itself
 * (server/repositories/incidents.ts#syncIncidentServices/
 * syncIncidentTickets) rather than the client computing an add/remove
 * list.
 */

const uuid = z.string().uuid();

export const createIncidentInputSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  description: z.string().trim().default(""),
  status: z.enum(INCIDENT_STATUSES).default("INVESTIGATING"),
  severity: z.enum(INCIDENT_SEVERITIES).default("MEDIUM"),
  responderId: uuid.nullable().optional(),
  serviceIds: z.array(uuid).default([]),
  ticketIds: z.array(uuid).default([]),
});

export type CreateIncidentInput = z.infer<typeof createIncidentInputSchema>;

export const updateIncidentInputSchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    title: z.string().trim().min(1, "Title is required").optional(),
    description: z.string().trim().optional(),
    status: z.enum(INCIDENT_STATUSES).optional(),
    severity: z.enum(INCIDENT_SEVERITIES).optional(),
    responderId: uuid.nullable().optional(),
    serviceIds: z.array(uuid).optional(),
    ticketIds: z.array(uuid).optional(),
  })
  .refine(
    (input) =>
      input.title !== undefined ||
      input.description !== undefined ||
      input.status !== undefined ||
      input.severity !== undefined ||
      input.responderId !== undefined ||
      input.serviceIds !== undefined ||
      input.ticketIds !== undefined,
    { message: "At least one field must change." },
  );

export type UpdateIncidentInput = z.infer<typeof updateIncidentInputSchema>;
