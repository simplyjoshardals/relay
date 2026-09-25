import {
  QueryClient,
  HydrationBoundary,
  dehydrate,
} from "@tanstack/react-query";
import { DashboardView } from "@/components/dashboard/DashboardView";
import {
  listOrgUsersAction,
  listTicketsAction,
} from "@/app/(dashboard)/tickets/actions";
import { listIncidentsAction } from "@/app/(dashboard)/incidents/actions";
import { listServicesAction } from "@/app/(dashboard)/services/actions";
import { listActivityAction } from "@/app/(dashboard)/activity/actions";

// Milestone 9 → streaming SSR follow-up (STREAMING_SSR_TODO.md): the
// dashboard's 5 queries used to start with an empty client-side cache
// every cold load — each panel would render its loading state, then
// swap to real content once its `useQuery` resolved, causing the
// layout flicker/shift this was written to fix. This page now
// prefetches all 5 on the server, in parallel, into a request-scoped
// `QueryClient` (never the shared client one from QueryProvider — a
// fresh instance per request is the documented pattern, since this
// runs during SSR, not in the browser), then dehydrates that cache
// into `<HydrationBoundary>` around the unchanged `DashboardView`.
//
// `DashboardView` still calls `useQuery` with the exact same keys —
// it finds the data already there on first client render instead of
// fetching it, so `isLoading` is false immediately. If a prefetch
// fails, the `.catch(noop)` below swallows it so `Promise.all` still
// resolves; that query then hydrates as empty (dehydrate() only
// carries over successful queries) and `DashboardView`'s own
// `isLoading`/`isError` handling (see
// StatRow/IncidentsPanel/ServiceHealthGrid/TicketBoard/ActivityFeed's
// `error` props) takes over exactly as it already does today — no
// special-casing needed here for that.
//
// The route's `loading.tsx` (DashboardSkeleton) is what actually makes
// this "streaming": Next wraps this page in a Suspense boundary because
// that file exists, so the shared layout (TopBar, nav) paints
// immediately and that skeleton shows while the `Promise.all` below is
// in flight, rather than the whole document waiting on it.
//
// No auth guard here either, same reasoning as before: DashboardLayout
// (app/(dashboard)/layout.tsx) already gates every route in this group,
// and none of these queries need `self` — every panel is read-only.
//
// `queryClient.prefetchQuery` is deprecated as of the installed
// TanStack Query version (5.103.2) in favor of `queryClient.query`,
// which fetches/caches the same way but *throws* on failure instead of
// swallowing the error — hence the `.catch(noop)` on each call below,
// which is exactly what the deprecation notice itself recommends to
// keep one failed query from sinking the whole `Promise.all`.
const noop = () => {};

export default async function DashboardPage() {
  const queryClient = new QueryClient();

  await Promise.all([
    queryClient
      .query({
        queryKey: ["tickets", "list"],
        queryFn: listTicketsAction,
      })
      .catch(noop),
    queryClient
      .query({
        queryKey: ["incidents", "list"],
        queryFn: listIncidentsAction,
      })
      .catch(noop),
    queryClient
      .query({
        queryKey: ["services", "list"],
        queryFn: listServicesAction,
      })
      .catch(noop),
    queryClient
      .query({
        queryKey: ["org-users", "list"],
        queryFn: listOrgUsersAction,
      })
      .catch(noop),
    queryClient
      .query({
        queryKey: ["activity", "list", "recent"],
        queryFn: () => listActivityAction(),
      })
      .catch(noop),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DashboardView />
    </HydrationBoundary>
  );
}
