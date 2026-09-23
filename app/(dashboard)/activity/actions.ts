"use server";

import { requireSession } from "@/server/auth/session";
import {
  listActivity,
  type ActivityPage,
} from "@/server/application/activities";

/** Used directly as TanStack Query's `queryFn` via `useInfiniteQuery`
 *  (§10) — `pageParam` becomes `cursor`. */
export async function listActivityAction(
  cursor?: string,
): Promise<ActivityPage> {
  const session = await requireSession();
  return listActivity(session, cursor);
}
