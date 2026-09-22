import { prisma } from "@/lib/prisma";

/**
 * The one deliberate exception to "every repository function takes orgId
 * as its required first parameter" (§3, Layer 1) — there's no orgId to
 * scope by yet, since the whole point is enumerating orgs. Same
 * reasoning as findUserByEmailForLogin in repositories/users.ts: this is
 * only ever called from a context that doesn't have a session, here the
 * telemetry worker (workers/telemetry.ts) rather than the login flow.
 * Never call this from a Server Action or Route Handler.
 */
export async function listAllOrgIds(): Promise<string[]> {
  const orgs = await prisma.organization.findMany({ select: { id: true } });
  return orgs.map((o) => o.id);
}
