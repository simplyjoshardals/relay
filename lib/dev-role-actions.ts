"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import type { Role } from "@/types";
import { DEV_SELF_COOKIE, representativeByRole } from "@/lib/dev-self";

/**
 * Sets the dev "view as" cookie to the representative user for `role`
 * (see lib/dev-self.ts). Stands in for a real login/session mutation
 * until auth lands — this is scaffolding to make role-gated UI visible
 * and testable now, not a feature. Distinct from signInAsAction
 * (lib/dev-auth-actions.ts): this is a quick role flip while already
 * "signed in," not the sign-in flow itself.
 */
export async function setDevRoleAction(role: Role) {
  const store = await cookies();
  store.set(DEV_SELF_COOKIE, representativeByRole[role].id, {
    path: "/",
    sameSite: "lax",
  });

  // Every route under the dashboard layout reads self via getDevSelf(),
  // so refresh the whole tree rather than trying to guess which page is
  // currently open.
  revalidatePath("/", "layout");
}
