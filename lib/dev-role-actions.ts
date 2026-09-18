"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import type { Role } from "@/types";
import { DEV_ROLE_COOKIE } from "@/lib/dev-self";

/**
 * Sets the dev "view as" role cookie (see lib/dev-self.ts). Stands in for
 * a real login/session mutation until auth lands — this is scaffolding
 * to make role-gated UI visible and testable now, not a feature.
 */
export async function setDevRoleAction(role: Role) {
  const store = await cookies();
  store.set(DEV_ROLE_COOKIE, role, { path: "/", sameSite: "lax" });

  // Every route under the dashboard layout reads self via getDevSelf(),
  // so refresh the whole tree rather than trying to guess which page is
  // currently open.
  revalidatePath("/", "layout");
}
