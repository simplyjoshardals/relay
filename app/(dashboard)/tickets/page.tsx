import { redirect } from "next/navigation";
import {
  QueryClient,
  HydrationBoundary,
  dehydrate,
} from "@tanstack/react-query";
import { TicketsView } from "@/components/tickets/TicketsView";
import { getCurrentUser } from "@/server/auth/session";
import { PATHS } from "@/utils/paths";
import {
  listOrgUsersAction,
  listTicketsAction,
} from "@/app/(dashboard)/tickets/actions";

// Milestone 2: tickets are real now — TicketsView fetches them itself
// via TanStack Query (listTicketsAction as the queryFn, §10). `self`
// still comes from the session, same as every other dashboard page.
//
// Streaming SSR follow-up (STREAMING_SSR_TODO.md): TicketsView actually
// runs two queries — `["tickets","list"]` for the list itself and
// `["org-users","list"]` to resolve assignees/render the "Assign to
// me" picker — so both get prefetched here, same as dashboard/page.tsx
// prefetches "org-users" alongside its other four. Doing only the
// tickets query would still flicker every assignee avatar in on a
// cold load.
//
// Same request-scoped `QueryClient` pattern as the dashboard: never
// the shared client-side instance from QueryProvider, a fresh one per
// request, dehydrated into `<HydrationBoundary>` around the unchanged
// `TicketsView`. `TicketsView` still calls `useQuery` with the exact
// same two keys — it finds the data already in cache on first client
// render instead of fetching it, so `isLoading` is false immediately.
// If a prefetch fails, the `.catch(noop)` below (per this TanStack
// Query version's own deprecation note — see below) swallows it so
// `Promise.all` still resolves; that query then hydrates as empty and
// `TicketsView`'s own `isLoading`/`isError` branch for the tickets
// query takes over exactly as it already does today.
//
// The route's `loading.tsx` (TicketsViewSkeleton) is what makes this
// "streaming": Next wraps this page in a Suspense boundary because
// that file exists, so the shared layout (TopBar, nav) paints
// immediately and that skeleton shows while the `Promise.all` below is
// in flight, rather than the whole document waiting on it.
//
// `queryClient.prefetchQuery` is deprecated as of this installed
// version (5.103.2) in favor of `queryClient.query`, which fetches and
// caches the same way but *throws* on failure instead of swallowing
// the error — so `.catch(noop)` here is what restores the old
// "one failed prefetch doesn't sink the others" behavior; it's the
// exact fix the deprecation notice itself points to, not a workaround.
const noop = () => {};

export default async function TicketsPage() {
  const self = await getCurrentUser();
  if (!self) redirect(PATHS.LOGIN);

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
        queryKey: ["org-users", "list"],
        queryFn: listOrgUsersAction,
      })
      .catch(noop),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <TicketsView self={self} />
    </HydrationBoundary>
  );
}
