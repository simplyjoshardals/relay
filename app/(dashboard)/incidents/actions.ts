"use server";

import { requireSession } from "@/server/auth/session";
import {
  createIncident,
  listIncidents,
  updateIncident,
} from "@/server/application/incidents";
import { toActionError, type ActionError } from "@/server/application/errors";
import type { Incident } from "@/types";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ActionError };

/** Used directly as TanStack Query's `queryFn` (§10), same as
 *  listTicketsAction/listServicesAction. */
export async function listIncidentsAction(): Promise<Incident[]> {
  const session = await requireSession();
  return listIncidents(session);
}

export async function createIncidentAction(
  input: unknown,
): Promise<ActionResult<Incident>> {
  try {
    const session = await requireSession();
    const incident = await createIncident(session, input);
    return { ok: true, data: incident };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

export async function updateIncidentAction(
  incidentId: string,
  input: unknown,
): Promise<ActionResult<Incident>> {
  try {
    const session = await requireSession();
    const incident = await updateIncident(session, incidentId, input);
    return { ok: true, data: incident };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}
