"use client";

import { useQuery } from "@tanstack/react-query";
import { Avatar } from "./Avatar";
import { useOnlineUserIds } from "@/components/shared/RealtimeProvider";
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
export function PresenceRail() {
  const usersQuery = useQuery({
    queryKey: ["org-users", "list"],
    queryFn: listOrgUsersAction,
  });
  const onlineIds = useOnlineUserIds();

  const users = usersQuery.data ?? EMPTY_USERS;

  const sorted = [...users].sort((a, b) => {
    const aOnline = onlineIds.has(a.id) ? 0 : 1;
    const bOnline = onlineIds.has(b.id) ? 0 : 1;
    return aOnline - bOnline;
  });

  return (
    <div className="rounded-lg border border-line bg-panel p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-ink">Team</h2>
        <span className="text-xs text-ink-faint">{onlineIds.size} online</span>
      </div>

      <ul className="mt-3 flex flex-col gap-2">
        {usersQuery.isLoading ? (
          <li className="text-xs text-ink-faint">Loading…</li>
        ) : (
          sorted.map((user) => {
            const online = onlineIds.has(user.id);
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
          })
        )}
      </ul>
    </div>
  );
}
