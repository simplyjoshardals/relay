import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { TopBar } from "@/components/shared/TopBar";
import { ToastProvider } from "@/components/shared/Toast";
import { QueryProvider } from "@/components/shared/QueryProvider";
import { RealtimeProvider } from "@/components/shared/RealtimeProvider";
import { ConnectionBanner } from "@/components/shared/ConnectionBanner";
import { currentOrgName } from "@/lib/mock-data";
import { getCurrentUser } from "@/server/auth/session";
import { PATHS } from "@/utils/paths";

// The getCurrentUser() check below is the actual sign-in gate — it
// protects every route in this group even on a direct navigation (typing
// /tickets straight into the address bar), not just the root page's
// redirect. It covers both "no session at all" and the edge case of a
// still-valid access token whose underlying user record no longer
// exists — either way, no user means no admission. Because the gate is
// here once, every page inside this layout can treat `self` as always
// present, no per-page null check needed.

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const self = await getCurrentUser();

  if (!self) {
    redirect(PATHS.LOGIN);
  }

  return (
    <QueryProvider>
      <RealtimeProvider orgId={self.orgId}>
        <ToastProvider>
          <div className="flex h-full flex-col">
            <TopBar orgName={currentOrgName} self={self} />

            {/* Only this content area scrolls — the TopBar above stays put.
                Shared by every route in this group (dashboard, tickets,
                incidents, services, activity) so each page only owns its own
                content. */}
            <main className="mx-auto flex w-full max-w-350 flex-1 flex-col gap-4 overflow-y-auto px-3 py-4 sm:px-6 sm:py-5">
              <ConnectionBanner />
              {children}
            </main>
          </div>
        </ToastProvider>
      </RealtimeProvider>
    </QueryProvider>
  );
}
