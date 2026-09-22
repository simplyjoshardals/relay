"use server";

import { requireSession } from "@/server/auth/session";
import {
  createService,
  listServices,
  updateService,
} from "@/server/application/services";
import { toActionError, type ActionError } from "@/server/application/errors";
import type { Service } from "@/types";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ActionError };

/** Used directly as TanStack Query's `queryFn` (§10), same as
 *  listTicketsAction — a Server Action is an ordinary async function
 *  from the client's perspective. */
export async function listServicesAction(): Promise<Service[]> {
  const session = await requireSession();
  return listServices(session);
}

export async function createServiceAction(
  input: unknown,
): Promise<ActionResult<Service>> {
  try {
    const session = await requireSession();
    const service = await createService(session, input);
    return { ok: true, data: service };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

export async function updateServiceAction(
  serviceId: string,
  input: unknown,
): Promise<ActionResult<Service>> {
  try {
    const session = await requireSession();
    const service = await updateService(session, serviceId, input);
    return { ok: true, data: service };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}
