"use client";

import { ActivityView } from "@/components/activity/ActivityView";
import { activities, resolveUser } from "@/lib/mock-data";

// TODO(milestone 9): replace the mock-data import above with a real
// org-scoped, cursor-paginated activity query once auth + the API routes
// land (README §15 / implementation plan). ActivityView's "Load more"
// button already models the paginated contract (AC-05 / §13) — swapping
// its client-side slicing for `fetchNextPage()` shouldn't touch the JSX.

export default function ActivityPage() {
  return <ActivityView activities={activities} resolveUser={resolveUser} />;
}
