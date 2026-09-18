import { redirect } from "next/navigation";
import { TeamView } from "@/components/team/TeamView";
import { users } from "@/lib/mock-data";
import { getDevSelf } from "@/lib/dev-self";
import { canManageTeam } from "@/lib/permissions";
import { PATHS } from "@/utils/paths";

// TODO(milestone 9): replace the mock-data import above with a real
// org-scoped members query (and real invite/remove/role-change mutations)
// once auth + the API routes land — TeamView already takes its data as
// props shaped like the query result, so that swap shouldn't touch the
// JSX here. Note there's still no real invite flow (no email sends, no
// pending/accepted state) — see TeamInviteModal's comment.
//
// The redirect below is the actual enforcement of the Manager-only gate
// (ROADMAP_ROLES.md Phase 3) — TopBar hiding the nav link for Member is
// just the UX nicety on top of it.
export default async function TeamPage() {
  const self = await getDevSelf();

  if (!canManageTeam(self.role)) {
    redirect(PATHS.DASHBOARD);
  }

  return <TeamView users={users} self={self} />;
}
