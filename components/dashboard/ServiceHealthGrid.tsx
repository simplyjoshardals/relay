import { Sparkline } from "@/components/shared/Sparkline";
import { Skeleton, SkeletonText } from "@/components/shared/Skeleton";
import { serviceStatusMeta, type Service } from "@/types";
import {
  formatErrorRate,
  relativeTime,
  statusDot,
  statusText,
} from "@/lib/style";

interface ServiceHealthGridProps {
  services: Service[];
  /** Milestone 9: set by DashboardView while its services query is
   *  still `isLoading` — see IncidentsPanel's `loading` prop for the
   *  same reasoning. */
  loading?: boolean;
  /** The services query failed. */
  error?: boolean;
  onRetry?: () => void;
}

export function ServiceHealthGrid({
  services,
  loading,
  error,
  onRetry,
}: ServiceHealthGridProps) {
  if (loading) {
    return (
      <div className="rounded-lg border border-line bg-panel">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-sm font-medium text-ink">Service health</h2>
        </div>

        <div className="grid grid-cols-1 gap-px bg-line sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="bg-panel p-3.5">
              <div className="flex items-center justify-between">
                <SkeletonText width="w-20" />
                <Skeleton className="size-1.5 rounded-full" />
              </div>
              <SkeletonText width="w-14" className="mt-2 h-2.5" />
              <div className="mt-3 flex items-end justify-between">
                <Skeleton className="h-7 w-10" />
                <Skeleton className="h-5 w-16" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-line bg-panel p-5">
        <div className="text-sm text-danger">
          Couldn&apos;t load service health.{" "}
          <button
            type="button"
            onClick={onRetry}
            className="underline hover:text-ink"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

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
                {/* Server Component (no "use client") — this never
                    hydrates/re-executes on the client, so a plain
                    `new Date()` here is safe and doesn't need useNow(). */}
                Updated {relativeTime(service.updatedAt, new Date())}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
