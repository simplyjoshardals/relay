import { redirect } from "next/navigation";
import {
  QueryClient,
  HydrationBoundary,
  dehydrate,
} from "@tanstack/react-query";
import { ServicesView } from "@/components/services/ServicesView";
import { getCurrentUser } from "@/server/auth/session";
import { PATHS } from "@/utils/paths";
import { listServicesAction } from "@/app/(dashboard)/services/actions";
import { listIncidentsAction } from "@/app/(dashboard)/incidents/actions";

// Milestone 4: services are real — ServicesView fetches them itself via
// TanStack Query (listServicesAction as the queryFn, §10). Milestone 5:
// incidents are real too, and ServicesView fetches those itself as well
// (listIncidentsAction) to show which active incidents affect a given
// service. `self` still comes from the session and gates the
// Manager-only "New service" / edit affordances
// (lib/permissions.ts#canManageServices).
//
// Streaming SSR follow-up (STREAMING_SSR_TODO.md): ServicesView
// actually runs *two* queries, not the one originally scoped for this
// item — `["services","list"]` for the list itself and
// `["incidents","list"]` for the "affecting incidents" list on each
// card — same discrepancy as Tickets/Incidents before it. Both get
// prefetched here, same keys ServicesView already uses, same
// request-scoped `QueryClient` pattern as the earlier pages:
// `queryClient.query(...).catch(noop)` from the start (not the
// deprecated `prefetchQuery` — see the note on the `TicketsView`/
// `DashboardView` entries in STREAMING_SSR_TODO.md), dehydrated into
// `<HydrationBoundary>` around the unchanged `ServicesView`.
//
// `ServicesView` still calls `useQuery` with the exact same two keys —
// it finds the data already in cache on first client render instead of
// fetching it, so `isLoading` is false immediately for both. A failed
// prefetch is swallowed by `.catch(noop)` so `Promise.all` still
// resolves; that query then hydrates as empty and `ServicesView`'s own
// `isLoading`/`isError` branch for the services query takes over
// exactly as it already does today.
//
// The route's `loading.tsx` (ServicesViewSkeleton) is what makes this
// "streaming": Next wraps this page in a Suspense boundary because that
// file exists, so the shared layout (TopBar, nav) paints immediately
// and that skeleton shows while the `Promise.all` below is in flight,
// rather than the whole document waiting on it. See
// ServicesViewSkeleton's own doc comment for why the Manager-only "New
// service" button is deliberately left out of that fallback rather than
// guessed either way.
const noop = () => {};

export default async function ServicesPage() {
  const self = await getCurrentUser();
  if (!self) redirect(PATHS.LOGIN);

  const queryClient = new QueryClient();

  await Promise.all([
    queryClient
      .query({
        queryKey: ["services", "list"],
        queryFn: listServicesAction,
      })
      .catch(noop),
    queryClient
      .query({
        queryKey: ["incidents", "list"],
        queryFn: listIncidentsAction,
      })
      .catch(noop),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ServicesView self={self} />
    </HydrationBoundary>
  );
}
