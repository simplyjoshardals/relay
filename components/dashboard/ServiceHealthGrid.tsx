import { serviceStatusMeta, type Service } from "@/types";
import {
  formatErrorRate,
  relativeTime,
  statusDot,
  statusText,
} from "@/lib/style";

function Sparkline({ values, warn }: { values: number[]; warn: boolean }) {
  if (values.length < 2) {
    return <span className="text-xs text-ink-faint">—</span>;
  }

  const w = 64;
  const h = 20;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className="overflow-visible"
    >
      <polyline
        points={points}
        fill="none"
        strokeWidth="1.5"
        className={warn ? "stroke-warning" : "stroke-ink-faint"}
      />
    </svg>
  );
}

export function ServiceHealthGrid({ services }: { services: Service[] }) {
  return (
    <div className="rounded-lg border border-line bg-panel">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="text-sm font-medium text-ink">Service health</h2>
        <span className="text-xs text-ink-faint">Trend is since page load</span>
      </div>

      <div className="grid grid-cols-1 gap-px bg-line sm:grid-cols-2 lg:grid-cols-3">
        {services.map((service) => {
          const meta = serviceStatusMeta[service.status];
          const warn = service.status !== "OPERATIONAL";

          return (
            <div key={service.id} className="bg-panel p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-ink">{service.name}</span>
                <span
                  className={`size-1.5 rounded-full ${statusDot[meta.color]}`}
                />
              </div>
              <div className={`mt-0.5 text-xs ${statusText[meta.color]}`}>
                {meta.label}
              </div>

              <div className="mt-3 flex items-end justify-between">
                <div className="font-mono text-xs text-ink-dim tabular-nums space-y-1">
                  <div>
                    {service.status === "OUTAGE"
                      ? "—"
                      : `${service.latencyMs}ms`}
                  </div>
                  <div className={service.errorRate > 1 ? "text-warning" : ""}>
                    {formatErrorRate(service.errorRate)} err
                  </div>
                </div>
                <Sparkline values={service.sessionLatencyTrend} warn={warn} />
              </div>

              <div className="mt-2 text-[11px] text-ink-faint">
                Updated {relativeTime(service.updatedAt)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
