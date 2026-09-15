import { TopBar } from "@/components/dashboard/TopBar";
import { StatRow } from "@/components/dashboard/StatRow";
import { IncidentsPanel } from "@/components/dashboard/IncidentsPanel";
import { ServiceHealthGrid } from "@/components/dashboard/ServiceHealthGrid";
import { TicketBoard } from "@/components/dashboard/TicketBoard";
import { PresenceRail } from "@/components/dashboard/PresenceRail";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import {
  activities,
  currentOrgName,
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
  const self = users[0];

  const openTickets = tickets.filter((t) => t.status === "OPEN").length;
  const inProgressTickets = tickets.filter(
    (t) => t.status === "IN_PROGRESS",
  ).length;
  const activeIncidents = incidents.length;
  const unhealthyServices = services.filter(
    (s) => s.status !== "OPERATIONAL",
  ).length;

  return (
    <div className="flex h-full flex-col">
      <TopBar orgName={currentOrgName} self={self} />

      {/* Only this content area scrolls — the TopBar above stays put. */}
      <main className="mx-auto flex w-full max-w-350 flex-1 flex-col gap-4 overflow-y-auto px-3 py-4 sm:px-6 sm:py-5">
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
              incidents={incidents}
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
      </main>
    </div>
  );
}
