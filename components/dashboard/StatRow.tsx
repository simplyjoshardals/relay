import { Skeleton } from "@/components/shared/Skeleton";

interface Stat {
  label: string;
  /** `null` means "still loading" — renders a skeleton in place of the
   *  number (Milestone 9: each stat is derived from a different query,
   *  so they can resolve at different times). Ignored when `error` is
   *  true. */
  value: number | null;
  tone?: "danger" | "warning";
  /** The query this stat is derived from failed. Takes priority over
   *  `value`/loading — the corresponding panel below has the actual
   *  "Try again" retry affordance, so this is just a glance-level
   *  signal that the number isn't trustworthy right now, not another
   *  place to retry from. */
  error?: boolean;
}

export function StatRow({ stats }: { stats: Stat[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {stats.map((stat) => {
        const { value, error } = stat;
        const loading = !error && value === null;
        const alert = !error && value !== null && stat.tone && value > 0;
        return (
          <div
            key={stat.label}
            className={
              alert
                ? `rounded-lg border p-3.5 ${
                    stat.tone === "danger"
                      ? "border-danger/25 bg-danger/6"
                      : "border-warning/25 bg-warning/6"
                  }`
                : "rounded-lg border border-line bg-panel p-3.5"
            }
          >
            <div className="text-xs text-ink-dim">{stat.label}</div>
            {error ? (
              <div
                className="mt-1 font-mono text-2xl font-medium text-ink-faint"
                title="Couldn't load"
              >
                —
              </div>
            ) : loading ? (
              <Skeleton className="mt-1.5 h-7 w-10" />
            ) : (
              <div
                className={`mt-1 font-mono text-2xl font-medium tabular-nums ${
                  alert
                    ? stat.tone === "danger"
                      ? "text-danger"
                      : "text-warning"
                    : "text-ink"
                }`}
              >
                {value}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
