import { redirect } from "next/navigation";
import { TeamView } from "@/components/team/TeamView";
import { users } from "@/lib/mock-data";
import { getCurrentUser } from "@/server/auth/session";
import { canManageTeam } from "@/lib/permissions";
import { PATHS } from "@/utils/paths";

// `self` is real now (Milestone 1 — a verified session via
// getCurrentUser()). The team roster itself (`users`, from mock-data)
// is still fake — that's Milestone 9's real org-scoped members query,
// plus real invite/remove/role-change mutations once Milestone 2's
// application/repository layering exists for this domain too. There's
// still no real invite flow either way (no email sends, no pending/
// accepted state) — see TeamInviteModal's comment.
//
// The redirect below is the actual enforcement of the Manager-only gate
// (ROADMAP_ROLES.md Phase 3) — TopBar hiding the nav link for Member is
// just the UX nicety on top of it.
export default async function TeamPage() {
  const self = await getCurrentUser();
  if (!self) redirect(PATHS.LOGIN);

  if (!canManageTeam(self.role)) {
    redirect(PATHS.DASHBOARD);
  }

  return <TeamView users={users} self={self} />;
}
