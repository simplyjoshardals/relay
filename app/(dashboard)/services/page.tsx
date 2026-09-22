import { redirect } from "next/navigation";
import { ServicesView } from "@/components/services/ServicesView";
import { getCurrentUser } from "@/server/auth/session";
import { PATHS } from "@/utils/paths";

// Milestone 4: services are real — ServicesView fetches them itself via
// TanStack Query (listServicesAction as the queryFn, §10), same as
// TicketsView, so this page doesn't fetch or pass service data down.
// Milestone 5: incidents are real too now, and ServicesView fetches
// those itself as well (listIncidentsAction) to show which active
// incidents affect a given service — this page no longer threads mock
// incident data through either. `self` still comes from the session and
// gates the Manager-only "New service" / edit affordances
// (lib/permissions.ts#canManageServices).

export default async function ServicesPage() {
  const self = await getCurrentUser();
  if (!self) redirect(PATHS.LOGIN);

  return <ServicesView self={self} />;
}
