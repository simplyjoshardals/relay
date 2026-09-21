import type { RealtimeStatus } from "@/components/shared/RealtimeProvider";

interface LiveIndicatorProps {
  status?: RealtimeStatus;
}

/** RT-02 / RT-03: the realtime connection state has to be visible, not
 *  just implied by data updating. Connected is quiet; anything else is
 *  not — and "no network" reads differently from "reconnecting". */
export function LiveIndicator({ status = "connected" }: LiveIndicatorProps) {
  if (status === "offline") {
    return (
      <span
        role="status"
        className="inline-flex items-center gap-1.5 rounded-full bg-danger/10 px-2.5 py-1 text-xs font-medium text-danger"
      >
        <span className="size-1.5 rounded-full bg-danger" />
        Offline
      </span>
    );
  }

  if (status === "reconnecting") {
    return (
      <span
        role="status"
        className="inline-flex items-center gap-1.5 rounded-full bg-warning/10 px-2.5 py-1 text-xs font-medium text-warning"
      >
        <span className="size-1.5 rounded-full bg-warning" />
        Reconnecting
      </span>
    );
  }

  if (status === "connecting") {
    return (
      <span
        role="status"
        className="inline-flex items-center gap-1.5 rounded-full bg-panel-raised px-2.5 py-1 text-xs font-medium text-ink-dim"
      >
        <span className="size-1.5 rounded-full bg-ink-faint" />
        Connecting
      </span>
    );
  }

  return (
    <span
      role="status"
      className="inline-flex items-center gap-1.5 rounded-full bg-signal-dim px-2.5 py-1 text-xs font-medium text-signal"
    >
      <span className="relative flex size-1.5">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-signal opacity-75" />
        <span className="relative inline-flex size-1.5 rounded-full bg-signal" />
      </span>
      Live
    </span>
  );
}
