interface Stat {
  label: string;
  value: number;
  tone?: "danger" | "warning";
}

export function StatRow({ stats }: { stats: Stat[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {stats.map((stat) => {
        const alert = stat.tone && stat.value > 0;
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
            <div
              className={`mt-1 font-mono text-2xl font-medium tabular-nums ${
                alert
                  ? stat.tone === "danger"
                    ? "text-danger"
                    : "text-warning"
                  : "text-ink"
              }`}
            >
              {stat.value}
            </div>
          </div>
        );
      })}
    </div>
  );
}
