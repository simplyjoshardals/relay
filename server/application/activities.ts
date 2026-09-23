import type { Activity } from "@/types";
import type { AccessTokenClaims } from "@/server/auth/jwt";
import {
  createActivity,
  findActivityPage,
} from "@/server/repositories/activities";
import { broadcastToOrg } from "@/server/realtime/broadcast";

/**
 * AC-05 / §13's pagination contract — how many rows one server round
 * trip fetches per "Load more" click. There's no separate client-side
 * page size to keep in sync with (ActivityView's old mock-data version
 * had its own `PAGE_SIZE = 5` for revealing more of an already-fully-
 * loaded array; that's gone now that "Load more" triggers a real
 * `fetchNextPage()` against this).
 */
const PAGE_SIZE = 20;

export interface ActivityPage {
  items: Activity[];
  nextCursor: string | null;
}

function toClientShape(activity: {
  id: string;
  orgId: string;
  actorId: string | null;
  action: string;
  targetType: string;
  targetId: string;
  metadata: unknown;
  createdAt: Date;
}): Activity {
  return {
    id: activity.id,
    orgId: activity.orgId,
    actorId: activity.actorId,
    action: activity.action as Activity["action"],
    targetType: activity.targetType as Activity["targetType"],
    targetId: activity.targetId,
    // Always either DB null or the flat {string: string|number} shape
    // server/repositories/activities.ts#createActivity writes — nothing
    // else ever populates this column.
    metadata: activity.metadata as Activity["metadata"],
    createdAt: activity.createdAt.toISOString(),
  };
}

/**
 * AC-03/AC-05: the paginated view every use-case in tickets.ts/
 * services.ts/incidents.ts has been writing into since Milestone 4
 * (services, pulled forward for SM-05) and, as of this milestone,
 * tickets and incidents too. Org-scoped via the verified session, same
 * as every other list use-case (§3, Layer 1) — never a client-supplied
 * org id.
 *
 * `cursor` is the last-seen activity's id (undefined for the first
 * page) — see findActivityPage's doc comment for why `id` alone is a
 * sufficient, stable cursor despite the primary sort being `createdAt`.
 */
export async function listActivity(
  session: AccessTokenClaims,
  cursor?: string,
): Promise<ActivityPage> {
  const rows = await findActivityPage(session.orgId, {
    cursor,
    limit: PAGE_SIZE,
  });

  const hasMore = rows.length > PAGE_SIZE;
  const page = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
  const items = page.map(toClientShape);

  return {
    items,
    nextCursor: hasMore ? items[items.length - 1].id : null,
  };
}

/**
 * Shared write path for every use-case that produces an Activity row —
 * tickets.ts, services.ts (already using this shape directly since
 * Milestone 4, pulled forward for SM-05), and incidents.ts as of this
 * milestone. Writing the row and broadcasting `activity.created` are
 * kept together here rather than left as two separate calls at each
 * site, so it's not possible to add a new Activity-writing call
 * somewhere and forget the broadcast half.
 *
 * One call = one row = one broadcast — deliberately not batched, even
 * when a single request produces several rows (e.g. an incident update
 * that changes status *and* links a ticket in the same edit). Matches
 * the "one event per row" grain Milestone 5 settled on for
 * `incident.updated`, and keeps this function's contract simple: call
 * it once per fact you want on the record.
 */
export async function recordActivity(
  orgId: string,
  entry: {
    actorId: string | null;
    action: Activity["action"];
    targetType: Activity["targetType"];
    targetId: string;
    metadata?: Record<string, string | number>;
  },
): Promise<void> {
  const activity = await createActivity(orgId, entry);
  await broadcastToOrg(orgId, "activity.created", { id: activity.id, orgId });
}
