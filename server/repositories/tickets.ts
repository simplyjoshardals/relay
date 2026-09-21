import { prisma } from "@/lib/prisma";
import type { TicketPriority, TicketStatus } from "@/types";

export async function findTicketsForOrg(orgId: string) {
  return prisma.ticket.findMany({
    where: { orgId },
    orderBy: { updatedAt: "desc" },
  });
}

export async function findTicketById(orgId: string, id: string) {
  return prisma.ticket.findFirst({ where: { id, orgId } });
}

export interface CreateTicketData {
  title: string;
  description: string;
  priority: TicketPriority;
  assigneeId: string | null;
  creatorId: string;
}

export async function createTicket(orgId: string, data: CreateTicketData) {
  return prisma.ticket.create({ data: { ...data, orgId } });
}

export interface TicketUpdateFields {
  title?: string;
  description?: string;
  status?: TicketStatus;
  priority?: TicketPriority;
  assigneeId?: string | null;
}

/**
 * §8's conditional update, via Prisma: `updateMany` (not `update`, which
 * only accepts a unique where-clause) so `version` can sit in the where
 * clause alongside `id`/`orgId`. `count === 0` means either the row
 * didn't exist in this org, or — the case that actually matters here —
 * `expectedVersion` was stale, i.e. someone else's write already moved
 * it. Prisma's `{ increment: 1 }` compiles to the same atomic
 * `version = version + 1` the README's raw SQL shows; `updatedAt` is
 * `@updatedAt` in the schema, so Prisma sets it automatically.
 *
 * Returning the bare count (not throwing here) is deliberate — deciding
 * that zero rows means a conflict, specifically, is what the calling
 * use-case in server/application/tickets.ts does. This function only
 * knows "how many rows changed," not what that means.
 */
export async function updateTicketConditional(
  orgId: string,
  id: string,
  expectedVersion: number,
  fields: TicketUpdateFields,
) {
  return prisma.ticket.updateMany({
    where: { id, orgId, version: expectedVersion },
    data: { ...fields, version: { increment: 1 } },
  });
}
