import { prisma } from "@/lib/prisma";
import { Prisma } from "@/lib/generated/prisma/client";
import type { IncidentSeverity, IncidentStatus } from "@/types";

/**
 * `incidentServices` is the full membership (§8.2: a plain many-to-many,
 * nothing to filter). `incidentTickets` only pulls the *active* link per
 * ticket (§8.1: a ticket may have many historical incident links, but
 * `types/index.ts#Incident.ticketIds` is documented as "active links
 * only") — resolved incidents keep their historical rows in the table,
 * they just stop showing up here.
 */
const includeLinks = {
  incidentServices: { select: { serviceId: true } },
  incidentTickets: {
    where: { isActive: true },
    select: { ticketId: true },
  },
} as const;

type IncidentWithLinks = Prisma.IncidentGetPayload<{
  include: typeof includeLinks;
}>;

/** Flattens Prisma's nested join rows into the `serviceIds`/`ticketIds`
 *  arrays server/application/incidents.ts#toClientShape expects — kept
 *  here (not in the application layer) since it's purely a reshaping of
 *  what Prisma returned, no business decision involved. */
export function withLinkIds(incident: IncidentWithLinks) {
  const { incidentServices, incidentTickets, ...fields } = incident;
  return {
    ...fields,
    serviceIds: incidentServices.map((link) => link.serviceId),
    ticketIds: incidentTickets.map((link) => link.ticketId),
  };
}

export async function findIncidentsForOrg(orgId: string) {
  const incidents = await prisma.incident.findMany({
    where: { orgId },
    include: includeLinks,
    orderBy: { createdAt: "desc" },
  });
  return incidents.map(withLinkIds);
}

export async function findIncidentById(orgId: string, id: string) {
  const incident = await prisma.incident.findFirst({
    where: { id, orgId },
    include: includeLinks,
  });
  return incident ? withLinkIds(incident) : null;
}

export interface CreateIncidentData {
  title: string;
  description: string;
  status: IncidentStatus;
  severity: IncidentSeverity;
  responderId: string | null;
  resolvedAt: Date | null;
  serviceIds: string[];
  ticketIds: string[];
}

/**
 * Creates the incident row plus its initial links in one transaction —
 * IN-02 requires at least the create-time service selection to land
 * atomically with the incident itself, not as a separate step that
 * could leave an incident with no recorded impact if it failed midway.
 *
 * Services use `createMany`/`skipDuplicates` (§8.2's plain many-to-many,
 * nothing can conflict here beyond an accidental duplicate id in the
 * input). Tickets are inserted one at a time instead: a brand-new
 * incident's id can't collide with itself on the `(incidentId,
 * ticketId)` primary key, so the only thing that CAN fail here is §2's
 * partial unique index (`one_active_incident_per_ticket`) — a ticket the
 * caller tried to link that's already actively linked to a *different*
 * incident. Looping keeps that failure attributable to the specific
 * ticket that caused it (surfaced via isTicketAlreadyLinkedConflict
 * below) rather than an opaque batch rejection, and throwing inside the
 * transaction rolls the whole create back — an incident should never
 * exist half-linked because one of several requested tickets lost the
 * race.
 */
export async function createIncident(orgId: string, data: CreateIncidentData) {
  const { serviceIds, ticketIds, ...fields } = data;

  const incident = await prisma.$transaction(async (tx) => {
    const created = await tx.incident.create({ data: { ...fields, orgId } });

    if (serviceIds.length > 0) {
      await tx.incidentService.createMany({
        data: serviceIds.map((serviceId) => ({
          orgId,
          incidentId: created.id,
          serviceId,
        })),
        skipDuplicates: true,
      });
    }

    for (const ticketId of ticketIds) {
      await tx.incidentTicket.create({
        data: { orgId, incidentId: created.id, ticketId, isActive: true },
      });
    }

    return tx.incident.findUniqueOrThrow({
      where: { id: created.id },
      include: includeLinks,
    });
  });

  return withLinkIds(incident);
}

export interface IncidentUpdateFields {
  title?: string;
  description?: string;
  status?: IncidentStatus;
  severity?: IncidentSeverity;
  responderId?: string | null;
  resolvedAt?: Date | null;
}

async function syncIncidentServices(
  tx: Prisma.TransactionClient,
  orgId: string,
  incidentId: string,
  serviceIds: string[],
) {
  const current = await tx.incidentService.findMany({
    where: { orgId, incidentId },
    select: { serviceId: true },
  });
  const currentSet = new Set(current.map((row) => row.serviceId));
  const nextSet = new Set(serviceIds);

  const toRemove = [...currentSet].filter((id) => !nextSet.has(id));
  const toAdd = serviceIds.filter((id) => !currentSet.has(id));

  if (toRemove.length > 0) {
    await tx.incidentService.deleteMany({
      where: { orgId, incidentId, serviceId: { in: toRemove } },
    });
  }

  if (toAdd.length > 0) {
    await tx.incidentService.createMany({
      data: toAdd.map((serviceId) => ({ orgId, incidentId, serviceId })),
      skipDuplicates: true,
    });
  }
}

async function syncIncidentTickets(
  tx: Prisma.TransactionClient,
  orgId: string,
  incidentId: string,
  ticketIds: string[],
) {
  const current = await tx.incidentTicket.findMany({
    where: { orgId, incidentId, isActive: true },
    select: { ticketId: true },
  });
  const currentSet = new Set(current.map((row) => row.ticketId));
  const nextSet = new Set(ticketIds);

  const toUnlink = [...currentSet].filter((id) => !nextSet.has(id));
  const toLink = ticketIds.filter((id) => !currentSet.has(id));

  if (toUnlink.length > 0) {
    await tx.incidentTicket.updateMany({
      where: { orgId, incidentId, ticketId: { in: toUnlink }, isActive: true },
      data: { isActive: false, unlinkedAt: new Date() },
    });
  }

  // One upsert per ticket, not createMany: the `(incidentId, ticketId)`
  // pair may already exist as an *inactive* row (this exact ticket was
  // linked to this exact incident before, then unlinked) — relinking
  // that needs an UPDATE, not an INSERT, or it would collide with its
  // own primary key. Upsert handles both that case and the true-first-
  // time-link case in one call. The partial unique index
  // (`one_active_incident_per_ticket`, scoped to `ticket_id` alone,
  // across every incident) is the thing that can still reject this: a
  // ticket already actively linked to a *different* incident. That
  // surfaces as a Postgres unique-violation on this upsert, which
  // isTicketAlreadyLinkedConflict below recognizes so the application
  // layer can turn it into a specific, attributable error instead of a
  // generic failure.
  for (const ticketId of toLink) {
    await tx.incidentTicket.upsert({
      where: { incidentId_ticketId: { incidentId, ticketId } },
      create: { orgId, incidentId, ticketId, isActive: true },
      update: { isActive: true, linkedAt: new Date(), unlinkedAt: null },
    });
  }
}

/**
 * §8's conditional update, extended to also sync the two link tables —
 * wrapped in one transaction so a stale-version rejection (count === 0)
 * never touches links at all, and so a partial-unique-index conflict on
 * one ticket rolls back any service/ticket changes already applied in
 * the same edit rather than leaving the incident half-updated.
 *
 * `serviceIds`/`ticketIds` are only synced when the caller explicitly
 * provides them (`undefined` means "don't touch links") — same
 * optionality as the scalar fields, so a future partial-update caller
 * (e.g. a bulk severity change) isn't forced to also resend the full
 * membership list.
 */
export async function updateIncidentConditional(
  orgId: string,
  id: string,
  expectedVersion: number,
  fields: IncidentUpdateFields,
  links: { serviceIds?: string[]; ticketIds?: string[] } = {},
) {
  return prisma.$transaction(async (tx) => {
    const result = await tx.incident.updateMany({
      where: { id, orgId, version: expectedVersion },
      data: { ...fields, version: { increment: 1 } },
    });

    if (result.count === 0) {
      return { count: 0 };
    }

    if (links.serviceIds !== undefined) {
      await syncIncidentServices(tx, orgId, id, links.serviceIds);
    }
    if (links.ticketIds !== undefined) {
      await syncIncidentTickets(tx, orgId, id, links.ticketIds);
    }

    return { count: 1 };
  });
}

/**
 * True for the one Postgres error `createIncident`/`updateIncidentConditional`
 * can raise beyond an ordinary connection failure: a P2002 unique-
 * violation while inserting/upserting an `incident_tickets` row. Every
 * insert into that table in this file either targets a brand-new
 * incident id (createIncident — can't collide with itself) or goes
 * through `upsert` keyed on the exact primary key (syncIncidentTickets —
 * can't collide there either), so the only remaining unique constraint
 * that can fire is the partial index (`one_active_incident_per_ticket`).
 * That makes any P2002 surfacing from these two functions attributable
 * to that index without needing to parse `error.meta.target` (which
 * Postgres/Prisma reports inconsistently for partial indexes created via
 * raw migration SQL rather than a plain `@@unique`).
 */
export function isTicketAlreadyLinkedConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}
