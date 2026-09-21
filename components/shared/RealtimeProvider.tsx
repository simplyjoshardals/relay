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

const TOKEN_REFRESH_INTERVAL_MS = 10 * 60 * 1000;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
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

    let channel: RealtimeChannel | null = null;
    let refreshInterval: ReturnType<typeof setInterval> | null = null;

    const authenticateAndSubscribe = async () => {
      try {
        const token = await getRealtimeTokenAction();
        if (isStale()) return;

        // setAuth() MUST complete before subscribe() is called.
        // Realtime Authorization checks the socket's current JWT at
        // phx_join time; subscribing first and authenticating after
        // means the join goes out unauthenticated (RLS has nothing to
        // match org_id against), draws a CHANNEL_ERROR, and only
        // succeeds on the rejoin that setAuth() triggers afterwards —
        // which is exactly the "ok and error mixed together, plus a
        // phx_leave" pattern in the bug report. Sequencing this, and
        // only building/subscribing the channel afterward, removes
        // that race entirely rather than just narrowing it.
        await supabase.realtime.setAuth(token);
        if (isStale()) return;

        channel = supabase
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
              setConnected(true);
              queryClient.invalidateQueries();
            } else {
              setConnected(false);
            }
          });

        channelRef.current = channel;

        // Re-authing an already-joined channel doesn't trigger a
        // rejoin the way the pre-auth initial join above did —
        // supabase-js just pushes the refreshed token to the socket —
        // so this interval doesn't reproduce the race, only the
        // isStale() guard is needed to stop it after teardown.
        refreshInterval = setInterval(async () => {
          if (isStale()) return;
          try {
            const freshToken = await getRealtimeTokenAction();
            if (isStale()) return;
            await supabase.realtime.setAuth(freshToken);
          } catch (error) {
            console.error(
              "RealtimeProvider: failed to refresh auth token",
              error,
            );
          }
        }, TOKEN_REFRESH_INTERVAL_MS);
      } catch (error) {
        if (!isStale()) {
          console.error(
            "RealtimeProvider: failed to authenticate realtime session",
            error,
          );
          setConnected(false);
        }
      }
    };

    void authenticateAndSubscribe();

    return () => {
      // This cleanup can run *before* authenticateAndSubscribe's awaits
      // resolve (that's precisely the Strict Mode case). The isStale()
      // checks sprinkled after every await are what actually stop a
      // torn-down run from creating/subscribing a channel — this
      // cleanup only tears down whatever *this* run had already made
      // by the time it runs.
      if (refreshInterval) clearInterval(refreshInterval);
      if (channel) {
        supabase.removeChannel(channel);
      }
      if (channelRef.current === channel) {
        channelRef.current = null;
      }
    };
  }, [orgId, queryClient]);

  return (
    <RealtimeStatusContext.Provider value={connected}>
      {children}
    </RealtimeStatusContext.Provider>
  );
}