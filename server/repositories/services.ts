import { prisma } from "@/lib/prisma";
import type { ServiceStatus } from "@/types";

export async function findServicesForOrg(orgId: string) {
  return prisma.service.findMany({
    where: { orgId },
    orderBy: { name: "asc" },
  });
}

export async function findServiceById(orgId: string, id: string) {
  return prisma.service.findFirst({ where: { id, orgId } });
}

export interface CreateServiceData {
  name: string;
  description: string;
}

/** A brand-new service starts OPERATIONAL with zeroed metrics — a
 *  placeholder until the telemetry worker (or real monitoring) reports
 *  otherwise, per ServiceModal's create-mode copy. */
export async function createService(orgId: string, data: CreateServiceData) {
  return prisma.service.create({
    data: {
      ...data,
      orgId,
      status: "OPERATIONAL",
      latencyMs: 0,
      errorRate: 0,
    },
  });
}

export interface ServiceUpdateFields {
  name?: string;
  description?: string;
  archived?: boolean;
  status?: ServiceStatus;
  latencyMs?: number;
  /** Prisma's Decimal(5,2) column accepts a plain `number` on write
   *  (it's normalized to Decimal internally) — no need to construct a
   *  Decimal instance from this layer. */
  errorRate?: number;
}

/**
 * §8's conditional update, identical shape to
 * repositories/tickets.ts#updateTicketConditional — see that function's
 * comment for why `updateMany` (not `update`) and why returning the bare
 * count rather than throwing here. Used by both the human catalog-edit
 * path (name/description/archived) and the telemetry worker's path
 * (status/latencyMs/errorRate) — same conditional-update primitive
 * either way, just different field sets.
 */
export async function updateServiceConditional(
  orgId: string,
  id: string,
  expectedVersion: number,
  fields: ServiceUpdateFields,
) {
  return prisma.service.updateMany({
    where: { id, orgId, version: expectedVersion },
    data: { ...fields, version: { increment: 1 } },
  });
}
