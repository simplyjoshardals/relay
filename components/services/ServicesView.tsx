"use client";

import { useMemo, useState } from "react";
import { PlusIcon } from "@phosphor-icons/react";
import { FilterPill } from "@/components/shared/FilterPill";
import { SearchInput } from "@/components/shared/SearchInput";
import { Sparkline } from "@/components/shared/Sparkline";
import { ServiceModal } from "@/components/services/ServiceModal";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import {
  incidentSeverityMeta,
  serviceStatusMeta,
  type Incident,
  type Service,
  type ServiceStatus,
  type User,
} from "@/types";
import {
  formatErrorRate,
  relativeTime,
  statusChipBg,
  statusDot,
  statusText,
} from "@/lib/style";
import { useNow } from "@/lib/use-now";
import { canManageServices } from "@/lib/permissions";

const statusRank: Record<ServiceStatus, number> = {
  OUTAGE: 0,
  DEGRADED: 1,
  OPERATIONAL: 2,
};

const statusFilters: ServiceStatus[] = ["OPERATIONAL", "DEGRADED", "OUTAGE"];

interface ServicesViewProps {
  services: Service[];
  incidents: Incident[];
  self: User;
}

type ModalState =
  | { mode: "create" }
  | { mode: "edit"; service: Service }
  | { mode: "confirm-remove"; service: Service }
  | null;

export function ServicesView({ services, incidents, self }: ServicesViewProps) {
  const now = useNow();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ServiceStatus | "ALL">(
    "ALL",
  );
  const [modalState, setModalState] = useState<ModalState>(null);

  // Local-only, optimistic state — same reasoning as Tickets/Incidents:
  // no backend yet, so mutations live here and reset on reload.
  const [serviceList, setServiceList] = useState(services);

  const canManage = canManageServices(self.role);

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

    if (!query) return serviceList;

    return serviceList.filter(
      (s) =>
        s.name.toLowerCase().includes(query) ||
        s.description.toLowerCase().includes(query),
    );
  }, [serviceList, search]);

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

  const unhealthyCount = serviceList.filter(
    (s) => s.status !== "OPERATIONAL",
  ).length;

  const upsertService = (saved: Service) => {
    setServiceList((prev) => {
      const exists = prev.some((s) => s.id === saved.id);
      return exists
        ? prev.map((s) => (s.id === saved.id ? saved : s))
        : [saved, ...prev];
    });
  };

  const removeService = (service: Service) => {
    setServiceList((prev) => prev.filter((s) => s.id !== service.id));
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex shrink-0 items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-medium text-ink">Services</h1>

          <p className="text-sm text-ink-dim">
            {serviceList.length} monitored
            {unhealthyCount > 0 && ` · ${unhealthyCount} degraded or down`}
          </p>
        </div>

        {canManage && (
          <button
            type="button"
            onClick={() => setModalState({ mode: "create" })}
            className="flex shrink-0 items-center gap-1.5 rounded-md bg-ink px-3 py-1.5 text-sm font-medium text-bg transition-opacity hover:opacity-90"
          >
            <PlusIcon size={14} weight="bold" />
            New service
          </button>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-line bg-panel">
        <div className="shrink-0 border-b border-line px-4 py-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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

            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search services"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-8 text-center text-sm text-ink-dim">
            No services match your filters.
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="grid grid-cols-1 gap-px bg-line sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((service) => {
                const meta = serviceStatusMeta[service.status];

                const warn = service.status !== "OPERATIONAL";

                const affectingIncidents =
                  activeIncidentsByService.get(service.id) ?? [];

                return (
                  <div
                    key={service.id}
                    role={canManage ? "button" : undefined}
                    tabIndex={canManage ? 0 : undefined}
                    onClick={
                      canManage
                        ? () => setModalState({ mode: "edit", service })
                        : undefined
                    }
                    onKeyDown={
                      canManage
                        ? (e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setModalState({ mode: "edit", service });
                            }
                          }
                        : undefined
                    }
                    className={`bg-panel p-4 transition-colors ${canManage ? "cursor-pointer hover:bg-panel-raised" : ""}`}
                  >
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
                      <div className="space-y-1 font-mono text-xs tabular-nums text-ink-dim">
                        <div>
                          {service.status === "OUTAGE"
                            ? "—"
                            : `${service.latencyMs}ms`}
                        </div>

                        <div
                          className={
                            service.errorRate > 1 ? "text-warning" : ""
                          }
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
                      Updated {relativeTime(service.updatedAt, now)}
                    </div>

                    {affectingIncidents.length > 0 && (
                      <ul className="mt-3 flex flex-col gap-1.5 border-t border-line pt-3">
                        {affectingIncidents.map((incident) => {
                          const sevMeta =
                            incidentSeverityMeta[incident.severity];

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
          </div>
        )}
      </div>

      {canManage &&
        (modalState?.mode === "create" || modalState?.mode === "edit") && (
          <ServiceModal
            service={modalState.mode === "edit" ? modalState.service : null}
            self={self}
            onClose={() => setModalState(null)}
            onSave={upsertService}
            onRequestRemove={(service) =>
              setModalState({ mode: "confirm-remove", service })
            }
          />
        )}

      {canManage && modalState?.mode === "confirm-remove" && (
        <ConfirmDialog
          title="Remove service?"
          message={`This removes "${modalState.service.name}" from the catalog. There's no soft-delete yet, so this can't be undone.`}
          confirmLabel="Remove service"
          onConfirm={() => {
            removeService(modalState.service);
            setModalState(null);
          }}
          onCancel={() => setModalState(null)}
        />
      )}
    </div>
  );
}
