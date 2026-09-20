import { redirect } from "next/navigation";
import { IncidentsView } from "@/components/incidents/IncidentsView";
import { incidents, services, tickets, users } from "@/lib/mock-data";
import { getCurrentUser } from "@/server/auth/session";
import { PATHS } from "@/utils/paths";

// `self` is real now (Milestone 1). The incident/service/ticket/user
// data itself is still fake — that's Milestone 5's real query once
// auth + the API routes for this domain land (README §15 /
// implementation plan). IncidentsView already takes its data as props
// shaped like the query result, so that swap shouldn't touch the JSX
// here. There's no `resolveUser` prop: IncidentsView builds its own
// lookup from `users` instead, since a plain function can't cross the
// server/client boundary from this Server Component.

export default async function IncidentsPage() {
  const self = await getCurrentUser();
  if (!self) redirect(PATHS.LOGIN);

  return (
    <IncidentsView
      incidents={incidents}
      services={services}
      tickets={tickets}
      users={users}
      self={self}
    />
  );
}
