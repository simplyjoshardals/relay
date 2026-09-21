import { jwtVerify, SignJWT } from "jose";
import type { Role } from "@/types";

/**
 * README §4: HS256, short-lived access token carrying `sub` (user id),
 * `org_id`, and our app's role. Every Server Action and Route Handler
 * resolves "who is this" by verifying this token via getSession()
 * (server/auth/session.ts) — never by trusting a client-supplied org id
 * or role directly (AUTH-06).
 *
 * The wire claim for our role is `app_role`, not `role` — `role` is
 * reserved by Supabase/PostgREST, which reads it to decide which
 * *Postgres* role a connection assumes (normally `authenticated`).
 * Setting it to our own value like `"MANAGER"` isn't a role Postgres
 * knows about, so a connection using this token doesn't get the base
 * grants `authenticated` normally has — Realtime Authorization then
 * rejects the whole channel join before the RLS policy's own condition
 * is meaningfully evaluated at all (confirmed against a real project:
 * valid signature, correct org_id, correct policy, still rejected with
 * "Unauthorized... to read from this Channel topic" — this collision
 * was the actual cause). `AccessTokenClaims.role` keeps its name
 * everywhere else in the app; only the JWT payload's key changed.
 */
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

export interface AccessTokenClaims {
  sub: string;
  orgId: string;
  role: Role;
}

function secretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      "JWT_SECRET is not set — see .env.example. Required to sign and verify access tokens.",
    );
  }
  return new TextEncoder().encode(secret);
}

export async function signAccessToken(
  claims: AccessTokenClaims,
): Promise<string> {
  return new SignJWT({
    org_id: claims.orgId,
    app_role: claims.role,
    // Satisfies Supabase/PostgREST's reserved `role` claim — see the
    // block comment above for why this can't be our own MEMBER/MANAGER
    // value.
    role: "authenticated",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(secretKey());
}

/**
 * Returns null for anything that isn't a currently-valid access token —
 * expired, malformed, wrong signature, or missing/mistyped claims — all
 * treated identically: no session. Callers don't get to distinguish
 * "expired" from "forged," which is the point.
 */
export async function verifyAccessToken(
  token: string,
): Promise<AccessTokenClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      algorithms: ["HS256"],
    });

    if (
      typeof payload.sub !== "string" ||
      typeof payload.org_id !== "string" ||
      (payload.app_role !== "MEMBER" && payload.app_role !== "MANAGER")
    ) {
      return null;
    }

    return { sub: payload.sub, orgId: payload.org_id, role: payload.app_role };
  } catch {
    return null;
  }
}
