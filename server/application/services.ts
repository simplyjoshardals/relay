import type { Service } from "@/types";
import type { AccessTokenClaims } from "@/server/auth/jwt";
import { canManageServices } from "@/lib/permissions";
import {
  createServiceInputSchema,
  updateServiceInputSchema,
} from "@/server/validation/services";
import {
  createService as createServiceRow,
  findServiceById,
  findServicesForOrg,
  updateServiceConditional,
} from "@/server/repositories/services";
import { recordActivity } from "@/server/application/activities";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/server/application/errors";
import { broadcastToOrg } from "@/server/realtime/broadcast";

function toClientShape(service: {
  id: string;
  orgId: string;
  name: string;
  description: string;
  status: string;
  latencyMs: number;
  errorRate: unknown;
  version: number;
  updatedAt: Date;
  archived: boolean;
}): Service {
  return {
    id: service.id,
    orgId: service.orgId,
    name: service.name,
    description: service.description,
    status: service.status as Service["status"],
    latencyMs: service.latencyMs,
    // Prisma's Decimal(5,2) comes back as a Decimal-like object, not a
    // plain number — Number() on it gives the same value `types/index.ts`
    // declares (`errorRate: number`). A raw `pg` driver would hand back a
    // string for the same reason; either way this is the one place that
    // gets normalized before the client shape is built.
    errorRate: Number(service.errorRate),
    version: service.version,
    updatedAt: service.updatedAt.toISOString(),
    archived: service.archived,
    // Never persisted — buffered client-side from realtime updates
    // received since the page loaded (types/index.ts). Always empty
    // fresh off a query; TanStack's cache is what accumulates it, not
    // this shape.
    sessionLatencyTrend: [],
  };
}

/** SM-01/SM-02: view. Org-scoped via the verified session, same as
 *  listTickets — never a client-supplied org id (§3, Layer 1).
 *  Archived services are included; ServicesView is what filters them out
 *  of the default view (README §19), same split of responsibility as
 *  the rest of the UI's search/filter state. */
export async function listServices(
  session: AccessTokenClaims,
): Promise<Service[]> {
  const services = await findServicesForOrg(session.orgId);
  return services.map(toClientShape);
}

/** Catalog create — Manager-only (lib/permissions.ts#canManageServices).
 *  Unlike tickets, this capability is role-gated, so unlike
 *  createTicket() this checks the session's role before doing anything
 *  else: the UI already hides "New service" from a Member, but a Server
 *  Action must never trust that the caller only ever reaches it through
 *  that UI (AUTH-06). */
export async function createService(
  session: AccessTokenClaims,
  input: unknown,
): Promise<Service> {
  if (!canManageServices(session.role)) {
    throw new ForbiddenError("Only a Manager can add a service.");
  }

  const parsed = createServiceInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError(
      parsed.error.issues[0]?.message ?? "Invalid input.",
    );
  }

  const service = await createServiceRow(session.orgId, parsed.data);

  await broadcastToOrg(session.orgId, "service.updated", {
    id: service.id,
    orgId: session.orgId,
  });

  return toClientShape(service);
}

/**
 * Catalog edit — name/description, plus archive/restore (README §19),
 * all through one version-checked update, same reasoning as
 * updateTicket() folding status/priority/assignee together. Manager-only,
 * same check as createService().
 *
 * Deliberately does NOT accept status/latencyMs/errorRate — those are
 * telemetry-owned (§13) and only ever written via
 * updateServiceTelemetry() below, which the worker calls and which has
 * no role check at all (it isn't reached from a human session).
 */
export async function updateService(
  session: AccessTokenClaims,
  serviceId: string,
  input: unknown,
): Promise<Service> {
  if (!canManageServices(session.role)) {
    throw new ForbiddenError("Only a Manager can edit a service.");
  }

  const parsed = updateServiceInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError(
      parsed.error.issues[0]?.message ?? "Invalid input.",
    );
  }

  const existing = await findServiceById(session.orgId, serviceId);
  if (!existing) {
    throw new NotFoundError("Service not found.");
  }

  const { expectedVersion, ...fields } = parsed.data;

  const result = await updateServiceConditional(
    session.orgId,
    serviceId,
    expectedVersion,
    fields,
  );

  if (result.count === 0) {
    throw new ConflictError(
      "This service was changed by someone else. Refresh and try again.",
    );
  }

  const updated = await findServiceById(session.orgId, serviceId);
  if (!updated) {
    throw new NotFoundError("Service not found.");
  }

  await broadcastToOrg(session.orgId, "service.updated", {
    id: updated.id,
    orgId: session.orgId,
  });

  return toClientShape(updated);
}

/**
 * §13's per-tick input: the telemetry worker needs "which services exist
 * and aren't archived" for one org, with no session to check a role
 * against (same reasoning as updateServiceTelemetry below). This shares
 * listServices' query and shape via toClientShape — the only difference
 * is no session/role gate and archived services are filtered out, since
 * README §19/ServiceModal are explicit an archived service "won't be
 * monitored going forward."
 */
export async function listActiveServicesForTelemetry(
  orgId: string,
): Promise<Service[]> {
  const services = await findServicesForOrg(orgId);
  return services.filter((s) => !s.archived).map(toClientShape);
}

export interface TelemetryReading {
  latencyMs: number;
  errorRate: number;
  status: Service["status"];
}

/**
 * §13: the one use-case the telemetry worker calls, on every tick, for
 * every non-archived service. Deliberately takes no `session` — the
 * worker has no human session to present (§13: "never touches Incidents
 * ... a human decides", and by the same logic there's no Manager whose
 * permission this needs, since nothing about *which service to monitor*
 * is being changed here, only its live numbers). `orgId` and `serviceId`
 * come from the worker's own org/service enumeration, not from a client
 * request, so there's no AUTH-06 concern — this is never wired to a
 * Server Action or Route Handler a browser can call.
 *
 * Writes an Activity row only when `status` actually changes (SM-05),
 * with `actorId: null` (SM-06: distinguishable from human-driven
 * activity) — a latency/error-rate jiggle that doesn't cross a status
 * boundary isn't "meaningful" enough to log, matching how tickets only
 * broadcast on a real committed change, not every keystroke. As of
 * Milestone 6, that write also broadcasts `activity.created`
 * (recordActivity, server/application/activities.ts) — this call site
 * predates that event existing, so it only ever wrote the row before.
 *
 * Uses the same version-checked conditional update as the human path
 * (§8) — not because two callers are likely to race on a single
 * service's version in practice, but because a second, unconditioned
 * write path here would be exactly the kind of exception that makes "no
 * repository function may omit the conditional update" stop being a
 * rule anyone can rely on. A stale read losing this tick to the next one
 * is harmless (there's another tick in a few seconds); silently
 * clobbering a concurrent Manager edit would not be.
 */
export async function updateServiceTelemetry(
  orgId: string,
  serviceId: string,
  reading: TelemetryReading,
): Promise<void> {
  const existing = await findServiceById(orgId, serviceId);
  if (!existing || existing.archived) {
    // Deleted/archived since the worker last listed services for this
    // org — nothing to update. Not an error: the worker's per-tick
    // service list is only as fresh as its last poll (see
    // workers/telemetry.ts), so this is an expected race, not a bug.
    return;
  }

  const statusChanged = existing.status !== reading.status;

  const result = await updateServiceConditional(
    orgId,
    serviceId,
    existing.version,
    {
      latencyMs: reading.latencyMs,
      errorRate: reading.errorRate,
      status: reading.status,
    },
  );

  if (result.count === 0) {
    // Lost the race to a concurrent write (a Manager's edit, or another
    // tick somehow overlapping). Skip this reading rather than retry —
    // the next tick supersedes it in a few seconds regardless.
    return;
  }

  if (statusChanged) {
    await recordActivity(orgId, {
      actorId: null,
      action: "SERVICE_STATUS_CHANGED",
      targetType: "service",
      targetId: serviceId,
      metadata: { from: existing.status, to: reading.status },
    });
  }

  await broadcastToOrg(orgId, "service.updated", {
    id: serviceId,
    orgId,
  });
}
