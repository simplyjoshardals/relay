import {
  QueryClient,
  HydrationBoundary,
  dehydrate,
} from "@tanstack/react-query";
import { ActivityView } from "@/components/activity/ActivityView";
import { listActivityAction } from "@/app/(dashboard)/activity/actions";
import { listOrgUsersAction } from "@/app/(dashboard)/tickets/actions";

// Milestone 6: activity is real — ActivityView fetches it itself via
// TanStack Query's useInfiniteQuery (listActivityAction as the
// paginated queryFn, §10/AC-05), plus org users (listOrgUsersAction,
// to resolve `actorId` → display name). No auth guard here either,
// same reasoning as before: DashboardLayout already gates every route
// in this group, and ActivityView doesn't need a `self` prop the way
// IncidentsView/ServicesView do.
//
// Streaming SSR follow-up (STREAMING_SSR_TODO.md): same "actually two
// queries" correction as Tickets/Incidents/Services before it —
// `["activity","list"]` (the infinite query) and `["org-users","list"]`
// both get prefetched here, same keys `ActivityView` already uses.
// The activity one is the first of these pages to need
// `queryClient.infiniteQuery` instead of `queryClient.query` — same
// deprecated-`prefetchQuery`-avoidance reasoning as the earlier pages
// (see the note on the `TicketsView`/`DashboardView` entries in
// STREAMING_SSR_TODO.md), just the infinite-query sibling of it.
// `infiniteQuery` fetches only the first page unless told otherwise
// (no `pages` option passed here), which is exactly what's wanted:
// `ActivityView`'s own `useInfiniteQuery` — same `queryKey`,
// `queryFn`, and `initialPageParam` — finds that first page already
// cached on first client render (`isLoading` false immediately), then
// drives `fetchNextPage()`/`hasNextPage` from there exactly as it
// already does today. Note this is a *different* key from the
// dashboard's own `["activity","list","recent"]` prefetch — that one
// is `DashboardView`'s separate, non-paginated "recent activity"
// query for its glance panel, not this one.
//
// `.catch(noop)` on both swallows a failed prefetch so `Promise.all`
// still resolves; that query then hydrates as empty and
// `ActivityView`'s own `isLoading`/`isError` branch for the activity
// query takes over exactly as it already does today.
//
// The route's `loading.tsx` (ActivityViewSkeleton) is what makes this
// "streaming": Next wraps this page in a Suspense boundary because
// that file exists, so the shared layout (TopBar, nav) paints
// immediately and that skeleton shows while the `Promise.all` below is
// in flight, rather than the whole document waiting on it.
const noop = () => {};

export default async function ActivityPage() {
  const queryClient = new QueryClient();

  await Promise.all([
    queryClient
      .infiniteQuery({
        queryKey: ["activity", "list"],
        queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
          listActivityAction(pageParam),
        initialPageParam: undefined as string | undefined,
      })
      .catch(noop),
    queryClient
      .query({
        queryKey: ["org-users", "list"],
        queryFn: listOrgUsersAction,
      })
      .catch(noop),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ActivityView />
    </HydrationBoundary>
  );
}
