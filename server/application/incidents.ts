import type { Incident } from "@/types";
import type { AccessTokenClaims } from "@/server/auth/jwt";
import {
  createIncidentInputSchema,
  updateIncidentInputSchema,
} from "@/server/validation/incidents";
import {
  createIncident as createIncidentRow,
  findIncidentById,
  findIncidentsForOrg,
  isTicketAlreadyLinkedConflict,
  updateIncidentConditional,
} from "@/server/repositories/incidents";
import { findUserById } from "@/server/repositories/users";
import {
  ConflictError,
  NotFoundError,
  TicketAlreadyLinkedError,
  ValidationError,
} from "@/server/application/errors";
import { broadcastToOrg } from "@/server/realtime/broadcast";

function toClientShape(incident: {
  id: string;
  orgId: string;
  title: string;
  description: string;
  status: string;
  severity: string;
  responderId: string | null;
  createdAt: Date;
  resolvedAt: Date | null;
  version: number;
  serviceIds: string[];
  ticketIds: string[];
}): Incident {
  return {
    id: incident.id,
    orgId: incident.orgId,
    title: incident.title,
    description: incident.description,
    status: incident.status as Incident["status"],
    severity: incident.severity as Incident["severity"],
    responderId: incident.responderId,
    createdAt: incident.createdAt.toISOString(),
    resolvedAt: incident.resolvedAt ? incident.resolvedAt.toISOString() : null,
    version: incident.version,
    serviceIds: incident.serviceIds,
    ticketIds: incident.ticketIds,
  };
}

/** IN-01..IN-07's view. Org-scoped via the verified session, same as
 *  listTickets/listServices — never a client-supplied org id (§3, Layer
 *  1). Resolved incidents are included; IncidentsView sorts them to the
 *  bottom rather than the query filtering them out, same split of
 *  responsibility the ticket/service lists use for their own filters. */
export async function listIncidents(
  session: AccessTokenClaims,
): Promise<Incident[]> {
  const incidents = await findIncidentsForOrg(session.orgId);
  return incidents.map(toClientShape);
}

/**
 * Verifies a referenced user actually belongs to this org before an
 * incident can point at them as responder — same reasoning
 * server/application/tickets.ts#assertAssigneeInOrg documents for
 * ticket assignees. Shared by create and update below.
 */
async function assertResponderInOrg(orgId: string, responderId: string | null) {
  if (responderId === null) return;
  const user = await findUserById(orgId, responderId);
  if (!user) {
    throw new NotFoundError("Responder not found in this organization.");
  }
}

/** resolvedAt (IN-07) tracks status the same way IncidentModal's
 *  client-side draft used to before this had a backend: set the instant
 *  status first becomes RESOLVED, keep the original timestamp if it was
 *  already resolved, clear it if reopened. Centralized here so create
 *  and update compute it identically rather than each re-deriving it. */
function resolvedAtFor(
  status: Incident["status"],
  previousStatus: Incident["status"] | null,
  previousResolvedAt: Date | null,
): Date | null {
  if (status !== "RESOLVED") return null;
  if (previousStatus === "RESOLVED") return previousResolvedAt;
  return new Date();
}

/**
 * Turns the one Postgres-level conflict this domain can raise beyond an
 * ordinary version mismatch (§2's partial unique index, surfaced via
 * server/repositories/incidents.ts#isTicketAlreadyLinkedConflict) into
 * the typed error the Server Action boundary knows how to map
 * (TicketAlreadyLinkedError → "ticket_conflict"). Shared by create and
 * update below since both can hit it.
 */
function rethrowTicketConflict(error: unknown): never {
  if (isTicketAlreadyLinkedConflict(error)) {
    throw new TicketAlreadyLinkedError();
  }
  throw error;
}

/** IN-01: create. */
export async function createIncident(
  session: AccessTokenClaims,
  input: unknown,
): Promise<Incident> {
  const parsed = createIncidentInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError(
      parsed.error.issues[0]?.message ?? "Invalid input.",
    );
  }

  const responderId = parsed.data.responderId ?? null;
  await assertResponderInOrg(session.orgId, responderId);

  const resolvedAt = resolvedAtFor(parsed.data.status, null, null);

  let incident;
  try {
    incident = await createIncidentRow(session.orgId, {
      title: parsed.data.title,
      description: parsed.data.description,
      status: parsed.data.status,
      severity: parsed.data.severity,
      responderId,
      resolvedAt,
      serviceIds: parsed.data.serviceIds,
      ticketIds: parsed.data.ticketIds,
    });
  } catch (error) {
    rethrowTicketConflict(error);
  }

  // §6's invalidation-hint convention, same event name shape as
  // ticket.updated/service.updated — one event covers both creates and
  // updates for this resource too, per §7's mapping.
  await broadcastToOrg(session.orgId, "incident.updated", {
    id: incident.id,
    orgId: session.orgId,
  });

  return toClientShape(incident);
}

/**
 * IN-04/05/06/07 (responder, status, severity, resolution) plus
 * title/description and the service/ticket link checklists, all through
 * one version-checked update — same reasoning
 * server/application/tickets.ts#updateTicket documents for folding its
 * several user-facing capabilities into one use-case.
 *
 * `serviceIds`/`ticketIds` are only synced when present in the input
 * (server/repositories/incidents.ts#updateIncidentConditional): IncidentModal
 * always sends both (its checklists are full desired-state checkbox
 * lists), but a narrower future caller — a "resolve" button that only
 * touches status — isn't forced to resend the full membership.
 */
export async function updateIncident(
  session: AccessTokenClaims,
  incidentId: string,
  input: unknown,
): Promise<Incident> {
  const parsed = updateIncidentInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError(
      parsed.error.issues[0]?.message ?? "Invalid input.",
    );
  }

  const existing = await findIncidentById(session.orgId, incidentId);
  if (!existing) {
    throw new NotFoundError("Incident not found.");
  }

  if (parsed.data.responderId !== undefined) {
    await assertResponderInOrg(session.orgId, parsed.data.responderId);
  }

  const { expectedVersion, serviceIds, ticketIds, ...fields } = parsed.data;

  const resolvedAt =
    fields.status !== undefined
      ? resolvedAtFor(
          fields.status,
          existing.status as Incident["status"],
          existing.resolvedAt,
        )
      : undefined;

  let result;
  try {
    result = await updateIncidentConditional(
      session.orgId,
      incidentId,
      expectedVersion,
      { ...fields, ...(resolvedAt !== undefined ? { resolvedAt } : {}) },
      { serviceIds, ticketIds },
    );
  } catch (error) {
    rethrowTicketConflict(error);
  }

  if (result.count === 0) {
    throw new ConflictError(
      "This incident was changed by someone else. Refresh and try again.",
    );
  }

  const updated = await findIncidentById(session.orgId, incidentId);
  if (!updated) {
    // Genuinely shouldn't happen — the row we just updated vanished
    // between the update and this refetch.
    throw new NotFoundError("Incident not found.");
  }

  await broadcastToOrg(session.orgId, "incident.updated", {
    id: updated.id,
    orgId: session.orgId,
  });

  return toClientShape(updated);
}