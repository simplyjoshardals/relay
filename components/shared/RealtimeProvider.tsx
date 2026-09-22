"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  createClient,
  type RealtimeChannel,
  type SupabaseClient,
} from "@supabase/supabase-js";
import { getRealtimeTokenAction } from "@/app/(dashboard)/actions";

/**
 * RT-02/RT-03: the connection state has to be visible, and "never
 * connected yet", "lost the socket", and "the browser has no network at
 * all" are three different situations for the person looking at it:
 *   connecting   — first connect, nothing wrong
 *   connected    — subscribed; data on screen is live
 *   reconnecting — was live (or tried to be), socket/auth dropped, retrying
 *   offline      — browser reports no network; nothing to retry until it's back
 */
export type RealtimeStatus =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "offline";

const RealtimeStatusContext = createContext<RealtimeStatus>("connecting");

export function useRealtimeStatus(): RealtimeStatus {
  return useContext(RealtimeStatusContext);
}

export function useRealtimeConnected(): boolean {
  return useContext(RealtimeStatusContext) === "connected";
}

// Backoff for reconnect attempts after a CHANNEL_ERROR/TIMED_OUT/CLOSED —
// capped so a run of failures doesn't turn into a tight retry loop against
// the token endpoint and the socket. Resets to the first entry as soon as
// a connect attempt actually reaches SUBSCRIBED.
const RECONNECT_DELAYS_MS = [1_000, 2_000, 5_000, 10_000, 15_000];

// Coming back to a tab that was hidden for less than this, with the
// channel still joined, needs no reconnect — the socket's own heartbeat
// wouldn't have missed enough beats for the server to drop it. Longer
// than this (or a channel that isn't joined) and we re-verify from
// scratch with a fresh token.
const VISIBILITY_RECHECK_AFTER_MS = 60_000;

// If a connect attempt neither reaches SUBSCRIBED nor fails outright
// within this long (a hung token call, a join that never gets a reply),
// abandon it and retry. Without this, "connecting" can sit there forever
// with nothing to say why.
const CONNECT_TIMEOUT_MS = 10_000;

// §7's explicit exception for high-frequency telemetry: "debounce
// service.updated invalidations client-side (max ~once per 1-2s per
// service) to avoid refetch storms; sub-second precision isn't a
// product requirement." The telemetry worker (workers/telemetry.ts)
// ticks every few seconds per service, so without this a busy org would
// invalidate the services list on nearly every broadcast.
const SERVICE_UPDATE_DEBOUNCE_MS = 1_500;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Built inside useEffect — NOT at module scope — and one per effect run,
// not shared.
//
// Not at module scope: a module-level createClient() runs while Next
// evaluates this file for server-side rendering of the "use client"
// tree, and supabase-js can invoke the accessToken callback below while
// constructing the client. That callback is a Server Action, and Next
// refuses Server Action calls made during render ("Server Functions
// cannot be called during initial render"). Effects never run on the
// server, so the Server Action is only ever called from the browser.
//
// Not shared: a module-level singleton outlives the provider. After a
// logout → login in the same tab (client-side navigation, no page
// reload) the new session would inherit the old one's socket state and,
// worse, its half-removed channel — supabase-js hands back an existing
// channel for the same topic, and removeChannel() is async, so a quick
// re-login can get the old, already-subscribed one back and then fail
// to subscribe it again. A fresh client per mount, disposed on unmount,
// makes every login start from a clean slate.
function createSupabase(): SupabaseClient | null {
  if (typeof window === "undefined") return null;
  if (!supabaseUrl || !supabaseAnonKey) return null;

  return createClient(supabaseUrl, supabaseAnonKey, {
    // Why accessToken is passed at all: createClient()'s default wiring
    // resolves to `supabase.auth`'s session token, or the anon key when
    // there's no session. This app never signs in via supabase.auth
    // (custom cookie-based auth), so the default is always the anon
    // key — and supabase-js calls this callback on every heartbeat
    // (~30s), overwriting anything a manual setAuth(token) sent. The
    // anon key has no org_id/app_role claims, so the Realtime
    // Authorization RLS policy rejects it: a CHANNEL_ERROR every ~30s.
    // Making our token-minting Server Action the callback means every
    // heartbeat and reconnect refreshes from a real, org-scoped token.
    // This also disables `supabase.auth` on this client (throws if
    // touched), which is fine: nothing in this app uses it.
    accessToken: () => getRealtimeTokenAction(),
  });
}

interface RealtimeProviderProps {
  orgId: string;
  children: ReactNode;
}

export function RealtimeProvider({ orgId, children }: RealtimeProviderProps) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<RealtimeStatus>("connecting");
  // Whether this provider has ever reached SUBSCRIBED — distinguishes a
  // first "connecting" from a "reconnecting" after a drop.
  const hasConnectedRef = useRef(false);
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Generation counter, not just a `cancelled` boolean. A boolean stops
  // a stale run's own setState calls but does nothing about async work
  // already in flight: under Strict Mode's mount→cleanup→mount, the
  // first run's getRealtimeTokenAction()/setAuth() call can still be on
  // the wire when the second run starts. If both runs eventually
  // resolve and each subscribes its own channel, that's the
  // overlapping-join symptom in the bug report. Bumping this on every
  // effect run and checking it after every await lets a stale run
  // detect it's stale *after each async step*, not just before calling
  // setState, and bail before ever touching the socket.
  const generationRef = useRef(0);

  // How many reconnect attempts have failed in a row since the last
  // successful SUBSCRIBED, for RECONNECT_DELAYS_MS backoff.
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Per-connect-attempt counter and its watchdog timer. A hung attempt
  // (say, a token call that never returns) is abandoned by the watchdog;
  // the counter is what stops that abandoned attempt from later waking
  // up and building a second channel alongside the retry's.
  const attemptRef = useRef(0);
  const connectWatchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Per-service trailing-edge debounce state for `service.updated` (§7).
  // Keyed by service id so a busy service doesn't starve invalidation of
  // a quiet one. Trailing-edge, not leading: the *last* reading in a
  // debounce window is the one that matters (it's what's in the
  // database by the time the invalidated refetch runs), not the first.
  const serviceDebounceTimersRef = useRef<
    Map<string, ReturnType<typeof setTimeout>>
  >(new Map());

  useEffect(() => {
    const supabase = createSupabase();
    if (!supabase) {
      console.warn(
        "RealtimeProvider: NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_ANON_KEY not set — realtime disabled.",
      );
      return;
    }

    generationRef.current += 1;
    const myGeneration = generationRef.current;
    const isStale = () => myGeneration !== generationRef.current;

    const clearRetryTimer = () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };

    const clearConnectWatchdog = () => {
      if (connectWatchdogRef.current) {
        clearTimeout(connectWatchdogRef.current);
        connectWatchdogRef.current = null;
      }
    };

    const clearServiceDebounceTimers = () => {
      for (const timer of serviceDebounceTimersRef.current.values()) {
        clearTimeout(timer);
      }
      serviceDebounceTimersRef.current.clear();
    };

    const teardown = () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      // Pending debounced invalidations belong to the channel that
      // scheduled them — a reconnect already invalidates everything on
      // SUBSCRIBED (§35), so a leftover timer from before the drop would
      // be redundant at best.
      clearServiceDebounceTimers();
    };

    // Trailing-edge debounce, per service id: the first event for a
    // given service in a quiet window schedules the invalidation; any
    // further events for that same service before the timer fires are
    // absorbed into the same pending timer rather than each scheduling
    // their own. isStale() is checked when the timer actually fires
    // (not just at schedule time), since a stale effect run's timers
    // could otherwise still land after this run's own teardown.
    const scheduleServiceInvalidation = (serviceId: string) => {
      if (serviceDebounceTimersRef.current.has(serviceId)) return;

      const timer = setTimeout(() => {
        serviceDebounceTimersRef.current.delete(serviceId);
        if (isStale()) return;
        queryClient.invalidateQueries({
          queryKey: ["services", serviceId],
        });
        queryClient.invalidateQueries({ queryKey: ["services", "list"] });
      }, SERVICE_UPDATE_DEBOUNCE_MS);

      serviceDebounceTimersRef.current.set(serviceId, timer);
    };

    const scheduleReconnect = () => {
      if (isStale()) return;
      clearRetryTimer();
      const delay =
        RECONNECT_DELAYS_MS[
          Math.min(retryCountRef.current, RECONNECT_DELAYS_MS.length - 1)
        ];
      retryCountRef.current += 1;
      retryTimerRef.current = setTimeout(() => {
        if (isStale()) return;
        void connect();
      }, delay);
    };

    const connect = async () => {
      // Idempotent teardown first: this runs both for the very first
      // connect and for every later reconnect (backoff timer, 'online'
      // event, tab foregrounded), so there's never a moment with two
      // live channels or two overlapping refresh intervals.
      teardown();
      clearConnectWatchdog();
      attemptRef.current += 1;
      const myAttempt = attemptRef.current;
      const isSuperseded = () => isStale() || myAttempt !== attemptRef.current;

      // No network at all: nothing to attempt. The 'online' listener
      // below calls connect() again the moment it's back — retrying on a
      // backoff timer while offline would just burn failed token calls.
      if (!navigator.onLine) {
        setStatus("offline");
        return;
      }
      setStatus(hasConnectedRef.current ? "reconnecting" : "connecting");

      connectWatchdogRef.current = setTimeout(() => {
        if (isSuperseded()) return;
        console.warn(
          `RealtimeProvider: connect attempt didn't complete within ${CONNECT_TIMEOUT_MS / 1000}s — retrying.`,
        );
        setStatus("reconnecting");
        scheduleReconnect();
      }, CONNECT_TIMEOUT_MS);

      try {
        // setAuth() with no argument pulls a fresh token from the
        // accessToken callback configured above (our own
        // getRealtimeTokenAction, not the anon key) and MUST complete
        // before subscribe() is called. Realtime Authorization checks
        // the socket's current JWT at phx_join time; subscribing first
        // and authenticating after means the join goes out
        // unauthenticated (RLS has nothing to match org_id against),
        // draws a CHANNEL_ERROR, and only succeeds on the rejoin that
        // setAuth() triggers afterwards — which is exactly the "ok and
        // error mixed together, plus a phx_leave" pattern in the bug
        // report. Sequencing this, and only building/subscribing the
        // channel afterward, removes that race entirely rather than
        // just narrowing it.
        await supabase.realtime.setAuth();
        if (isSuperseded()) return;

        const channel = supabase
          .channel(`org:${orgId}`, { config: { private: true } })
          .on("broadcast", { event: "ticket.updated" }, ({ payload }) => {
            if (isStale()) return;
            if (payload?.id) {
              queryClient.invalidateQueries({
                queryKey: ["tickets", payload.id],
              });
            }
            queryClient.invalidateQueries({ queryKey: ["tickets", "list"] });
          })
          .on("broadcast", { event: "service.updated" }, ({ payload }) => {
            if (isStale()) return;
            if (payload?.id) scheduleServiceInvalidation(payload.id);
          })
          .subscribe((status) => {
            if (isSuperseded()) return;

            if (status === "SUBSCRIBED") {
              retryCountRef.current = 0;
              clearRetryTimer();
              clearConnectWatchdog();
              hasConnectedRef.current = true;
              setStatus("connected");
              // §35: after (re)connecting, refetch everything active
              // unconditionally rather than diffing what was missed.
              queryClient.invalidateQueries();
            } else {
              // CHANNEL_ERROR / TIMED_OUT / CLOSED. supabase-js's socket
              // does auto-reconnect at the transport level, but a
              // *private* channel's own rejoin still gets rejected if
              // the realtime JWT it's carrying has since expired — a
              // very likely state after being offline, backgrounded, or
              // asleep for a while (the socket has no way to fetch a
              // new one on its own; that requires our
              // getRealtimeTokenAction() Server Action). Left alone,
              // that rejection just sits here forever, which is exactly
              // "came back online and it never went back to Live."
              // Reconnecting from scratch with a fresh token is what
              // actually resolves it.
              if (!navigator.onLine) {
                // The drop is because there's no network; the 'online'
                // listener reconnects once it's back.
                setStatus("offline");
                return;
              }
              setStatus("reconnecting");
              scheduleReconnect();
            }
          });

        channelRef.current = channel;
      } catch (error) {
        if (!isSuperseded()) {
          clearConnectWatchdog();
          console.error(
            "RealtimeProvider: failed to authenticate realtime session",
            error,
          );
          setStatus(navigator.onLine ? "reconnecting" : "offline");
          if (navigator.onLine) scheduleReconnect();
        }
      }
    };

    void connect();

    const handleOnline = () => {
      // The browser regained connectivity. Don't wait out whatever
      // backoff delay happens to be queued — reconnect immediately with
      // a fresh token rather than trusting the socket's own reconnect,
      // which can get stuck retrying with the now-expired token it had
      // when connectivity dropped (see the CHANNEL_ERROR branch above).
      if (isStale()) return;
      retryCountRef.current = 0;
      clearRetryTimer();
      void connect();
    };

    const handleOffline = () => {
      // Stop any queued retry and say so plainly. Don't tear the channel
      // down here: if the outage is a blip the socket may resume by
      // itself, and if not, handleOnline() rebuilds everything.
      if (isStale()) return;
      clearRetryTimer();
      clearConnectWatchdog();
      setStatus("offline");
    };

    let hiddenAt: number | null = null;

    const handleVisibility = () => {
      // A backgrounded tab throttles timers, including the socket's own
      // heartbeat — a laptop that slept through several missed
      // heartbeats can come back to a channel the client still thinks
      // is fine but the server dropped long ago. Re-verify on foreground
      // — but only when that's plausible: a quick tab switch with the
      // channel still joined doesn't need a teardown/reconnect (and the
      // "Reconnecting" flicker that comes with it).
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
        return;
      }
      const awayMs = hiddenAt === null ? Infinity : Date.now() - hiddenAt;
      hiddenAt = null;

      const joined = String(channelRef.current?.state) === "joined";
      if (joined && awayMs < VISIBILITY_RECHECK_AFTER_MS) return;

      handleOnline();
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      // This cleanup can run *before* connect()'s awaits resolve (that's
      // precisely the Strict Mode case). The isStale() checks sprinkled
      // after every await are what actually stop a torn-down run from
      // creating/subscribing a channel — this cleanup only tears down
      // whatever *this* run had already made by the time it runs.
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("visibilitychange", handleVisibility);

      // Mark this run stale *now*. Previously only the next effect run
      // bumped the generation, so on a plain unmount (logout) an
      // in-flight token call could still resolve, pass isStale(), and`
      // subscribe a channel on a client nobody owns any more.
      generationRef.current += 1;

      clearRetryTimer();
      clearConnectWatchdog();
      teardown();

      // This run's client is discarded with it (see createSupabase):
      // leave every channel and close the socket so nothing lingers
      // into the next session.
      void supabase
        .removeAllChannels()
        .catch(() => undefined)
        .finally(() => {
          try {
            supabase.realtime.disconnect();
          } catch {
            // Already closed — nothing to do.
          }
        });
    };
  }, [orgId, queryClient]);

  return (
    <RealtimeStatusContext.Provider value={status}>
      {children}
    </RealtimeStatusContext.Provider>
  );
}
