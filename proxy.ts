import { NextResponse, type NextRequest } from "next/server";
import { verifyAccessToken, ACCESS_TOKEN_TTL_SECONDS } from "@/server/auth/jwt";
import { refreshSession } from "@/server/application/auth";
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_TTL_SECONDS,
} from "@/server/auth/cookies";

/**
 * Runs on every request. A Server Component's getSession() (server/auth/
 * session.ts) can only *read* cookies — only Proxy, Server Actions, and
 * Route Handlers can *set* them — so silently refreshing an expired
 * access token before a page ever renders has to happen here. Without
 * this, README §4's "access + refresh" pair would only mean "get logged
 * out every 15 minutes" — the refresh half has to actually run somewhere
 * unattended.
 *
 * This file is named `proxy.ts`, not `middleware.ts` — Next.js 16
 * renamed the convention (the old name is deprecated and will be
 * removed in a future version). Nothing else changes in what this does;
 * it's the same request-interception point under a new name. One thing
 * that *did* get simpler: Proxy's runtime is unconditionally Node.js,
 * not configurable the way Middleware's was — which happens to be
 * exactly what this needs anyway, since refreshSession() goes through
 * Prisma (via @prisma/adapter-pg, real Node TCP sockets) and Node's
 * `crypto` module, neither of which works on the old Edge default.
 */
export async function proxy(request: NextRequest) {
  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;

  if (accessToken && (await verifyAccessToken(accessToken))) {
    return NextResponse.next();
  }

  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;
  if (!refreshToken) {
    return NextResponse.next();
  }

  const result = await refreshSession(refreshToken);
  const response = NextResponse.next();

  if (!result.ok) {
    // Refresh token invalid, expired, or already used — clear both
    // cookies rather than leave a stale, unusable pair sitting there.
    // The dashboard layout's own session check sends the request to
    // /login from here.
    response.cookies.delete(ACCESS_TOKEN_COOKIE);
    response.cookies.delete(REFRESH_TOKEN_COOKIE);
    return response;
  }

  const cookieOptions = {
    path: "/",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };

  response.cookies.set(ACCESS_TOKEN_COOKIE, result.session.accessToken, {
    ...cookieOptions,
    maxAge: ACCESS_TOKEN_TTL_SECONDS,
  });
  response.cookies.set(REFRESH_TOKEN_COOKIE, result.session.refreshToken, {
    ...cookieOptions,
    maxAge: REFRESH_TOKEN_TTL_SECONDS,
  });

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
