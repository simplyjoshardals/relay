import { redirect } from "next/navigation";
import { ServicesView } from "@/components/services/ServicesView";
import { incidents, services } from "@/lib/mock-data";
import { getCurrentUser } from "@/server/auth/session";
import { PATHS } from "@/utils/paths";

// `self` is real now (Milestone 1). The service catalog itself
// (`incidents`, `services`, from mock-data) is still fake — that's
// Milestone 4's real query, plus the telemetry worker's realtime
// updates (README §13) — once auth + the API routes for this domain
// land. ServicesView already takes its data as props shaped like the
// query result, so that swap shouldn't touch the JSX here. `self` is
// what gates the Manager-only "New service" / edit affordances added
// in Phase 3 (ROADMAP_ROLES.md).

export default async function ServicesPage() {
  const self = await getCurrentUser();
  if (!self) redirect(PATHS.LOGIN);

  return <ServicesView services={services} incidents={incidents} self={self} />;
}
