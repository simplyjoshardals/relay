/**
 * Typed errors the application layer throws so a Server Action can map
 * them to a specific client-facing result rather than a generic
 * failure. Per §8: "the use-case throws a ConflictError. The Server
 * Action surfaces this as a typed error" — the throwing happens here in
 * application code; catching and converting to a serializable result
 * happens at the Server Action boundary (see e.g.
 * app/(dashboard)/tickets/actions.ts), since a thrown Error doesn't
 * cross that boundary with its specific type intact.
 */

/** §8: an update's `expectedVersion` no longer matches the row's current
 *  version — someone else's write got there first. */
export class ConflictError extends Error {
  constructor(message = "This record was changed by someone else.") {
    super(message);
    this.name = "ConflictError";
  }
}

/** The referenced record doesn't exist, or doesn't belong to this org —
 *  those two cases are deliberately indistinguishable to the caller
 *  (§3): a ticket from another org should look identical to a ticket
 *  that doesn't exist, not leak that it exists elsewhere. */
export class NotFoundError extends Error {
  constructor(message = "Not found.") {
    super(message);
    this.name = "NotFoundError";
  }
}

/** Input failed Zod validation (§11) before it ever reached domain
 *  logic. */
export class ValidationError extends Error {
  constructor(message = "Invalid input.") {
    super(message);
    this.name = "ValidationError";
  }
}

/**
 * The requester is authenticated (a session exists) but their role
 * doesn't permit this action — e.g. a MEMBER calling a Manager-only
 * service-catalog mutation (lib/permissions.ts#canManageServices). Kept
 * distinct from NotFoundError: unlike an org-scoping mismatch, there's
 * no reason to hide *that* the capability is Manager-only, only to deny
 * doing it.
 */
export class ForbiddenError extends Error {
  constructor(message = "You don't have permission to do that.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export interface ActionError {
  code: "conflict" | "not_found" | "invalid_input" | "forbidden" | "unknown";
  message: string;
}

/**
 * Shared catch-and-map for every domain's Server Actions (tickets and,
 * as of Milestone 4, services) — one place mapping the typed errors
 * above to a serializable result, rather than each actions.ts file
 * re-implementing the same `instanceof` checks. Anything not one of the
 * known types becomes "unknown" with a generic message — an unexpected
 * failure (a DB outage) shouldn't leak its internals to the client.
 */
export function toActionError(error: unknown): ActionError {
  if (error instanceof ConflictError) {
    return { code: "conflict", message: error.message };
  }
  if (error instanceof NotFoundError) {
    return { code: "not_found", message: error.message };
  }
  if (error instanceof ValidationError) {
    return { code: "invalid_input", message: error.message };
  }
  if (error instanceof ForbiddenError) {
    return { code: "forbidden", message: error.message };
  }
  return { code: "unknown", message: "Something went wrong. Try again." };
}
