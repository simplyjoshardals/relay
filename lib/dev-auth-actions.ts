"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { users } from "@/lib/mock-data";
import { DEV_SELF_COOKIE } from "@/lib/dev-self";
import { PATHS } from "@/utils/paths";

/**
 * Dev stand-in for real sign-in (README §5/§16, Milestone 1): no
 * password, no JWT, no session table — just picking which mock person
 * you are and remembering it in a cookie. The actual login page
 * (app/login/page.tsx) is real UI wired to fake auth, same pattern as
 * everything else in this repo before the backend milestones land.
 */
export async function signInAsAction(formData: FormData) {
  const userId = formData.get("userId");

  if (typeof userId !== "string" || !users.some((u) => u.id === userId)) {
    // Someone tampered with the form or the mock user list changed
    // under us — back to the picker rather than trusting an unknown id.
    redirect(PATHS.LOGIN);
  }

  const store = await cookies();
  store.set(DEV_SELF_COOKIE, userId, { path: "/", sameSite: "lax" });

  redirect(PATHS.DASHBOARD);
}

export async function signOutAction() {
  const store = await cookies();
  store.delete(DEV_SELF_COOKIE);

  redirect(PATHS.LOGIN);
}
