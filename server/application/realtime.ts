import type { AccessTokenClaims } from "@/server/auth/jwt";
import { signAccessToken } from "@/server/auth/jwt";

/**
 * §4: "mint a Realtime-scoped JWT with the same secret and claim shape
 * Realtime's Authorization policies expect (org_id, role)." That's
 * exactly signAccessToken's shape already — no separate signing
 * function needed, just a clearly-named entry point so call sites read
 * as "get a token for Realtime" rather than looking like a second
 * app-session token.
 *
 * Re-minted on demand rather than only at login/refresh: RealtimeProvider
 * (the client) calls this periodically to refresh what it hands to
 * `supabase.realtime.setAuth()`, independent of whether a page
 * navigation happened to trigger proxy.ts's access-token refresh in the
 * meantime — a long-lived tab with no navigation wouldn't otherwise get
 * a fresh one before the ~15 minute expiry.
 */
export async function mintRealtimeToken(
  session: AccessTokenClaims,
): Promise<string> {
  return signAccessToken(session);
}
