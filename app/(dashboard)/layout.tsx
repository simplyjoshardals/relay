import type { ReactNode } from "react";
import { TopBar } from "@/components/shared/TopBar";
import { currentOrgName } from "@/lib/mock-data";
import { getDevSelf } from "@/lib/dev-self";

// TODO(milestone 9): self/org will come from the authenticated session
// (README §16) once auth lands, rather than the dev role-switch cookie —
// getDevSelf() (lib/dev-self.ts) is the one place that'll need to change.

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const self = await getDevSelf();

  return (
    <div className="flex h-full flex-col">
      <TopBar orgName={currentOrgName} self={self} />

      {/* Only this content area scrolls — the TopBar above stays put.
          Shared by every route in this group (dashboard, tickets,
          incidents, services, activity) so each page only owns its own
          content. */}
      <main className="mx-auto flex w-full max-w-350 flex-1 flex-col gap-4 overflow-y-auto px-3 py-4 sm:px-6 sm:py-5">
        {children}
      </main>
    </div>
  );
}
