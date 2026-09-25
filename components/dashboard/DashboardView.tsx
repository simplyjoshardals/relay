"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { StatRow } from "@/components/dashboard/StatRow";
import { IncidentsPanel } from "@/components/dashboard/IncidentsPanel";
import { ServiceHealthGrid } from "@/components/dashboard/ServiceHealthGrid";
import { TicketBoard } from "@/components/dashboard/TicketBoard";
import { PresenceRail } from "@/components/dashboard/PresenceRail";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import {
  useOnlineUserIds,
  usePresenceReady,
  useRealtimeStatus,
} from "@/components/shared/RealtimeProvider";
import {
  listOrgUsersAction,
  listTicketsAction,
} from "@/app/(dashboard)/tickets/actions";
import { listIncidentsAction } from "@/app/(dashboard)/incidents/actions";
import { listServicesAction } from "@/app/(dashboard)/services/actions";
import { listActivityAction } from "@/app/(dashboard)/activity/actions";
import type { Activity, Incident, Service, Ticket, User } from "@/types";

// Stable empty-array fallbacks, same reasoning as TicketsView's
// EMPTY_TICKETS/EMPTY_USERS: a fresh `?? []` every render would defeat
// the useMemo()s below.
const EMPTY_TICKETS: Ticket[] = [];
const EMPTY_INCIDENTS: Incident[] = [];
const EMPTY_SERVICES: Service[] = [];
const EMPTY_USERS: User[] = [];
const EMPTY_ACTIVITIES: Activity[] = [];

// How many recent events the dashboard's compact Activity panel shows —
// the full history lives on the dedicated Activity page
// (components/activity/ActivityView.tsx); this panel is a glance, not
// another feed to scroll.
const DASHBOARD_ACTIVITY_COUNT = 8;

/**
 * Milestone 9: the dashboard was already fully built visually against
 * mock data (every panel §15 asks for existed) — this is exactly the
 * `TODO(milestone 9)` swap the old Server Component page anticipated,
 * moved into its own client component because the query hooks it swaps
 * in (`useQuery`) only run client-side.
 *
 * Every query below reuses the *exact* key each prior milestone's own
 * view already established (TicketsView, IncidentsView, ServicesView,
 * ActivityView, PresenceRail) — same cache entries, so this never
 * double-fetches anything a user already has another tab of open, and
 * `RealtimeProvider`'s existing per-domain invalidation
 * (`ticket.updated`, `incident.updated`, `service.updated`,
 * `activity.created`) keeps this page current for free, no new realtime
 * wiring needed. The one new key, `["activity", "list", "recent"]`,
 * still starts with `["activity", "list"]` so it's covered by that same
 * `activity.created` invalidation (TanStack matches by prefix).
 *
 * Presence (Milestone 7) was already fully real and self-contained —
 * `PresenceRail` renders itself — the only remaining piece is reading
 * `useOnlineUserIds()` here too, to restore the "Online now" stat that
 * M7 dropped rather than leave on stale mock data (its own doc comment
 * flagged this as this milestone's job).
 *
 * No props: nothing here needs `self` — every panel is read-only, no
 * mutations happen on the dashboard itself.
 *
 * Every query's `isError` is wired through to its panel(s) (and to the
 * matching StatRow entries), each with its own "Try again" → `refetch()`
 * — unlike TicketsView/IncidentsView/ServicesView/ActivityView/TeamView,
 * which fail as a single page and so only need one error branch each,
 * a failed query here must not read as "0 active incidents, everything
 * healthy" just because the other four panels loaded fine.
 *
 * Streaming SSR follow-up (STREAMING_SSR_TODO.md): `dashboard/page.tsx`
 * now prefetches every query below on the server and hydrates this
 * component's cache before it ever mounts client-side — see that
 * file's doc comment for the mechanism. Nothing here changed for it;
 * the same `useQuery` calls just find data already in cache on first
 * render instead of fetching it.
 */
export function DashboardView() {
  const ticketsQuery = useQuery({
    queryKey: ["tickets", "list"],
    queryFn: listTicketsAction,
  });

  const incidentsQuery = useQuery({
    queryKey: ["incidents", "list"],
    queryFn: listIncidentsAction,
  });

  const servicesQuery = useQuery({
    queryKey: ["services", "list"],
    queryFn: listServicesAction,
  });

  const usersQuery = useQuery({
    queryKey: ["org-users", "list"],
    queryFn: listOrgUsersAction,
  });

  const activityQuery = useQuery({
    queryKey: ["activity", "list", "recent"],
    queryFn: () => listActivityAction(),
  });

  const onlineIds = useOnlineUserIds();
  const presenceReady = usePresenceReady();
  const realtimeStatus = useRealtimeStatus();

  const tickets = ticketsQuery.data ?? EMPTY_TICKETS;
  const incidents = incidentsQuery.data ?? EMPTY_INCIDENTS;
  const services = servicesQuery.data ?? EMPTY_SERVICES;
  const users = usersQuery.data ?? EMPTY_USERS;
  const activities = activityQuery.data?.items ?? EMPTY_ACTIVITIES;

  const userById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const resolveUser = (id: string | null): User | null =>
    id ? (userById.get(id) ?? null) : null;

  // Same "the dashboard only ever wants the still-open ones" filter the
  // old mock-data version used — IncidentsPanel's empty state assumes
  // the caller already filtered.
  const activeIncidentsList = useMemo(
    () => incidents.filter((i) => i.status !== "RESOLVED"),
    [incidents],
  );

  const recentActivities = useMemo(
    () => activities.slice(0, DASHBOARD_ACTIVITY_COUNT),
    [activities],
  );

  const openTickets = tickets.filter((t) => t.status === "OPEN").length;
  const inProgressTickets = tickets.filter(
    (t) => t.status === "IN_PROGRESS",
  ).length;
  const unhealthyServices = services.filter(
    (s) => s.status !== "OPERATIONAL",
  ).length;

  return (
    <>
      <StatRow
        stats={[
          {
            label: "Open tickets",
            value: ticketsQuery.isLoading ? null : openTickets,
            error: ticketsQuery.isError,
          },
          {
            label: "In progress",
            value: ticketsQuery.isLoading ? null : inProgressTickets,
            error: ticketsQuery.isError,
          },
          {
            label: "Active incidents",
            value: incidentsQuery.isLoading ? null : activeIncidentsList.length,
            tone: "danger",
            error: incidentsQuery.isError,
          },
          {
            label: "Degraded / outage",
            value: servicesQuery.isLoading ? null : unhealthyServices,
            tone: "warning",
            error: servicesQuery.isError,
          },
          // Unlike the four stats above, this one can't be prefetched:
          // presence is live socket state, so on a cold load there is
          // genuinely nothing to show until the channel has joined and
          // synced. Until then it's a skeleton (never "0" — that reads
          // as "nobody's online" and then visibly corrects itself). If
          // the connection is down instead of just starting up, "—"
          // rather than a skeleton that would never resolve.
          {
            label: "Online now",
            value: presenceReady ? onlineIds.size : null,
            error: !presenceReady && realtimeStatus !== "connecting",
          },
        ]}
      />

      {/* Side-by-side only once there's room for both columns to
          breathe; below that, the rail just drops beneath the main
          content instead of squeezing next to it. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2.2fr_1fr] lg:items-start">
        <div className="flex flex-col gap-4 min-w-0">
          <IncidentsPanel
            incidents={activeIncidentsList}
            services={services}
            resolveUser={resolveUser}
            loading={incidentsQuery.isLoading || servicesQuery.isLoading}
            error={incidentsQuery.isError || servicesQuery.isError}
            onRetry={() => {
              incidentsQuery.refetch();
              servicesQuery.refetch();
            }}
          />
          <ServiceHealthGrid
            services={services}
            loading={servicesQuery.isLoading}
            error={servicesQuery.isError}
            onRetry={() => servicesQuery.refetch()}
          />
          <TicketBoard
            tickets={tickets}
            resolveUser={resolveUser}
            loading={ticketsQuery.isLoading}
            error={ticketsQuery.isError}
            onRetry={() => ticketsQuery.refetch()}
          />
        </div>

        <div className="flex flex-col gap-4 min-w-0">
          <PresenceRail />
          <ActivityFeed
            activities={recentActivities}
            resolveUser={resolveUser}
            loading={activityQuery.isLoading}
            error={activityQuery.isError}
            onRetry={() => activityQuery.refetch()}
          />
        </div>
      </div>
    </>
  );
}
