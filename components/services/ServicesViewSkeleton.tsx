import { Skeleton, SkeletonText } from "@/components/shared/Skeleton";
import { serviceStatusMeta, type ServiceStatus } from "@/types";

const statusFilters: ServiceStatus[] = ["OPERATIONAL", "DEGRADED", "OUTAGE"];

const CARD_COUNT = 6;

/**
 * ServicesPage's `loading.tsx` fallback (STREAMING_SSR_TODO.md), same
 * role as TicketsViewSkeleton/IncidentsViewSkeleton: a plain Server
 * Component with zero queries of its own, shown the moment navigation
 * starts while `services/page.tsx`'s server-side prefetch is still in
 * flight, then swapped out for the real, already-hydrated
 * `ServicesView` once that resolves.
 *
 * Mirrors `ServicesView`'s card-grid layout (header, filter bar,
 * search box, service cards shaped like the real one — name/status
 * chip, latency/error figures, sparkline) so nothing shifts position
 * when the real content replaces it. Filter labels are real text
 * (they're static; only the count next to each is unknown yet), same
 * convention as StatRow's `value: null` placeholder.
 *
 * Deliberate omission: the real "New service" button and "Archived"
 * filter pill are Manager-only (`canManageServices`), and this
 * skeleton has no session to check that against — a role check here
 * would mean awaiting `getCurrentUser()` in the fallback itself,
 * which defeats the point of a fallback that paints instantly while
 * the page's own prefetch is still in flight. Left out entirely
 * rather than guessed either way, so a Member never briefly sees a
 * button they can't use; a Manager sees it pop in once the real view
 * hydrates. Revisit only if that pop-in turns out to matter in
 * practice — same kind of accepted trade-off as Dashboard's
 * `staleTime` decision.
 */
export function ServicesViewSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex shrink-0 items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-medium text-ink">Services</h1>
          <SkeletonText width="w-24" className="mt-1.5 h-3" />
        </div>
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
                  <span>{serviceStatusMeta[status].label}</span>
                  <Skeleton className="h-2.5 w-3 rounded-sm" />
                </div>
              ))}
            </div>

            <Skeleton className="h-8 w-full rounded-md sm:w-64" />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 gap-px bg-line sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: CARD_COUNT }).map((_, i) => (
              <div key={i} className="bg-panel p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <SkeletonText width="w-24" className="h-3.5" />
                    <SkeletonText width="w-32" className="mt-1.5 h-2.5" />
                  </div>

                  <Skeleton className="h-4 w-16 shrink-0 rounded" />
                </div>

                <div className="mt-3 flex items-end justify-between">
                  <div className="space-y-1.5">
                    <SkeletonText width="w-10" className="h-3" />
                    <SkeletonText width="w-14" className="h-3" />
                  </div>

                  <Skeleton className="h-6 w-16 rounded" />
                </div>

                <SkeletonText width="w-20" className="mt-2 h-2.5" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
