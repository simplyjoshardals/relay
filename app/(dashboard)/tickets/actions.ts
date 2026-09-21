"use server";

import { requireSession } from "@/server/auth/session";
import {
  createTicket,
  listTickets,
  updateTicket,
} from "@/server/application/tickets";
import { listOrgUsers } from "@/server/application/users";
import { toActionError, type ActionError } from "@/server/application/errors";
import type { Ticket, User } from "@/types";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ActionError };

/**
 * Used directly as TanStack Query's `queryFn` (§10) — a Server Action is
 * just an async function from the client's perspective, so this is a
 * completely ordinary queryFn, no separate Route Handler needed (§5:
 * Route Handlers are for callers that aren't the Relay UI itself).
 */
export async function listTicketsAction(): Promise<Ticket[]> {
  const session = await requireSession();
  return listTickets(session);
}

/** For TicketModal's assignee picker — real org users, not mock data
 *  (server/application/users.ts explains why this one got pulled
 *  forward from Milestone 9). */
export async function listOrgUsersAction(): Promise<User[]> {
  const session = await requireSession();
  return listOrgUsers(session);
}

export async function createTicketAction(
  input: unknown,
): Promise<ActionResult<Ticket>> {
  try {
    const session = await requireSession();
    const ticket = await createTicket(session, input);
    return { ok: true, data: ticket };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

export async function updateTicketAction(
  ticketId: string,
  input: unknown,
): Promise<ActionResult<Ticket>> {
  try {
    const session = await requireSession();
    const ticket = await updateTicket(session, ticketId, input);
    return { ok: true, data: ticket };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}
