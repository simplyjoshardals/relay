import { redirect } from "next/navigation";
import { TicketsView } from "@/components/tickets/TicketsView";
import { getCurrentUser } from "@/server/auth/session";
import { PATHS } from "@/utils/paths";

// Milestone 2: tickets are real now — TicketsView fetches them itself
// via TanStack Query (listTicketsAction as the queryFn, §10), so this
// page no longer needs to fetch or pass ticket data down at all. `self`
// still comes from the session, same as every other dashboard page.

export default async function TicketsPage() {
  const self = await getCurrentUser();
  if (!self) redirect(PATHS.LOGIN);

  return <TicketsView self={self} />;
}
