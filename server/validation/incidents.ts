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

/**
 * A deliberately loose id shape check — 8-4-4-4-12 hex-dash, not
 * `z.string().uuid()`'s strict RFC4122 pattern. prisma/seed.ts's fixed
 * ids (e.g. `00000000-0000-0000-0000-000000000101` for the seeded
 * "Payments API" service) are syntactically valid hex-dash strings but
 * not RFC4122-compliant — their version nibble is `0`, not `1`–`5` —
 * so the strict check rejects a real, existing service the moment a
 * client links to it. This schema's job is catching malformed input
 * before it reaches the DB, not re-deriving Postgres's own uuid type
 * constraint; genuine non-existence/cross-org references still get
 * caught downstream — the FK constraint on `incident_services`/
 * `incident_tickets`, and `assertResponderInOrg`'s explicit lookup for
 * `responderId`.
 */
const uuid = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    "Invalid id",
  );

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
