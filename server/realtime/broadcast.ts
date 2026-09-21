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

const BROADCAST_URL_PATH = "/realtime/v1/api/broadcast";

/**
 * True for a transport-level failure — the connection was reset/closed
 * out from under the request, as opposed to the server actually
 * responding with a rejection. Confirmed via real diagnosis (not
 * guessed): Node's fetch (undici) pools keep-alive connections, and
 * Supabase's edge closes idle sockets on its own timeout. A broadcast
 * sent shortly after a previous one (a fast create-then-verify cycle)
 * reuses a live pooled connection and succeeds; one sent ~15-20s later
 * (a slower create-then-edit cycle, like assigning a ticket after
 * reading it) can hit a socket the remote side already closed, which
 * surfaces as `TypeError: fetch failed` wrapping `ECONNRESET` — a stale
 * pooled connection, not an auth or RLS rejection. This is exactly what
 * happened here: the create broadcast (fast) succeeded; the update
 * broadcast (slower, same code, same org, same everything else) reset.
 *
 * Only this class of error is safe to retry blind: a retry naturally
 * opens a new connection instead of reusing the dead pooled one. An
 * actual non-ok HTTP response (bad auth, malformed payload, RLS
 * misconfiguration) means the server received and rejected the
 * request — retrying that changes nothing and would just mask a real
 * problem behind a delay, so that path is deliberately NOT retried.
 */
function isStaleConnectionError(error: unknown): boolean {
  if (!(error instanceof TypeError)) return false;
  const cause = (error as { cause?: unknown }).cause;
  if (!cause || typeof cause !== "object") return false;
  const code = (cause as { code?: unknown }).code;
  return (
    code === "ECONNRESET" ||
    code === "ECONNREFUSED" ||
    code === "EPIPE" ||
    code === "UND_ERR_SOCKET"
  );
}

async function sendBroadcast(
  url: string,
  serviceRoleKey: string,
  topic: string,
  event: string,
  payload: Record<string, unknown>,
): Promise<Response> {
  return fetch(`${url}${BROADCAST_URL_PATH}`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages: [{ topic, event, payload, private: true }],
    }),
  });
}

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

  const topic = `org:${orgId}`;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await sendBroadcast(
        url,
        serviceRoleKey,
        topic,
        event,
        payload,
      );

      if (!response.ok) {
        const body = await response.text().catch(() => "<unreadable body>");
        console.error(
          `broadcastToOrg: Realtime REST endpoint returned ${response.status} for topic "${topic}", event "${event}". Body: ${body}`,
        );
        return; // A real rejection — retrying won't help.
      }

      return; // Success.
    } catch (error) {
      const staleConnection = isStaleConnectionError(error);

      if (staleConnection && attempt === 1) {
        // Stale pooled keep-alive connection — retry once, which opens
        // a fresh connection instead of reusing the dead one. No delay
        // needed: this isn't backing off from server load, it's just
        // discarding a socket the pool shouldn't have handed back.
        console.warn(
          `broadcastToOrg: stale connection sending "${event}" to topic "${topic}", retrying once`,
        );
        continue;
      }

      // Deliberately swallowed, not re-thrown, once retries are
      // exhausted: the mutation this follows already committed
      // successfully. A failed broadcast means clients find out on
      // their next poll/navigation instead of instantly — a degraded
      // experience, not a data-integrity problem — so it must never
      // fail the request that triggered it.
      console.error(
        `broadcastToOrg: failed to broadcast "${event}" to topic "${topic}"${
          staleConnection ? " (retry also failed)" : ""
        }`,
        error,
      );
      return;
    }
  }
}
