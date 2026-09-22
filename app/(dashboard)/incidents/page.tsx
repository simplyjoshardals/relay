import { redirect } from "next/navigation";
import { IncidentsView } from "@/components/incidents/IncidentsView";
import { getCurrentUser } from "@/server/auth/session";
import { PATHS } from "@/utils/paths";

// Milestone 5: incidents (plus the services/tickets/users it links
// against) are real now — IncidentsView fetches all of that itself via
// TanStack Query, same as TicketsView/ServicesView, rather than this
// Server Component threading mock-data props through. `self` is the one
// thing that still comes from here: it's already a real session lookup
// (Milestone 1) and IncidentsView needs it to attribute "Respond" to
// the actual signed-in user.

export default async function IncidentsPage() {
  const self = await getCurrentUser();
  if (!self) redirect(PATHS.LOGIN);

  return <IncidentsView self={self} />;
}
