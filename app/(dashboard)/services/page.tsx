import { redirect } from "next/navigation";
import { ServicesView } from "@/components/services/ServicesView";
import { incidents } from "@/lib/mock-data";
import { getCurrentUser } from "@/server/auth/session";
import { PATHS } from "@/utils/paths";

// Milestone 4: services are real now — ServicesView fetches them itself
// via TanStack Query (listServicesAction as the queryFn, §10), same as
// TicketsView, so this page no longer needs to fetch or pass service
// data down. `incidents` stays mock (Milestone 5's real query) — used
// only to show which active incidents affect a given service. `self`
// still comes from the session and gates the Manager-only "New service" /
// edit affordances (lib/permissions.ts#canManageServices).

export default async function ServicesPage() {
  const self = await getCurrentUser();
  if (!self) redirect(PATHS.LOGIN);

  return <ServicesView incidents={incidents} self={self} />;
}
