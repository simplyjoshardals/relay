import { listAllOrgIds } from "@/server/repositories/organizations";

/**
 * §13/§9: the telemetry worker imports from `/server/application` only,
 * never `/server/repositories` directly — this is the thin pass-through
 * that boundary requires for org enumeration. No session parameter, for
 * the same reason updateServiceTelemetry (server/application/services.ts)
 * has none: the worker isn't acting on behalf of any one authenticated
 * user, so there's nothing to check a role against here.
 */
export async function listOrgIdsForTelemetry(): Promise<string[]> {
  return listAllOrgIds();
}
