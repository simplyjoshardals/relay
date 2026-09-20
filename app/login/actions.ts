"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { loginWithPassword, logout } from "@/server/application/auth";
import { ACCESS_TOKEN_TTL_SECONDS } from "@/server/auth/jwt";
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_TTL_SECONDS,
} from "@/server/auth/cookies";
import { PATHS } from "@/utils/paths";

export interface LoginFormState {
  error: string | null;
}

const cookieOptions = {
  path: "/",
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
};

/**
 * Signature matches React's useActionState (prevState, formData) so the
 * login form (app/login/LoginForm.tsx) can show an inline error without
 * losing what was typed. The actual credential check lives in
 * server/application/auth.ts — this is just the thin adapter: read the
 * form, call it, either set real session cookies and redirect, or return
 * an error for the form to render.
 *
 * The error message is deliberately generic ("email or password" rather
 * than which one was wrong) — distinguishing them would let an attacker
 * enumerate which emails have accounts.
 */
export async function loginAction(
  _prevState: LoginFormState,
  formData: FormData,
): Promise<LoginFormState> {
  const result = await loginWithPassword({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!result.ok) {
    return { error: "Incorrect email or password." };
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

export async function logoutAction() {
  const store = await cookies();
  const refreshToken = store.get(REFRESH_TOKEN_COOKIE)?.value ?? null;

  await logout(refreshToken);

  store.delete(ACCESS_TOKEN_COOKIE);
  store.delete(REFRESH_TOKEN_COOKIE);

  redirect(PATHS.LOGIN);
}
