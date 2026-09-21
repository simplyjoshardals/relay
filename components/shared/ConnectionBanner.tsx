"use client";

import { useEffect, useState } from "react";
import { WifiSlashIcon } from "@phosphor-icons/react";
import { useRealtimeStatus } from "@/components/shared/RealtimeProvider";

// A reconnect that resolves in a second or two (a quick tab switch, a
// token refresh) shouldn't flash a warning across the page — the small
// pill in the TopBar already covers that. The banner is for a connection
// that's actually stayed down. "Offline" has no grace: the browser has
// told us there's no network.
const RECONNECTING_GRACE_MS = 2_000;

/**
 * §18: "avoid presenting obviously stale state as current." While the
 * realtime connection is down, nothing is pushing updates, so whatever's
 * on screen may be out of date — this says so. Once it reconnects,
 * RealtimeProvider invalidates every active query (§35), the banner
 * disappears, and the data is authoritative again.
 */
export function ConnectionBanner() {
  const status = useRealtimeStatus();
  const [graceElapsed, setGraceElapsed] = useState(false);

  useEffect(() => {
    if (status !== "reconnecting") return;
    const timer = setTimeout(
      () => setGraceElapsed(true),
      RECONNECTING_GRACE_MS,
    );
    return () => {
      clearTimeout(timer);
      setGraceElapsed(false);
    };
  }, [status]);

  const show =
    status === "offline" || (status === "reconnecting" && graceElapsed);
  if (!show) return null;

  return (
    <div
      role="alert"
      className="flex shrink-0 items-start gap-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-ink"
    >
      <WifiSlashIcon size={18} className="mt-0.5 shrink-0 text-warning" />
      <span>
        {status === "offline"
          ? "You're offline. What you see may be out of date, and changes you make won't save until you're back online."
          : "Connection lost — reconnecting. What you see may be out of date."}
      </span>
    </div>
  );
}
