import { TeamViewSkeleton } from "@/components/team/TeamViewSkeleton";

// Next's file convention for a route-level Suspense boundary: this
// wraps `page.tsx` in a `<Suspense>` automatically, so the shared
// layout (TopBar, nav) streams and paints immediately while
// `team/page.tsx`'s server-side auth check and query prefetch are
// still in flight, showing this in the meantime instead of blocking
// the whole document behind it. Same pattern as the other list pages'
// loading.tsx.
export default function TeamLoading() {
  return <TeamViewSkeleton />;
}
