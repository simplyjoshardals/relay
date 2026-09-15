interface LiveIndicatorProps {
  connected?: boolean;
}

/** RT-02 / RT-03: the realtime connection state has to be visible, not
 *  just implied by data updating. Connected is quiet; reconnecting is not. */
export function LiveIndicator({ connected = true }: LiveIndicatorProps) {
  if (!connected) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-warning/10 px-2.5 py-1 text-xs font-medium text-warning">
        <span className="size-1.5 rounded-full bg-warning" />
        Reconnecting
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-signal-dim px-2.5 py-1 text-xs font-medium text-signal">
      <span className="relative flex size-1.5">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-signal opacity-75" />
        <span className="relative inline-flex size-1.5 rounded-full bg-signal" />
      </span>
      Live
    </span>
  );
}