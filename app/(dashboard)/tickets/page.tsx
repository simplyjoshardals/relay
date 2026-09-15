"use client";

import { TicketsView } from "@/components/tickets/TicketsView";
import { resolveUser, tickets } from "@/lib/mock-data";

// TODO(milestone 9): replace the mock-data import above with a real
// org-scoped tickets query once auth + the API routes land (README §15 /
// implementation plan). TicketsView already takes its data as props shaped
// like the query result, so that swap shouldn't touch the JSX here.

export default function TicketsPage() {
  return <TicketsView tickets={tickets} resolveUser={resolveUser} />;
}
