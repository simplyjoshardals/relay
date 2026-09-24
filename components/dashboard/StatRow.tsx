import { Skeleton } from "@/components/shared/Skeleton";

interface Stat {
  label: string;
  /** `null` means "still loading" — renders a skeleton in place of the
   *  number (Milestone 9: each stat is derived from a different query,
   *  so they can resolve at different times). */
  value: number | null;
  tone?: "danger" | "warning";
}

export function StatRow({ stats }: { stats: Stat[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {stats.map((stat) => {
        const { value } = stat;
        const loading = value === null;
        const alert = value !== null && stat.tone && value > 0;
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
            {loading ? (
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
