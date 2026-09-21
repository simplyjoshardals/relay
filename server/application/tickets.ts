import type { Ticket } from "@/types";
import type { AccessTokenClaims } from "@/server/auth/jwt";
import {
  createTicketInputSchema,
  updateTicketInputSchema,
} from "@/server/validation/tickets";
import {
  createTicket as createTicketRow,
  findTicketById,
  findTicketsForOrg,
  updateTicketConditional,
} from "@/server/repositories/tickets";
import { findUserById } from "@/server/repositories/users";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "@/server/application/errors";
import { broadcastToOrg } from "@/server/realtime/broadcast";

function toClientShape(ticket: {
  id: string;
  orgId: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  assigneeId: string | null;
  creatorId: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}): Ticket {
  return {
    id: ticket.id,
    orgId: ticket.orgId,
    title: ticket.title,
    description: ticket.description,
    status: ticket.status as Ticket["status"],
    priority: ticket.priority as Ticket["priority"],
    assigneeId: ticket.assigneeId,
    creatorId: ticket.creatorId,
    version: ticket.version,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
  };
}

/** WR-05: view. Org-scoped via the verified session — never a
 *  client-supplied org id (§3, Layer 1). */
export async function listTickets(
  session: AccessTokenClaims,
): Promise<Ticket[]> {
  const tickets = await findTicketsForOrg(session.orgId);
  return tickets.map(toClientShape);
}

/**
 * Verifies a referenced user actually belongs to this org before a
 * ticket can point at them — assigning to a user id from a different
 * org (or one that doesn't exist) would otherwise silently corrupt the
 * ticket's assignee reference. Shared by create and update below.
 */
async function assertAssigneeInOrg(orgId: string, assigneeId: string | null) {
  if (assigneeId === null) return;
  const user = await findUserById(orgId, assigneeId);
  if (!user) {
    throw new NotFoundError("Assignee not found in this organization.");
  }
}

/** WR-01: create. */
export async function createTicket(
  session: AccessTokenClaims,
  input: unknown,
): Promise<Ticket> {
  const parsed = createTicketInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError(
      parsed.error.issues[0]?.message ?? "Invalid input.",
    );
  }

  const assigneeId = parsed.data.assigneeId ?? null;
  await assertAssigneeInOrg(session.orgId, assigneeId);

  const ticket = await createTicketRow(session.orgId, {
    title: parsed.data.title,
    description: parsed.data.description,
    priority: parsed.data.priority,
    assigneeId,
    creatorId: session.sub,
  });

  // §6's example event name is 'ticket.updated' for both creates and
  // updates — there's no separate 'ticket.created' event in spec, so
  // this uses the same one rather than inventing a variant. The payload
  // is deliberately just the id — an invalidation hint, not the ticket
  // itself (RT-06).
  await broadcastToOrg(session.orgId, "ticket.updated", {
    id: ticket.id,
    orgId: session.orgId,
  });

  return toClientShape(ticket);
}

/**
 * WR-02/03/04 (assign, status, priority) plus title/description, all
 * through one version-checked update rather than four near-identical
 * use-cases — see BACKEND_ROADMAP.md's Milestone 2 notes for why: the
 * README frames these as separate user-facing capabilities, not
 * necessarily separate endpoints, and the one place that distinction
 * would matter (Activity needing to know *which* field changed to pick
 * TICKET_ASSIGNED vs. TICKET_STATUS_CHANGED) isn't wired up until
 * Milestone 6 — which can inspect this same diff then.
 */
export async function updateTicket(
  session: AccessTokenClaims,
  ticketId: string,
  input: unknown,
): Promise<Ticket> {
  const parsed = updateTicketInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError(
      parsed.error.issues[0]?.message ?? "Invalid input.",
    );
  }

  const existing = await findTicketById(session.orgId, ticketId);
  if (!existing) {
    throw new NotFoundError("Ticket not found.");
  }

  if (parsed.data.assigneeId !== undefined) {
    await assertAssigneeInOrg(session.orgId, parsed.data.assigneeId);
  }

  const { expectedVersion, ...fields } = parsed.data;

  const result = await updateTicketConditional(
    session.orgId,
    ticketId,
    expectedVersion,
    fields,
  );

  if (result.count === 0) {
    throw new ConflictError(
      "This ticket was changed by someone else. Refresh and try again.",
    );
  }

  const updated = await findTicketById(session.orgId, ticketId);
  if (!updated) {
    // Genuinely shouldn't happen — the row we just updated vanished
    // between the update and this refetch.
    throw new NotFoundError("Ticket not found.");
  }

  await broadcastToOrg(session.orgId, "ticket.updated", {
    id: updated.id,
    orgId: session.orgId,
  });

  return toClientShape(updated);
}
