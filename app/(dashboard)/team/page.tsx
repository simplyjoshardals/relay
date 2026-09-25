import { redirect } from "next/navigation";
import {
  QueryClient,
  HydrationBoundary,
  dehydrate,
} from "@tanstack/react-query";
import { TeamView } from "@/components/team/TeamView";
import { getCurrentUser } from "@/server/auth/session";
import { canManageTeam } from "@/lib/permissions";
import { PATHS } from "@/utils/paths";
import { listOrgUsersAction } from "@/app/(dashboard)/tickets/actions";
import { listPendingInvitationsAction } from "@/app/(dashboard)/team/actions";

// Milestone 10: the roster and pending invitations are real now —
// `TeamView` self-fetches them (listOrgUsersAction /
// listPendingInvitationsAction) the same way IncidentsView and
// ServicesView do, so this page only resolves `self`, gates access,
// and (as of this streaming SSR pass) prefetches both queries.
//
// The redirect below is the actual enforcement of the Manager-only gate
// for the *page* (ROADMAP_ROLES.md Phase 3) — TopBar hiding the nav link
// for Member is just the UX nicety on top of it. Every team *action* is
// separately gated server-side (server/application/users.ts,
// invitations.ts), so reaching the page isn't what protects the data.
//
// Streaming SSR follow-up (STREAMING_SSR_TODO.md): unlike
// Tickets/Incidents/Services/Activity before it, the TODO's original
// "two queries" note for this one was already accurate —
// `["org-users","list"]` (shared with every other view that queries
// the roster) and `["team","invitations"]`. Both get prefetched here
// in parallel, same keys `TeamView` already uses,
// `queryClient.query(...).catch(noop)` from the start (not the
// deprecated `prefetchQuery` — see the note on the earlier entries in
// STREAMING_SSR_TODO.md), into a request-scoped `QueryClient`,
// dehydrated into `<HydrationBoundary>` around the unchanged
// `TeamView`.
//
// `TeamView` still calls `useQuery` with the exact same two keys — it
// finds the data already in cache on first client render instead of
// fetching it, so `isLoading` is false immediately. `.catch(noop)` on
// each swallows a failed prefetch so `Promise.all` still resolves;
// that query then hydrates as empty and `TeamView`'s own
// `isLoading`/`isError` branch for the users query takes over exactly
// as it already does today.
//
// The route's `loading.tsx` (TeamViewSkeleton) is what makes this
// "streaming": Next wraps this page in a Suspense boundary because
// that file exists, so the shared layout (TopBar, nav) paints
// immediately and that skeleton shows while `getCurrentUser()` and the
// `Promise.all` below are still in flight, rather than the whole
// document waiting on either.
const noop = () => {};

export default async function TeamPage() {
  const self = await getCurrentUser();
  if (!self) redirect(PATHS.LOGIN);

  if (!canManageTeam(self.role)) {
    redirect(PATHS.DASHBOARD);
  }

  const queryClient = new QueryClient();

  await Promise.all([
    queryClient
      .query({
        queryKey: ["org-users", "list"],
        queryFn: listOrgUsersAction,
      })
      .catch(noop),
    queryClient
      .query({
        queryKey: ["team", "invitations"],
        queryFn: listPendingInvitationsAction,
      })
      .catch(noop),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <TeamView self={self} />
    </HydrationBoundary>
  );
}
