"use client";

import { useMemo, useState } from "react";
import { MagnifyingGlassIcon } from "@phosphor-icons/react";
import { Cpu } from "@phosphor-icons/react/ssr";
import { Avatar } from "@/components/dashboard/Avatar";
import {
  describeActivity,
  describeActivityText,
} from "@/components/shared/ActivityDescription";
import type { Activity, User } from "@/types";
import { dayLabel, relativeTime } from "@/lib/style";

// README §13: "Activity should be paginated rather than loading an
// unbounded history into the browser." This client-side "Load more" stands
// in for real cursor pagination until the API lands (milestone 6/9) — the
// UI contract (a bounded page, a button to fetch the next one) is the part
// that needs to survive that swap.
const PAGE_SIZE = 5;

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

interface ActivityViewProps {
  activities: Activity[];
  resolveUser: (id: string | null) => User | null;
}

export function ActivityView({ activities, resolveUser }: ActivityViewProps) {
  const [search, setSearch] = useState("");
  const [targetFilter, setTargetFilter] = useState<
    Activity["targetType"] | "ALL"
  >("ALL");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const filterKey = `${search}|${targetFilter}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  // A new search or filter should show its own first page, not whatever
  // page depth the previous filter had scrolled to. Adjusting state
  // directly during render (rather than in an effect) avoids the extra
  // render-then-reset cascade for what's really just a derived reset.
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setVisibleCount(PAGE_SIZE);
  }

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
  }, [sorted, search, resolveUser]);

  const filtered = useMemo(() => {
    if (targetFilter === "ALL") return searched;
    return searched.filter((a) => a.targetType === targetFilter);
  }, [searched, targetFilter]);

  // A new search or filter should show its own first page, not whatever
  // page depth the previous filter had scrolled to.
  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  // Group the currently-visible page into day sections ("Today",
  // "Yesterday", ...) — a long history reads far better broken up than as
  // one undifferentiated list, and each section only needs to establish
  // its date once.
  const groups = useMemo(() => {
    const result: { label: string; items: Activity[] }[] = [];
    for (const activity of visible) {
      const label = dayLabel(activity.createdAt);
      const lastGroup = result[result.length - 1];
      if (lastGroup && lastGroup.label === label) {
        lastGroup.items.push(activity);
      } else {
        result.push({ label, items: [activity] });
      }
    }
    return result;
  }, [visible]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-medium text-ink">Activity</h1>
        <p className="text-sm text-ink-dim">
          {activities.length} {activities.length === 1 ? "event" : "events"}{" "}
          recorded
        </p>
      </div>

      <div className="rounded-lg border border-line bg-panel">
        <div className="flex flex-col gap-3 border-b border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
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

          <div className="relative w-full sm:w-64">
            <MagnifyingGlassIcon
              size={14}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search activity"
              className="w-full rounded-md border border-line bg-panel-raised py-1.5 pl-8 pr-3 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-1 focus:ring-signal"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-ink-dim">
            No activity matches your filters.
          </div>
        ) : (
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
                          {relativeTime(activity.createdAt)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}

        {hasMore && (
          <div className="border-t border-line px-4 py-3 text-center">
            <button
              type="button"
              onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
              className="rounded-md px-3 py-1.5 text-xs font-medium text-ink-dim transition-colors hover:bg-panel-raised hover:text-ink"
            >
              Load more ({filtered.length - visibleCount} remaining)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "rounded-md px-3 py-1.5 text-xs font-medium text-ink bg-panel-raised"
          : "rounded-md px-3 py-1.5 text-xs text-ink-dim transition-colors hover:text-ink"
      }
    >
      {label} <span className="text-ink-faint">{count}</span>
    </button>
  );
}
