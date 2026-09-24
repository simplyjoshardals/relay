import { DashboardView } from "@/components/dashboard/DashboardView";

// Milestone 9: the dashboard is real now — DashboardView fetches
// tickets, incidents, services, org users, and recent activity itself
// via TanStack Query (same query keys TicketsView/IncidentsView/
// ServicesView/ActivityView already established, so this shares their
// cache and their existing realtime invalidation for free), same
// self-fetching shape those views settled on. No auth guard here
// either, same reasoning as ActivityPage: DashboardLayout
// (app/(dashboard)/layout.tsx) already gates every route in this group,
// and DashboardView doesn't need a `self` prop the way
// TicketsView/IncidentsView/ServicesView do — every panel here is
// read-only, no mutations happen on the dashboard itself.

export default function DashboardPage() {
  return <DashboardView />;
}
