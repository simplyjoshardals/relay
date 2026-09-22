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
