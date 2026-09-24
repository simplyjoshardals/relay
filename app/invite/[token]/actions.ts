"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { acceptInvitation } from "@/server/application/invitations";
import { ACCESS_TOKEN_TTL_SECONDS } from "@/server/auth/jwt";
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_TTL_SECONDS,
} from "@/server/auth/cookies";
import { PATHS } from "@/utils/paths";

export interface AcceptInviteFormState {
  error: string | null;
}

const cookieOptions = {
  path: "/",
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
};

/**
 * Same thin-adapter shape as app/login/actions.ts#loginAction (React's
 * useActionState signature): read the form, call the application-layer
 * use-case, then either set real session cookies and redirect, or hand
 * an error back for the form to render. The token travels as a hidden
 * field rather than being re-read from the URL, so the action is
 * self-contained.
 *
 * Accepting signs the new member straight in — they just proved
 * possession of the link and chose a password, so making them type both
 * again at /login would be friction with no security value.
 */
export async function acceptInvitationAction(
  _prevState: AcceptInviteFormState,
  formData: FormData,
): Promise<AcceptInviteFormState> {
  const result = await acceptInvitation({
    token: formData.get("token"),
    name: formData.get("name"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!result.ok) {
    switch (result.error) {
      case "invalid_input":
        return { error: result.message };
      case "already_member":
        return {
          error:
            "This email already has an account on the team. Sign in instead.",
        };
      case "invalid_invitation":
        return {
          error:
            "This invitation link is no longer valid. Ask a Manager for a new one.",
        };
    }
  }

  const store = await cookies();
  store.set(ACCESS_TOKEN_COOKIE, result.session.accessToken, {
    ...cookieOptions,
    maxAge: ACCESS_TOKEN_TTL_SECONDS,
  });
  store.set(REFRESH_TOKEN_COOKIE, result.session.refreshToken, {
    ...cookieOptions,
    maxAge: REFRESH_TOKEN_TTL_SECONDS,
  });

  redirect(PATHS.DASHBOARD);
}
