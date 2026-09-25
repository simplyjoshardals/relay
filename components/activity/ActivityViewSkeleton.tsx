import {
  Skeleton,
  SkeletonCircle,
  SkeletonText,
} from "@/components/shared/Skeleton";
import type { Activity } from "@/types";

const targetFilters: Activity["targetType"][] = [
  "ticket",
  "incident",
  "service",
  "user",
];

const targetFilterLabels: Record<Activity["targetType"], string> = {
  ticket: "Tickets",
  incident: "Incidents",
  service: "Services",
  user: "Team",
};

const ROW_COUNT = 6;

/**
 * ActivityPage's `loading.tsx` fallback (STREAMING_SSR_TODO.md), same
 * role as the earlier view skeletons: a plain Server Component with
 * zero queries of its own, shown the moment navigation starts while
 * `activity/page.tsx`'s server-side prefetch is still in flight, then
 * swapped out for the real, already-hydrated `ActivityView` once that
 * resolves.
 *
 * Mirrors `ActivityView`'s layout (header, filter bar, search box, one
 * day-group header, and rows shaped like the real activity row —
 * avatar, two text lines, timestamp) — same row shape as dashboard's
 * `ActivityFeedSkeleton`, just in this view's own list chrome. Filter
 * labels are real text (they're static; only the count next to each
 * is unknown yet). The day-group label itself (`dayLabel()` — "Today",
 * "Yesterday", etc.) depends on data that doesn't exist yet, so it's a
 * skeleton bar rather than a guessed date.
 *
 * Deliberate omission: the "Load more" footer button only ever
 * appears once `hasNextPage` is known, which this skeleton has no way
 * to predict — left out entirely rather than guessed, same reasoning
 * as `ServicesViewSkeleton` leaving out the Manager-only button.
 */
export function ActivityViewSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="shrink-0">
        <h1 className="text-lg font-medium text-ink">Activity</h1>
        <SkeletonText width="w-28" className="mt-1.5 h-3" />
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-line bg-panel">
        <div className="shrink-0 border-b border-line px-4 py-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-1">
              <div className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs text-ink-dim">
                <span>All</span>
                <Skeleton className="h-2.5 w-3 rounded-sm" />
              </div>

              {targetFilters.map((type) => (
                <div
                  key={type}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-ink-dim"
                >
                  <span>{targetFilterLabels[type]}</span>
                  <Skeleton className="h-2.5 w-3 rounded-sm" />
                </div>
              ))}
            </div>

            <Skeleton className="h-8 w-full rounded-md sm:w-64" />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="flex flex-col">
            <div>
              <div className="border-b border-line bg-panel-raised/50 px-4 py-1.5">
                <Skeleton className="h-2.5 w-12 rounded-sm" />
              </div>

              <ul>
                {Array.from({ length: ROW_COUNT }).map((_, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2.5 border-b border-line px-4 py-3 last:border-b-0"
                  >
                    <SkeletonCircle />

                    <div className="min-w-0 flex-1 space-y-1.5">
                      <SkeletonText width="w-4/5" />
                    </div>

                    <SkeletonText width="w-10" className="mt-0.5 h-2.5" />
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
