import { StatRow } from "@/components/dashboard/StatRow";
import { IncidentsPanelSkeleton } from "@/components/dashboard/IncidentsPanel";
import { ServiceHealthGridSkeleton } from "@/components/dashboard/ServiceHealthGrid";
import { TicketBoardSkeleton } from "@/components/dashboard/TicketBoard";
import { PresenceRailSkeleton } from "@/components/dashboard/PresenceRail";
import { ActivityFeedSkeleton } from "@/components/dashboard/ActivityFeed";

/**
 * The dashboard route's `loading.tsx` fallback. A plain Server
 * Component, not `DashboardView` itself — it needs to be a static shell
 * with zero queries of its own, shown the moment navigation starts
 * while `dashboard/page.tsx`'s server-side prefetch is still in flight,
 * then swapped out for the real, already-hydrated `DashboardView` once
 * that resolves. Rendering `DashboardView` here instead would just
 * recreate the original client-fetch flicker this route was built to
 * avoid.
 *
 * Mirrors `DashboardView`'s exact layout (same grid, same panels in the
 * same order) so nothing shifts position when the real content
 * replaces it — every one of these skeleton pieces is the same
 * component each panel already shows while its own query is
 * `isLoading`, just reused here with no query behind it at all.
 */
export function DashboardSkeleton() {
  return (
    <>
      <StatRow
        stats={[
          { label: "Open tickets", value: null },
          { label: "In progress", value: null },
          { label: "Active incidents", value: null, tone: "danger" },
          { label: "Degraded / outage", value: null, tone: "warning" },
          { label: "Online now", value: null },
        ]}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2.2fr_1fr] lg:items-start">
        <div className="flex flex-col gap-4 min-w-0">
          <IncidentsPanelSkeleton />
          <ServiceHealthGridSkeleton />
          <TicketBoardSkeleton />
        </div>

        <div className="flex flex-col gap-4 min-w-0">
          <PresenceRailSkeleton />
          <ActivityFeedSkeleton />
        </div>
      </div>
    </>
  );
}
