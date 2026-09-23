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
import { findTicketById } from "@/server/repositories/tickets";
import { findUserById } from "@/server/repositories/users";
import { recordActivity } from "@/server/application/activities";
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

/** `next.filter(id => !current.includes(id))` / the reverse, named for
 *  readability at the two call sites below (service links, ticket
 *  links) — both need the same "what got added, what got removed"
 *  shape to decide which LINKED/UNLINKED Activity rows to write. */
function diffIds(
  current: string[],
  next: string[],
): { added: string[]; removed: string[] } {
  const currentSet = new Set(current);
  const nextSet = new Set(next);
  return {
    added: next.filter((id) => !currentSet.has(id)),
    removed: current.filter((id) => !nextSet.has(id)),
  };
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

  // AC-01/IN-01: one INCIDENT_CREATED covers the whole creation — no
  // INCIDENT_SERVICE_LINKED/INCIDENT_TICKET_LINKED for services/tickets
  // attached at creation time, same reasoning createTicket
  // (server/application/tickets.ts) gives for not emitting a separate
  // TICKET_ASSIGNED when a ticket is created with an assignee already
  // set: LINKED/UNLINKED describe a *change* to an existing incident's
  // membership, not its starting state.
  await recordActivity(session.orgId, {
    actorId: session.sub,
    action: "INCIDENT_CREATED",
    targetType: "incident",
    targetId: incident.id,
    metadata: { title: incident.title },
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

  // Milestone 6: same "diff against `existing`, not just `fields !==
  // undefined`" reasoning as updateTicket (server/application/
  // tickets.ts) — IncidentModal resubmits every field on every save, so
  // presence in `fields` doesn't mean the value actually changed.
  //
  // Status is checked first and specifically for RESOLVED, because the
  // schema models resolution as its own Activity action rather than a
  // flavor of INCIDENT_STATUS_CHANGED (ActivityDescription.tsx renders
  // INCIDENT_RESOLVED headline-style — "resolved 'X'" — not as a
  // {from,to} transition) — IN-09 calls out "resolving" as distinct
  // from "updating" for the same reason. Reopening a resolved incident
  // (RESOLVED → anything else) goes back through the ordinary
  // STATUS_CHANGED path; there's no INCIDENT_REOPENED action in the
  // schema.
  if (fields.status !== undefined && fields.status !== existing.status) {
    if (fields.status === "RESOLVED") {
      await recordActivity(session.orgId, {
        actorId: session.sub,
        action: "INCIDENT_RESOLVED",
        targetType: "incident",
        targetId: incidentId,
        metadata: { title: updated.title },
      });
    } else {
      await recordActivity(session.orgId, {
        actorId: session.sub,
        action: "INCIDENT_STATUS_CHANGED",
        targetType: "incident",
        targetId: incidentId,
        metadata: { from: existing.status, to: fields.status },
      });
    }
  }

  if (fields.severity !== undefined && fields.severity !== existing.severity) {
    await recordActivity(session.orgId, {
      actorId: session.sub,
      action: "INCIDENT_SEVERITY_CHANGED",
      targetType: "incident",
      targetId: incidentId,
      metadata: { from: existing.severity, to: fields.severity },
    });
  }

  // No INCIDENT_RESPONDER_ASSIGNED here — unlike tickets, the schema's
  // ActivityAction enum has no action for an incident's responder
  // changing (only INCIDENT_CREATED/STATUS_CHANGED/SEVERITY_CHANGED/
  // SERVICE_(UN)LINKED/TICKET_(UN)LINKED/RESOLVED — see
  // prisma/schema.prisma). Adding one would mean a migration, which is
  // out of scope for a retrofit milestone; flagged in
  // BACKEND_ROADMAP.md rather than silently working around it with an
  // existing action that doesn't really fit.

  // §8.2: services are a plain many-to-many, so every added/removed id
  // gets its own row — ActivityDescription doesn't name the service
  // (`linked a service to this incident`), so `serviceId` in metadata
  // is for the audit trail (AC-02: target/actor/timestamp is the
  // minimum, this is extra), not for display.
  if (serviceIds !== undefined) {
    const { added, removed } = diffIds(existing.serviceIds, serviceIds);

    for (const serviceId of added) {
      await recordActivity(session.orgId, {
        actorId: session.sub,
        action: "INCIDENT_SERVICE_LINKED",
        targetType: "incident",
        targetId: incidentId,
        metadata: { serviceId },
      });
    }
    for (const serviceId of removed) {
      await recordActivity(session.orgId, {
        actorId: session.sub,
        action: "INCIDENT_SERVICE_UNLINKED",
        targetType: "incident",
        targetId: incidentId,
        metadata: { serviceId },
      });
    }
  }

  // §8.1: tickets diff the same way, but INCIDENT_TICKET_LINKED's
  // metadata *is* displayed (`linked "{ticketTitle}"`) — the one lookup
  // in this file that isn't already available from `existing`/`fields`,
  // so it only runs for tickets actually being added, not the (more
  // common) unlink case.
  if (ticketIds !== undefined) {
    const { added, removed } = diffIds(existing.ticketIds, ticketIds);

    for (const ticketId of added) {
      const ticket = await findTicketById(session.orgId, ticketId);
      await recordActivity(session.orgId, {
        actorId: session.sub,
        action: "INCIDENT_TICKET_LINKED",
        targetType: "incident",
        targetId: incidentId,
        metadata: { ticketId, ticketTitle: ticket?.title ?? "a ticket" },
      });
    }
    for (const ticketId of removed) {
      await recordActivity(session.orgId, {
        actorId: session.sub,
        action: "INCIDENT_TICKET_UNLINKED",
        targetType: "incident",
        targetId: incidentId,
        metadata: { ticketId },
      });
    }
  }

  return toClientShape(updated);
}
