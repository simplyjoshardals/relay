import { ServicesView } from "@/components/services/ServicesView";
import { incidents, services } from "@/lib/mock-data";
import { getDevSelf } from "@/lib/dev-self";

// TODO(milestone 9): replace the mock-data import above with a real
// org-scoped services query (plus the telemetry-driven realtime updates
// from README §13) once auth + the API routes land. ServicesView already
// takes its data as props shaped like the query result, so that swap
// shouldn't touch the JSX here. `self` similarly comes from getDevSelf()
// (a cookie) until real sessions exist — see lib/dev-self.ts; it's what
// gates the Manager-only "New service" / edit affordances added in
// Phase 3 (ROADMAP_ROLES.md).

export default async function ServicesPage() {
  const self = await getDevSelf();

  return <ServicesView services={services} incidents={incidents} self={self} />;
}
