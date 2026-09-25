import { redirect } from "next/navigation";
import {
  QueryClient,
  HydrationBoundary,
  dehydrate,
} from "@tanstack/react-query";
import { IncidentsView } from "@/components/incidents/IncidentsView";
import { getCurrentUser } from "@/server/auth/session";
import { PATHS } from "@/utils/paths";
import { listIncidentsAction } from "@/app/(dashboard)/incidents/actions";
import { listServicesAction } from "@/app/(dashboard)/services/actions";
import {
  listOrgUsersAction,
  listTicketsAction,
} from "@/app/(dashboard)/tickets/actions";

// Milestone 5: incidents (plus the services/tickets/users it links
// against) are real now — IncidentsView fetches all of that itself via
// TanStack Query. `self` still comes from the session, same as every
// other dashboard page — IncidentsView needs it to attribute "Respond"
// to the actual signed-in user.
//
// Streaming SSR follow-up (STREAMING_SSR_TODO.md): IncidentsView
// actually runs *four* queries, not the one originally scoped for this
// item — `["incidents","list"]` for the list itself, plus
// `["services","list"]`, `["tickets","list"]`, and `["org-users","list"]`
// for the checklist/responder pickers in IncidentModal and for
// rendering each row's affected-services/linked-tickets summary. All
// four get prefetched here, same keys IncidentsView already uses, same
// request-scoped `QueryClient` pattern as Tickets/Dashboard: never the
// shared client-side instance from QueryProvider, a fresh one per
// request, dehydrated into `<HydrationBoundary>` around the unchanged
// `IncidentsView`.
//
// `IncidentsView` still calls `useQuery` with the exact same four
// keys — it finds the data already in cache on first client render
// instead of fetching it, so `isLoading` is false immediately for all
// of them. `.catch(noop)` on each swallows a failed prefetch so
// `Promise.all` still resolves; that query then hydrates as empty and
// `IncidentsView`'s own `isLoading`/`isError` branch for the incidents
// query takes over exactly as it already does today.
//
// `queryClient.query` (not the deprecated `prefetchQuery`) from the
// start here — see the note left on the `TicketsView`/`DashboardView`
// entries in STREAMING_SSR_TODO.md about why.
//
// The route's `loading.tsx` (IncidentsViewSkeleton) is what makes this
// "streaming": Next wraps this page in a Suspense boundary because
// that file exists, so the shared layout (TopBar, nav) paints
// immediately and that skeleton shows while the `Promise.all` below is
// in flight, rather than the whole document waiting on it.
const noop = () => {};

export default async function IncidentsPage() {
  const self = await getCurrentUser();
  if (!self) redirect(PATHS.LOGIN);

  const queryClient = new QueryClient();

  await Promise.all([
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
        queryKey: ["tickets", "list"],
        queryFn: listTicketsAction,
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
      <IncidentsView self={self} />
    </HydrationBoundary>
  );
}
