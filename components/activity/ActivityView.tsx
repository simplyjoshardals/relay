"use client";

import { useMemo, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Cpu } from "@phosphor-icons/react/ssr";
import { Avatar } from "@/components/dashboard/Avatar";
import {
  describeActivity,
  describeActivityText,
} from "@/components/shared/ActivityDescription";
import { FilterPill } from "@/components/shared/FilterPill";
import { SearchInput } from "@/components/shared/SearchInput";
import { listActivityAction } from "@/app/(dashboard)/activity/actions";
import { listOrgUsersAction } from "@/app/(dashboard)/tickets/actions";
import type { Activity, User } from "@/types";
import { dayLabel, relativeTime } from "@/lib/style";
import { useNow } from "@/lib/use-now";

const targetFilters: Activity["targetType"][] = [
  "ticket",
  "incident",
  "service",
];

const targetFilterLabels: Record<Activity["targetType"], string> = {
  ticket: "Tickets",
  incident: "Incidents",
  service: "Services",
};

const EMPTY_USERS: User[] = [];

const ACTIVITY_LIST_KEY = ["activity", "list"] as const;

/**
 * Milestone 6: a real cursor-paginated feed (AC-05) in place of the
 * client-side `visibleCount` slice this component used to take over a
 * fully-loaded mock array — this was exactly the swap
 * app/(dashboard)/activity/page.tsx's old TODO comment anticipated
 * ("swapping its client-side slicing for fetchNextPage() shouldn't
 * touch the JSX"), and the rendered structure below is close to
 * unchanged from before.
 *
 * No props anymore — self-fetches both activity
 * (`listActivityAction`/`useInfiniteQuery`) and org users
 * (`listOrgUsersAction`, to resolve `actorId` → display name), same
 * self-fetching shape IncidentsView/ServicesView already settled on.
 *
 * Search/filter still run entirely client-side, but only over pages
 * already fetched via "Load more" — narrowing the search box doesn't
 * reach further back into history than has been pulled so far. That's
 * an inherent property of layering client-side search on top of real
 * pagination, not a bug to fix here; true server-side search would need
 * its own query parameter and index.
 */
export function ActivityView() {
  const now = useNow();
  const [search, setSearch] = useState("");
  const [targetFilter, setTargetFilter] = useState<
    Activity["targetType"] | "ALL"
  >("ALL");

  const activityQuery = useInfiniteQuery({
    queryKey: ACTIVITY_LIST_KEY,
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      listActivityAction(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  const usersQuery = useQuery({
    queryKey: ["org-users", "list"],
    queryFn: listOrgUsersAction,
  });

  const users = usersQuery.data ?? EMPTY_USERS;
  const userById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const resolveUser = (id: string | null): User | null =>
    id ? (userById.get(id) ?? null) : null;

  const activities = useMemo(
    () => activityQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [activityQuery.data],
  );

  // Every page already arrives sorted (createdAt desc, id desc —
  // server/repositories/activities.ts#findActivityPage) — re-sorting
  // here is just a defensive no-op against pages ever landing out of
  // order, the same role this step played over the old mock array.
  const sorted = useMemo(
    () =>
      [...activities].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [activities],
  );

  const searched = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return sorted;

    return sorted.filter((activity) => {
      const actor = resolveUser(activity.actorId);

      const actorName = actor ? actor.name.toLowerCase() : "telemetry";

      return (
        actorName.includes(query) ||
        describeActivityText(activity).toLowerCase().includes(query)
      );
    });
    // resolveUser closes over userById, not users directly — depending
    // on the map (already memoized off `users` above) is both accurate
    // and avoids re-deriving this on every render the way depending on
    // the freshly-recreated `resolveUser` closure itself would.
  }, [sorted, search, userById]);

  const filtered = useMemo(() => {
    if (targetFilter === "ALL") return searched;

    return searched.filter((a) => a.targetType === targetFilter);
  }, [searched, targetFilter]);

  const groups = useMemo(() => {
    const result: {
      label: string;
      items: Activity[];
    }[] = [];

    for (const activity of filtered) {
      const label = dayLabel(activity.createdAt, now);
      const lastGroup = result[result.length - 1];

      if (lastGroup && lastGroup.label === label) {
        lastGroup.items.push(activity);
      } else {
        result.push({
          label,
          items: [activity],
        });
      }
    }

    return result;
  }, [filtered, now]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="shrink-0">
        <h1 className="text-lg font-medium text-ink">Activity</h1>

        <p className="text-sm text-ink-dim">
          {activities.length} {activities.length === 1 ? "event" : "events"}{" "}
          loaded
        </p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-line bg-panel">
        <div className="shrink-0 border-b border-line px-4 py-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-1">
              <FilterPill
                active={targetFilter === "ALL"}
                onClick={() => setTargetFilter("ALL")}
                label="All"
                count={searched.length}
              />

              {targetFilters.map((type) => (
                <FilterPill
                  key={type}
                  active={targetFilter === type}
                  onClick={() => setTargetFilter(type)}
                  label={targetFilterLabels[type]}
                  count={searched.filter((a) => a.targetType === type).length}
                />
              ))}
            </div>

            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search activity"
            />
          </div>
        </div>

        {activityQuery.isLoading ? (
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-8 text-center text-sm text-ink-dim">
            Loading activity…
          </div>
        ) : activityQuery.isError ? (
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-8 text-center text-sm text-danger">
            Couldn&apos;t load activity.{" "}
            <button
              type="button"
              onClick={() => activityQuery.refetch()}
              className="underline hover:text-ink"
            >
              Try again
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-8 text-center text-sm text-ink-dim">
            No activity matches your filters.
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="flex flex-col">
              {groups.map((group) => (
                <div key={group.label}>
                  <div className="border-b border-line bg-panel-raised/50 px-4 py-1.5 text-[11px] font-medium uppercase tracking-wide text-ink-faint">
                    {group.label}
                  </div>

                  <ul>
                    {group.items.map((activity) => {
                      const actor = resolveUser(activity.actorId);

                      return (
                        <li
                          key={activity.id}
                          className="flex items-start gap-2.5 border-b border-line px-4 py-3 last:border-b-0"
                        >
                          {actor ? (
                            <Avatar
                              initials={actor.initials}
                              seed={actor.id}
                              title={actor.name}
                            />
                          ) : (
                            <span
                              className="flex size-6 shrink-0 items-center justify-center rounded-full bg-panel-raised text-ink-faint"
                              title="Telemetry"
                            >
                              <Cpu size={12} weight="bold" />
                            </span>
                          )}

                          <div className="min-w-0 flex-1 text-sm leading-snug">
                            <span className="text-ink-dim">
                              <span
                                className={
                                  actor
                                    ? "text-ink"
                                    : "text-ink-faint font-mono text-xs"
                                }
                              >
                                {actor ? actor.name : "telemetry"}
                              </span>{" "}
                              {describeActivity(activity)}
                            </span>
                          </div>

                          <span className="shrink-0 text-xs text-ink-faint">
                            {relativeTime(activity.createdAt, now)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

        {activityQuery.hasNextPage && (
          <div className="shrink-0 border-t border-line px-4 py-3 text-center">
            <button
              type="button"
              onClick={() => activityQuery.fetchNextPage()}
              disabled={activityQuery.isFetchingNextPage}
              className="rounded-md px-3 py-1.5 text-xs font-medium text-ink-dim transition-colors hover:bg-panel-raised hover:text-ink disabled:opacity-50"
            >
              {activityQuery.isFetchingNextPage ? "Loading…" : "Load more"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
