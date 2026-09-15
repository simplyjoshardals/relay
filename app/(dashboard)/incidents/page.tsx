"use client";

import { IncidentsView } from "@/components/incidents/IncidentsView";
import { incidents, resolveUser, services } from "@/lib/mock-data";

// TODO(milestone 9): replace the mock-data import above with a real
// org-scoped incidents query once auth + the API routes land (README §15 /
// implementation plan). IncidentsView already takes its data as props shaped
// like the query result, so that swap shouldn't touch the JSX here.

export default function IncidentsPage() {
  return (
    <IncidentsView
      incidents={incidents}
      services={services}
      resolveUser={resolveUser}
    />
  );
}
