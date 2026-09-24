import { redirect } from "next/navigation";
import { TeamView } from "@/components/team/TeamView";
import { getCurrentUser } from "@/server/auth/session";
import { canManageTeam } from "@/lib/permissions";
import { PATHS } from "@/utils/paths";

// Milestone 10: the roster and pending invitations are real now —
// `TeamView` self-fetches them (listOrgUsersAction /
// listPendingInvitationsAction) the same way IncidentsView and
// ServicesView do, so this page only resolves `self` and gates access.
//
// The redirect below is the actual enforcement of the Manager-only gate
// for the *page* (ROADMAP_ROLES.md Phase 3) — TopBar hiding the nav link
// for Member is just the UX nicety on top of it. Every team *action* is
// separately gated server-side (server/application/users.ts,
// invitations.ts), so reaching the page isn't what protects the data.
export default async function TeamPage() {
  const self = await getCurrentUser();
  if (!self) redirect(PATHS.LOGIN);

  if (!canManageTeam(self.role)) {
    redirect(PATHS.DASHBOARD);
  }

  return <TeamView self={self} />;
}
