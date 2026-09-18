import { TicketsView } from "@/components/tickets/TicketsView";
import { tickets, users } from "@/lib/mock-data";
import { getDevSelf } from "@/lib/dev-self";

// TODO(milestone 9): replace the mock-data import above with a real
// org-scoped tickets query once auth + the API routes land (README §15 /
// implementation plan). TicketsView already takes its data as props shaped
// like the query result, so that swap shouldn't touch the JSX here.
// `self` similarly comes from getDevSelf() (a cookie) until real sessions
// exist — see lib/dev-self.ts. Note there's no `resolveUser` prop: this
// page is a Server Component (it needs to read the self cookie), and a
// plain function can't be passed to a Client Component — TicketsView
// builds its own lookup from `users` instead.

export default async function TicketsPage() {
  const self = await getDevSelf();

  return <TicketsView tickets={tickets} users={users} self={self} />;
}
