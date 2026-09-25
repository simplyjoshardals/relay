import {
  Skeleton,
  SkeletonCircle,
  SkeletonText,
} from "@/components/shared/Skeleton";

const ROW_COUNT = 6;

/**
 * TeamPage's `loading.tsx` fallback (STREAMING_SSR_TODO.md), same role
 * as the earlier view skeletons: a plain Server Component with zero
 * queries of its own, shown the moment navigation starts while
 * `team/page.tsx`'s server-side prefetch is still in flight, then
 * swapped out for the real, already-hydrated `TeamView` once that
 * resolves.
 *
 * Unlike `ServicesViewSkeleton`, no permission gap to work around
 * here: `team/page.tsx` gates the whole *page* server-side
 * (`canManageTeam` → `redirect()`), not just one button within an
 * otherwise-shared view, so anyone who actually sees this fallback
 * for more than an instant is already a Manager — the "Invite member"
 * button is safe to render unconditionally. (A Member briefly sees
 * this fallback too, for the instant before the page's own redirect
 * resolves — same as any Suspense fallback ahead of a redirect — but
 * it's structural only, no real names or emails, so there's nothing
 * to leak.)
 *
 * Mirrors `TeamView`'s layout (header, search box, member rows shaped
 * like the real row — avatar, name/email, role-select placeholder,
 * remove-button placeholder). No filter pills here — `TeamView` only
 * has the search box, unlike the ticket/incident/service/activity
 * views.
 */
export function TeamViewSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex shrink-0 items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-medium text-ink">Team</h1>
          <SkeletonText width="w-24" className="mt-1.5 h-3" />
        </div>

        <div className="h-8 w-36 shrink-0 rounded-md bg-line-strong opacity-60" />
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-line bg-panel">
        <div className="shrink-0 border-b border-line px-4 py-3">
          <Skeleton className="h-8 w-full rounded-md sm:w-64" />
        </div>

        <ul className="min-h-0 flex-1 overflow-y-auto">
          {Array.from({ length: ROW_COUNT }).map((_, i) => (
            <li
              key={i}
              className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0"
            >
              <SkeletonCircle />

              <div className="min-w-0 flex-1">
                <Skeleton className="h-3.5 w-28 rounded" />
                <Skeleton className="mt-1.5 h-2.5 w-36 rounded" />
              </div>

              <Skeleton className="h-8 w-32 shrink-0 rounded-md" />
              <Skeleton className="h-3 w-12 shrink-0 rounded" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
