"use client";

import { useMemo, useState } from "react";
import { MagnifyingGlassIcon } from "@phosphor-icons/react";
import { Sparkline } from "@/components/shared/Sparkline";
import {
  incidentSeverityMeta,
  serviceStatusMeta,
  type Incident,
  type Service,
  type ServiceStatus,
} from "@/types";
import {
  formatErrorRate,
  relativeTime,
  statusChipBg,
  statusDot,
  statusText,
} from "@/lib/style";

// Worst-first (SM-04: "clearly communicate degraded or unavailable
// services") rather than alphabetical or enum-declaration order.
const statusRank: Record<ServiceStatus, number> = {
  OUTAGE: 0,
  DEGRADED: 1,
  OPERATIONAL: 2,
};

const statusFilters: ServiceStatus[] = ["OPERATIONAL", "DEGRADED", "OUTAGE"];

interface ServicesViewProps {
  services: Service[];
  incidents: Incident[];
}

export function ServicesView({ services, incidents }: ServicesViewProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ServiceStatus | "ALL">(
    "ALL",
  );

  // Service status and incidents are deliberately separate concepts
  // (README §8.3) — this just looks up which *open* incidents currently
  // reference a service, it never derives or overrides that service's own
  // status.
  const activeIncidentsByService = useMemo(() => {
    const map = new Map<string, Incident[]>();
    for (const incident of incidents) {
      if (incident.status === "RESOLVED") continue;
      for (const serviceId of incident.serviceIds) {
        const existing = map.get(serviceId) ?? [];
        existing.push(incident);
        map.set(serviceId, existing);
      }
    }
    return map;
  }, [incidents]);

  const searched = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return services;
    return services.filter(
      (s) =>
        s.name.toLowerCase().includes(query) ||
        s.description.toLowerCase().includes(query),
    );
  }, [services, search]);

  const filtered = useMemo(() => {
    const byStatus =
      statusFilter === "ALL"
        ? searched
        : searched.filter((s) => s.status === statusFilter);

    return [...byStatus].sort((a, b) => {
      const byStatusRank = statusRank[a.status] - statusRank[b.status];
      if (byStatusRank !== 0) return byStatusRank;
      return a.name.localeCompare(b.name);
    });
  }, [searched, statusFilter]);

  const unhealthyCount = services.filter(
    (s) => s.status !== "OPERATIONAL",
  ).length;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-medium text-ink">Services</h1>
        <p className="text-sm text-ink-dim">
          {services.length} monitored
          {unhealthyCount > 0 && ` · ${unhealthyCount} degraded or down`}
        </p>
      </div>

      <div className="rounded-lg border border-line bg-panel">
        <div className="flex flex-col gap-3 border-b border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-1">
            <FilterPill
              active={statusFilter === "ALL"}
              onClick={() => setStatusFilter("ALL")}
              label="All"
              count={searched.length}
            />
            {statusFilters.map((status) => (
              <FilterPill
                key={status}
                active={statusFilter === status}
                onClick={() => setStatusFilter(status)}
                label={serviceStatusMeta[status].label}
                count={searched.filter((s) => s.status === status).length}
              />
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <MagnifyingGlassIcon
              size={14}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search services"
              className="w-full rounded-md border border-line bg-panel-raised py-1.5 pl-8 pr-3 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-1 focus:ring-signal"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-ink-dim">
            No services match your filters.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-px bg-line sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((service) => {
              const meta = serviceStatusMeta[service.status];
              const warn = service.status !== "OPERATIONAL";
              const affectingIncidents =
                activeIncidentsByService.get(service.id) ?? [];

              return (
                <div key={service.id} className="bg-panel p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm text-ink">
                        {service.name}
                      </div>
                      <div className="mt-0.5 truncate text-xs text-ink-faint">
                        {service.description}
                      </div>
                    </div>
                    <span
                      className={`flex shrink-0 items-center gap-1.5 rounded px-1.5 py-0.5 text-[11px] font-medium ${statusChipBg[meta.color]} ${statusText[meta.color]}`}
                    >
                      <span
                        className={`size-1.5 rounded-full ${statusDot[meta.color]}`}
                      />
                      {meta.label}
                    </span>
                  </div>

                  <div className="mt-3 flex items-end justify-between">
                    <div className="font-mono text-xs text-ink-dim tabular-nums space-y-1">
                      <div>
                        {service.status === "OUTAGE"
                          ? "—"
                          : `${service.latencyMs}ms`}
                      </div>
                      <div
                        className={service.errorRate > 1 ? "text-warning" : ""}
                      >
                        {formatErrorRate(service.errorRate)} err
                      </div>
                    </div>
                    <Sparkline
                      values={service.sessionLatencyTrend}
                      warn={warn}
                    />
                  </div>

                  <div className="mt-2 text-[11px] text-ink-faint">
                    Updated {relativeTime(service.updatedAt)}
                  </div>

                  {affectingIncidents.length > 0 && (
                    <ul className="mt-3 flex flex-col gap-1.5 border-t border-line pt-3">
                      {affectingIncidents.map((incident) => {
                        const sevMeta = incidentSeverityMeta[incident.severity];
                        return (
                          <li
                            key={incident.id}
                            className="flex items-center gap-2 text-xs"
                          >
                            <span
                              className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${statusChipBg[sevMeta.color]} ${statusText[sevMeta.color]}`}
                            >
                              {sevMeta.label}
                            </span>
                            <span className="truncate text-ink-dim">
                              {incident.title}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "rounded-md px-3 py-1.5 text-xs font-medium text-ink bg-panel-raised"
          : "rounded-md px-3 py-1.5 text-xs text-ink-dim transition-colors hover:text-ink"
      }
    >
      {label} <span className="text-ink-faint">{count}</span>
    </button>
  );
}
