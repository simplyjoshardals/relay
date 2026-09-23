import { prisma } from "@/lib/prisma";
import { Prisma } from "@/lib/generated/prisma/client";
import type { ActivityAction } from "@/types";

/**
 * Pulled forward from Milestone 6 ("activity generation wired into every
 * use-case... retrofit is fine") because SM-05 ("changes in service
 * health must generate system events") is in scope for Milestone 4
 * itself — the telemetry worker needs somewhere to write to the moment
 * it exists, rather than silently updating Service rows with no record.
 * There's no paginated read side yet (that's Milestone 6's `listActivity`
 * + realtime `activity.created`); this is deliberately just the write
 * path other use-cases will also call once they're retrofitted.
 */
export interface CreateActivityData {
  /** null = system/telemetry-generated (SM-06: must be distinguishable
   *  from manually created operational activity) — never a placeholder
   *  user id. */
  actorId: string | null;
  action: ActivityAction;
  targetType: "ticket" | "service" | "incident";
  targetId: string;
  metadata?: Record<string, string | number> | null;
}

export async function createActivity(orgId: string, data: CreateActivityData) {
  return prisma.activity.create({
    data: {
      orgId,
      actorId: data.actorId,
      action: data.action,
      targetType: data.targetType,
      targetId: data.targetId,
      metadata: data.metadata ?? Prisma.JsonNull,
    },
  });
}

/**
 * Milestone 6's read side. Cursor-paginated (AC-05: "paginated rather
 * than loading an unbounded history") on `id` — sufficient on its own
 * for a stable, gap-free cursor even though the primary sort is
 * `createdAt desc`, because Prisma's cursor pagination compares the
 * *whole* orderBy tuple against the cursor row, not just the cursor
 * field itself; the secondary `id desc` sort only exists to break ties
 * between rows with an identical `createdAt` deterministically (bursts
 * of activity from one mutation — e.g. an incident edit that links
 * several tickets at once, each getting its own INCIDENT_TICKET_LINKED
 * row — can land in the same millisecond).
 * Matches the index `@@index([orgId, createdAt(sort: Desc)])`.
 *
 * Fetches `limit + 1` rows so the caller (server/application/
 * activities.ts#listActivity) can tell whether another page exists
 * without a separate COUNT query on the hot path.
 */
export async function findActivityPage(
  orgId: string,
  { cursor, limit }: { cursor?: string; limit: number },
) {
  return prisma.activity.findMany({
    where: { orgId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
}
