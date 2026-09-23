import { ActivityView } from "@/components/activity/ActivityView";

// Milestone 6: activity is real now — ActivityView fetches it itself
// via TanStack Query's useInfiniteQuery (listActivityAction as the
// paginated queryFn, §10/AC-05), same self-fetching shape
// IncidentsView/ServicesView already settled on, so this page no
// longer needs the mock-data import or any props. No auth guard here
// either: DashboardLayout (app/(dashboard)/layout.tsx) already gates
// every route in this group, and ActivityView doesn't need a `self`
// prop the way IncidentsView/ServicesView do.

export default function ActivityPage() {
  return <ActivityView />;
}
