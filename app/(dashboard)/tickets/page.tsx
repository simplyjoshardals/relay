import { redirect } from "next/navigation";
import { TicketsView } from "@/components/tickets/TicketsView";
import { tickets, users } from "@/lib/mock-data";
import { getCurrentUser } from "@/server/auth/session";
import { PATHS } from "@/utils/paths";

// `self` is real now (Milestone 1). The ticket/user data itself is
// still fake — that's Milestone 2's real org-scoped query once auth +
// the API routes for this domain land (README §15 / implementation
// plan). TicketsView already takes its data as props shaped like the
// query result, so that swap shouldn't touch the JSX here. There's no
// `resolveUser` prop: TicketsView builds its own lookup from `users`
// instead, since a plain function can't cross the server/client
// boundary from this Server Component.

export default async function TicketsPage() {
  const self = await getCurrentUser();
  if (!self) redirect(PATHS.LOGIN);

  return <TicketsView tickets={tickets} users={users} self={self} />;
}
