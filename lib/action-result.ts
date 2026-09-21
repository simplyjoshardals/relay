import type { ActionError } from "@/server/application/errors";

/**
 * Bridges the Server Actions' `{ ok, data | error }` results (see
 * app/(dashboard)/tickets/actions.ts) into TanStack Query's model, where a
 * failed mutation is a *thrown* error. Unwrapping inside `mutationFn`
 * means a rejected write (conflict, validation, not-found) and a network
 * failure both land in the same `onError` — which is where optimistic
 * updates get rolled back — instead of one failure path living in
 * `onSuccess` and the other in `onError`.
 */
export class ActionFailure extends Error {
  readonly error: ActionError;

  constructor(error: ActionError) {
    super(error.message);
    this.name = "ActionFailure";
    this.error = error;
  }
}

export function unwrap<T>(
  result: { ok: true; data: T } | { ok: false; error: ActionError },
): T {
  if (!result.ok) throw new ActionFailure(result.error);
  return result.data;
}

/** Client-side only (reads `navigator`). Turns whatever a mutation threw
 *  into a message a person can act on — "you're offline" is a different
 *  problem from "the server said no". */
export function failureMessage(error: unknown, action: string): string {
  if (error instanceof ActionFailure) return error.message;
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return `You're offline, so the ticket wasn't ${action}. Reconnect and try again.`;
  }
  return `Couldn't ${action === "created" ? "create" : "update"} the ticket. Try again.`;
}
