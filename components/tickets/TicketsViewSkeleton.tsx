import {
  Skeleton,
  SkeletonCircle,
  SkeletonText,
} from "@/components/shared/Skeleton";
import { ticketStatusMeta, type TicketStatus } from "@/types";

const statusColumns: TicketStatus[] = [
  "OPEN",
  "IN_PROGRESS",
  "BLOCKED",
  "RESOLVED",
];

const ROW_COUNT = 6;

/**
 * TicketsPage's `loading.tsx` fallback (STREAMING_SSR_TODO.md), same
 * role as DashboardSkeleton: a plain Server Component with zero
 * queries of its own, shown the moment navigation starts while
 * `tickets/page.tsx`'s server-side prefetch is still in flight, then
 * swapped out for the real, already-hydrated `TicketsView` once that
 * resolves.
 *
 * Mirrors `TicketsView`'s exact layout (header, filter bar, search
 * box, list rows) so nothing shifts position when the real content
 * replaces it. "New ticket" needs no click handler here — it's
 * decorative until the real button replaces it. Filter labels are
 * real text (they're static; only the count next to each is unknown
 * yet), same convention as StatRow's `value: null` placeholder.
 */
export function TicketsViewSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex shrink-0 items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-medium text-ink">Tickets</h1>
          <SkeletonText width="w-16" className="mt-1.5 h-3" />
        </div>

        <div className="h-8 w-28 shrink-0 rounded-md bg-line-strong opacity-60" />
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-line bg-panel">
        <div className="shrink-0 border-b border-line px-4 py-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-1">
              <div className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs text-ink-dim">
                <span>All</span>
                <Skeleton className="h-2.5 w-3 rounded-sm" />
              </div>

              {statusColumns.map((status) => (
                <div
                  key={status}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-ink-dim"
                >
                  <span>{ticketStatusMeta[status].label}</span>
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
              className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0"
            >
              <Skeleton className="size-1.5 shrink-0 rounded-full" />

              <div className="min-w-0 flex-1">
                <Skeleton className="h-3.5 w-3/5 rounded" />
                <Skeleton className="mt-1.5 h-2.5 w-20 rounded sm:hidden" />
              </div>

              <Skeleton className="hidden h-4 w-14 shrink-0 rounded sm:inline-block" />
              <Skeleton className="hidden h-3 w-10 shrink-0 rounded md:inline-block" />

              <SkeletonCircle />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
