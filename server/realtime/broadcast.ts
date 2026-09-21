/**
 * Broadcasts a small invalidation hint to an org's Realtime channel
 * after a mutation commits (§0/§6/§7) — never the resource itself, per
 * RT-06 ("Realtime is not authoritative"): clients treat this as a
 * signal to refetch through the normal, authorized path, not as data.
 *
 * Sent via Supabase's REST broadcast endpoint (a single HTTP POST), not
 * the `channel.send()` client-library method. That method sends over an
 * *established WebSocket* — from a short-lived Server Action there
 * isn't one, and asking supabase-js to open and tear down a socket per
 * mutation just to send one message is exactly the kind of thing that
 * fails silently in practice (a real, filed issue: supabase/realtime#774
 * reports channel.send() from a Node backend returning an opaque
 * "error" with no explanation when no socket is connected). The REST
 * endpoint is the documented, supported way to broadcast from a backend
 * with no persistent connection.
 *
 * External setup this depends on (Supabase dashboard/SQL — not
 * something this file can do): the project's Realtime Authorization
 * must be configured to trust this app's JWT_SECRET for custom JWT
 * verification, and the RLS policy from README §6 must exist on
 * realtime.messages. Both are one-time project configuration, not code.
 */
export async function broadcastToOrg(
  orgId: string,
  event: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    console.error(
      "broadcastToOrg: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set — skipping broadcast.",
    );
    return;
  }

  try {
    const response = await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [{ topic: `org:${orgId}`, event, payload }],
      }),
    });

    if (!response.ok) {
      console.error(
        `broadcastToOrg: Realtime REST endpoint returned ${response.status}`,
      );
    }
  } catch (error) {
    // Deliberately swallowed, not re-thrown: the mutation this follows
    // already committed successfully. A failed broadcast means clients
    // find out on their next poll/navigation instead of instantly — a
    // degraded experience, not a data-integrity problem — so it must
    // never fail the request that triggered it.
    console.error("broadcastToOrg: failed to broadcast", error);
  }
}
