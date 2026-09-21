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
import { createClient, type RealtimeChannel } from "@supabase/supabase-js";
import { getRealtimeTokenAction } from "@/app/(dashboard)/actions";

const RealtimeStatusContext = createContext(false);

export function useRealtimeConnected(): boolean {
  return useContext(RealtimeStatusContext);
}

// Backoff for reconnect attempts after a CHANNEL_ERROR/TIMED_OUT/CLOSED —
// capped so a run of failures doesn't turn into a tight retry loop against
// the token endpoint and the socket. Resets to the first entry as soon as
// a connect attempt actually reaches SUBSCRIBED.
const RECONNECT_DELAYS_MS = [1_000, 2_000, 5_000, 10_000, 15_000];

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        // This is the actual fix for the "reconnects on its own after a
        // while" bug — not something a retry loop can paper over.
        //
        // createClient()'s default wiring gives the RealtimeClient an
        // accessToken callback that resolves to
        // `supabase.auth`'s session token, or the anon key if there's no
        // session. This app never signs in via supabase.auth (custom
        // cookie-based auth instead), so that callback always resolves
        // to the anon key. And it isn't just called once: supabase-js
        // calls it on every heartbeat (~every 30s) to keep the socket
        // authorized — a manual `setAuth(customToken)` call sends our
        // org-scoped JWT for that one message, but does NOT stop the
        // next heartbeat from overwriting it with the anon key, since
        // "a callback is configured" always wins over "someone called
        // setAuth() by hand" (see @supabase/realtime-js's
        // RealtimeClient._performAuth). The anon key carries no
        // org_id/app_role claims, so the Realtime Authorization RLS
        // policy correctly rejects it — that's the CHANNEL_ERROR this
        // produces every ~30 seconds, forever, regardless of anything
        // this component does.
        //
        // Passing accessToken here makes our own token-minting Server
        // Action the callback, so it's what every heartbeat and
        // reconnect actually refreshes from — a real, valid, org-scoped
        // token every time, not the anon key. This also disables
        // `supabase.auth` on this client (throws if touched), which is
        // fine: nothing in this app uses it.
        accessToken: () => getRealtimeTokenAction(),
      })
    : null;

interface RealtimeProviderProps {
  orgId: string;
  children: ReactNode;
}

export function RealtimeProvider({ orgId, children }: RealtimeProviderProps) {
  const queryClient = useQueryClient();
  const [connected, setConnected] = useState(false);
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

  useEffect(() => {
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

    const teardown = () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
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
        if (isStale()) return;

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
          .subscribe((status) => {
            if (isStale()) return;

            if (status === "SUBSCRIBED") {
              retryCountRef.current = 0;
              clearRetryTimer();
              setConnected(true);
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
              setConnected(false);
              scheduleReconnect();
            }
          });

        channelRef.current = channel;
      } catch (error) {
        if (!isStale()) {
          console.error(
            "RealtimeProvider: failed to authenticate realtime session",
            error,
          );
          setConnected(false);
          scheduleReconnect();
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

    const handleVisibility = () => {
      // A backgrounded tab throttles timers, including the socket's own
      // heartbeat — a laptop that slept through several missed
      // heartbeats can come back to a channel the client still thinks
      // is fine but the server dropped long ago. Re-verifying on
      // foreground catches that without waiting on a heartbeat timeout.
      if (document.visibilityState === "visible") {
        handleOnline();
      }
    };

    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      // This cleanup can run *before* connect()'s awaits resolve (that's
      // precisely the Strict Mode case). The isStale() checks sprinkled
      // after every await are what actually stop a torn-down run from
      // creating/subscribing a channel — this cleanup only tears down
      // whatever *this* run had already made by the time it runs.
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisibility);
      clearRetryTimer();
      teardown();
    };
  }, [orgId, queryClient]);

  return (
    <RealtimeStatusContext.Provider value={connected}>
      {children}
    </RealtimeStatusContext.Provider>
  );
}
