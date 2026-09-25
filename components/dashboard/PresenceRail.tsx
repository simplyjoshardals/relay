"use client";

import { useQuery } from "@tanstack/react-query";
import { Avatar } from "./Avatar";
import { SkeletonCircle, SkeletonText } from "@/components/shared/Skeleton";
import {
  useCurrentUserId,
  useOnlineUserIds,
  usePresenceReady,
  useRealtimeStatus,
} from "@/components/shared/RealtimeProvider";
import { listOrgUsersAction } from "@/app/(dashboard)/tickets/actions";
import type { User } from "@/types";

const EMPTY_USERS: User[] = [];

/**
 * Milestone 7 / PR-01: real presence, in place of the static mock
 * `onlineUserIds` set this used to take as a prop. Now fully
 * self-contained — no props — for a reason beyond the usual
 * self-fetching pattern (IncidentsView/ServicesView/ActivityView):
 * `onlineIds` (useOnlineUserIds, RealtimeProvider.tsx) is real Supabase
 * Presence keyed on real user ids, so the roster it's cross-referenced
 * against has to be real too, or every entry would show offline
 * regardless of actual presence — a mock `users` list with ids like
 * "u_maya" would never match. `listOrgUsersAction` is the same query
 * TicketModal/IncidentModal already use for assignee/responder pickers.
 */
/** Extracted for reuse as this route's `loading.tsx` fallback
 *  (`DashboardSkeleton.tsx`) — same reasoning as
 *  IncidentsPanelSkeleton/ServiceHealthGridSkeleton/etc., except this
 *  one has to stand alone: unlike those, `PresenceRail` self-fetches
 *  rather than taking a `loading` prop, so the skeleton fallback can't
 *  just render `<PresenceRail loading />` — there's no such prop, and
 *  the route's `loading.tsx` needs something with zero fetches of its
 *  own while the real page streams in behind it. */
export function PresenceRailSkeleton() {
  return (
    <div className="rounded-lg border border-line bg-panel p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-ink">Team</h2>
      </div>

      <ul className="mt-3 flex flex-col gap-2">
        {[0, 1, 2].map((i) => (
          <li key={i} className="flex items-center gap-2.5">
            <SkeletonCircle />
            <SkeletonText width="w-20" />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PresenceRail() {
  const usersQuery = useQuery({
    queryKey: ["org-users", "list"],
    queryFn: listOrgUsersAction,
  });
  const onlineIds = useOnlineUserIds();
  const presenceReady = usePresenceReady();
  const realtimeStatus = useRealtimeStatus();
  const selfId = useCurrentUserId();

  // Presence is only meaningful once it's *known* (see
  // usePresenceReady): before that, "not in the Set" means "haven't
  // heard yet", not "offline", so nobody gets a dot or an online count.
  const isOnline = (id: string) => presenceReady && onlineIds.has(id);

  // First connect still in flight: hold the skeleton (rather than
  // painting the roster all-offline and then re-sorting it a moment
  // later when presence arrives). If we're reconnecting/offline instead,
  // show the roster without dots — waiting on a socket that may be down
  // for a while would leave the panel blank.
  const awaitingFirstPresence =
    !presenceReady && realtimeStatus === "connecting";
  const loading = usersQuery.isLoading || awaitingFirstPresence;

  // Deactivated members stay in the query (history needs them) but
  // aren't part of the roster.
  const users = (usersQuery.data ?? EMPTY_USERS).filter((u) => u.active);

  // You first, then everyone online, then everyone else. Array#sort is
  // stable, so within each group the roster keeps its server order.
  const rank = (id: string) => (id === selfId ? 0 : isOnline(id) ? 1 : 2);
  const sorted = [...users].sort((a, b) => rank(a.id) - rank(b.id));

  return (
    <div className="rounded-lg border border-line bg-panel p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-ink">Team</h2>
        {presenceReady ? (
          <span className="text-xs text-ink-faint">
            {onlineIds.size} online
          </span>
        ) : awaitingFirstPresence ? (
          <SkeletonText width="w-12" />
        ) : (
          <span className="text-xs text-ink-faint">—</span>
        )}
      </div>

      <ul className="mt-3 flex flex-col gap-2">
        {loading
          ? // Milestone 9: skeleton rows in place of the old "Loading…"
            // text line — same shared primitives every other dashboard
            // panel's loading state now uses (components/shared/Skeleton).
            [0, 1, 2].map((i) => (
              <li key={i} className="flex items-center gap-2.5">
                <SkeletonCircle />
                <SkeletonText width="w-20" />
              </li>
            ))
          : sorted.map((user) => {
              const online = isOnline(user.id);
              return (
                <li key={user.id} className="flex items-center gap-2.5">
                  <Avatar
                    initials={user.initials}
                    seed={user.id}
                    online={online}
                  />
                  <span
                    className={
                      online ? "text-xs text-ink" : "text-xs text-ink-faint"
                    }
                  >
                    {user.name}
                  </span>
                </li>
              );
            })}
      </ul>
    </div>
  );
}
