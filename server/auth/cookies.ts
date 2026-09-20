/**
 * Names and lifetimes for the two session cookies. Actual `cookies().set()`
 * calls live at the route/Server Action layer (e.g. app/login/actions.ts),
 * not here or in server/application/auth.ts — keeping the application
 * layer free of `next/headers` means its functions can be unit-tested
 * with Vitest (§12) without a request context to fake.
 */
export const ACCESS_TOKEN_COOKIE = "relay_access_token";
export const REFRESH_TOKEN_COOKIE = "relay_refresh_token";

export const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days
