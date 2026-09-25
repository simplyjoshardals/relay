import { IncidentsViewSkeleton } from "@/components/incidents/IncidentsViewSkeleton";

// Next's file convention for a route-level Suspense boundary: this
// wraps `page.tsx` in a `<Suspense>` automatically, so the shared
// layout (TopBar, nav) streams and paints immediately while
// `incidents/page.tsx`'s server-side query prefetch is still in
// flight, showing this in the meantime instead of blocking the whole
// document behind it. Same pattern as dashboard/loading.tsx and
// tickets/loading.tsx.
export default function IncidentsLoading() {
  return <IncidentsViewSkeleton />;
}
