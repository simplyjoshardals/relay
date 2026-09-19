import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { TopBar } from "@/components/shared/TopBar";
import { ToastProvider } from "@/components/shared/Toast";
import { currentOrgName } from "@/lib/mock-data";
import { getDevSelf, hasDevSession } from "@/lib/dev-self";
import { PATHS } from "@/utils/paths";

// TODO(milestone 9): self/org will come from the authenticated session
// (README §16) once auth lands, rather than the dev role-switch cookie —
// getDevSelf() (lib/dev-self.ts) is the one place that'll need to change.
//
// The hasDevSession() check below is the actual sign-in gate — it
// protects every route in this group even on a direct navigation (typing
// /tickets straight into the address bar), not just the root page's
// redirect. getDevSelf() itself always resolves to *someone* (defaults
// to a Manager) precisely so pages inside this already-gated layout don't
// each need their own null check — the gate is here, once.

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  if (!(await hasDevSession())) {
    redirect(PATHS.LOGIN);
  }

  const self = await getDevSelf();

  return (
    <ToastProvider>
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
    </ToastProvider>
  );
}
