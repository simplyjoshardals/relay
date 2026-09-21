"use server";

import { requireSession } from "@/server/auth/session";
import { mintRealtimeToken } from "@/server/application/realtime";

/**
 * Called by RealtimeProvider (components/shared/RealtimeProvider.tsx) on
 * mount and periodically thereafter. Lives here rather than under
 * tickets/ or any other domain folder — Realtime's subscription is
 * cross-cutting infrastructure for the whole dashboard shell, not owned
 * by one domain.
 */
export async function getRealtimeTokenAction(): Promise<string> {
  const session = await requireSession();
  return mintRealtimeToken(session);
}
