import {
  Skeleton,
  SkeletonCircle,
  SkeletonText,
} from "@/components/shared/Skeleton";
import { incidentStatusMeta, type IncidentStatus } from "@/types";

const statusFilters: IncidentStatus[] = [
  "INVESTIGATING",
  "IDENTIFIED",
  "MONITORING",
  "RESOLVED",
];

const ROW_COUNT = 6;

/**
 * IncidentsPage's `loading.tsx` fallback (STREAMING_SSR_TODO.md), same
 * role as TicketsViewSkeleton/DashboardSkeleton: a plain Server
 * Component with zero queries of its own, shown the moment navigation
 * starts while `incidents/page.tsx`'s server-side prefetch is still in
 * flight, then swapped out for the real, already-hydrated
 * `IncidentsView` once that resolves.
 *
 * Mirrors `IncidentsView`'s exact layout (header, filter bar, search
 * box, list rows) so nothing shifts position when the real content
 * replaces it. "New incident" needs no click handler here — it's
 * decorative until the real button replaces it. Filter labels are
 * real text (they're static; only the count next to each is unknown
 * yet), same convention as StatRow's `value: null` placeholder. Each
 * row's severity border is left neutral (`border-line-strong`) since
 * the real severity isn't known yet either.
 */
export function IncidentsViewSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex shrink-0 items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-medium text-ink">Incidents</h1>
          <SkeletonText width="w-28" className="mt-1.5 h-3" />
        </div>

        <div className="h-8 w-32 shrink-0 rounded-md bg-line-strong opacity-60" />
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-line bg-panel">
        <div className="shrink-0 border-b border-line px-4 py-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-1">
              <div className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs text-ink-dim">
                <span>All</span>
                <Skeleton className="h-2.5 w-3 rounded-sm" />
              </div>

              {statusFilters.map((status) => (
                <div
                  key={status}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-ink-dim"
                >
                  <span>{incidentStatusMeta[status].label}</span>
                  <Skeleton className="h-2.5 w-3 rounded-sm" />
                </div>
              ))}
            </div>

            <Skeleton className="h-8 w-full rounded-md sm:w-64" />
          </div>
        </div>

        <ul className="min-h-0 flex-1 overflow-y-auto">
          {Array.from({ length: ROW_COUNT }).map((_, i) => (
            <li
              key={i}
              className="flex items-center gap-4 border-b border-l-2 border-line border-l-line-strong px-4 py-3 last:border-b-0"
            >
              <Skeleton className="hidden h-4 w-14 shrink-0 rounded sm:inline-block" />
              <Skeleton className="size-1.5 shrink-0 rounded-full sm:hidden" />

              <div className="min-w-0 flex-1">
                <Skeleton className="h-3.5 w-2/3 rounded" />
                <Skeleton className="mt-1.5 h-2.5 w-36 rounded" />
              </div>

              <SkeletonCircle />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
