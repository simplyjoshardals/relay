"use client";

import { ServicesView } from "@/components/services/ServicesView";
import { incidents, services } from "@/lib/mock-data";

// TODO(milestone 9): replace the mock-data import above with a real
// org-scoped services query (plus the telemetry-driven realtime updates
// from README §13) once auth + the API routes land. ServicesView already
// takes its data as props shaped like the query result, so that swap
// shouldn't touch the JSX here.

export default function ServicesPage() {
  return <ServicesView services={services} incidents={incidents} />;
}
