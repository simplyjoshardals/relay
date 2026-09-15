import { StatRow } from "@/components/dashboard/StatRow";
import { IncidentsPanel } from "@/components/dashboard/IncidentsPanel";
import { ServiceHealthGrid } from "@/components/dashboard/ServiceHealthGrid";
import { TicketBoard } from "@/components/dashboard/TicketBoard";
import { PresenceRail } from "@/components/dashboard/PresenceRail";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import {
  activities,
  incidents,
  onlineUserIds,
  resolveUser,
  services,
  tickets,
  users,
} from "@/lib/mock-data";

// TODO(milestone 9): replace the mock-data import above with real
// org-scoped queries once auth + the API routes land (README §15 /
// implementation plan). Every component below already takes its data as
// props shaped like the query result, so that swap shouldn't touch JSX.

export default function DashboardPage() {
  const openTickets = tickets.filter((t) => t.status === "OPEN").length;
  const inProgressTickets = tickets.filter(
    (t) => t.status === "IN_PROGRESS",
  ).length;
  // Resolved incidents now exist in the data (added for the standalone
  // incidents page's history view), so this can no longer just be
  // `incidents.length` — the dashboard only ever wants the ones still
  // open. IncidentsPanel is built the same way: its "No active incidents"
  // empty state assumes the caller already filtered, it doesn't re-check.
  const activeIncidentsList = incidents.filter((i) => i.status !== "RESOLVED");
  const activeIncidents = activeIncidentsList.length;
  const unhealthyServices = services.filter(
    (s) => s.status !== "OPERATIONAL",
  ).length;

  return (
    <>
      <StatRow
        stats={[
          { label: "Open tickets", value: openTickets },
          { label: "In progress", value: inProgressTickets },
          {
            label: "Active incidents",
            value: activeIncidents,
            tone: "danger",
          },
          {
            label: "Degraded / outage",
            value: unhealthyServices,
            tone: "warning",
          },
          { label: "Online now", value: onlineUserIds.size },
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
          />
          <ServiceHealthGrid services={services} />
          <TicketBoard tickets={tickets} resolveUser={resolveUser} />
        </div>

        <div className="flex flex-col gap-4 min-w-0">
          <PresenceRail users={users} onlineIds={onlineUserIds} />
          <ActivityFeed activities={activities} resolveUser={resolveUser} />
        </div>
      </div>
    </>
  );
}
