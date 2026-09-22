"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PlusIcon } from "@phosphor-icons/react";
import { FilterPill } from "@/components/shared/FilterPill";
import { SearchInput } from "@/components/shared/SearchInput";
import { Sparkline } from "@/components/shared/Sparkline";
import {
  ServiceModal,
  type CreateServiceFields,
  type UpdateServiceFields,
} from "@/components/services/ServiceModal";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useToast } from "@/components/shared/Toast";
import { ActionFailure, failureMessage, unwrap } from "@/lib/action-result";
import {
  createServiceAction,
  listServicesAction,
  updateServiceAction,
} from "@/app/(dashboard)/services/actions";
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

// How many points the client-side latency sparkline keeps per service.
// Not persisted anywhere (types/index.ts) — just enough to draw a short
// trend line since this tab was opened.
const MAX_TREND_POINTS = 20;

// Stable reference for the "not loaded yet" fallback, same reasoning as
// TicketsView's EMPTY_TICKETS: a fresh `?? []` every render would defeat
// the useMemo()s below.
const EMPTY_SERVICES: Service[] = [];

const SERVICE_LIST_KEY = ["services", "list"] as const;

interface ServicesViewProps {
  /** Still mock data (Milestone 5 hasn't landed) — see
   *  app/(dashboard)/services/page.tsx. Services themselves are real. */
  incidents: Incident[];
  self: User;
}

type ModalState =
  | { mode: "create" }
  | { mode: "edit"; service: Service }
  | { mode: "confirm-archive"; service: Service }
  | null;

/**
 * Services are real (Milestone 4) and follow the same reliability
 * pattern tickets got in Milestone 8 (see TicketsView's doc comment):
 * optimistic patch on `onMutate`, rollback on `onError`, always
 * invalidate on `onSettled` so the server's version wins. Creates aren't
 * optimistic — the server assigns the id.
 *
 * Status/latency/errorRate never change through this view's own
 * mutations — those are telemetry-owned (§13) and arrive via the
 * `service.updated` realtime invalidation the telemetry worker
 * triggers, debounced client-side (RealtimeProvider, §7).
 */
export function ServicesView({ incidents, self }: ServicesViewProps) {
  const now = useNow();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ServiceStatus | "ALL">(
    "ALL",
  );
  const [showArchived, setShowArchived] = useState(false);
  const [modalState, setModalState] = useState<ModalState>(null);

  const canManage = canManageServices(self.role);

  const servicesQuery = useQuery({
    queryKey: SERVICE_LIST_KEY,
    queryFn: listServicesAction,
  });

  const serviceList = servicesQuery.data ?? EMPTY_SERVICES;

  // README §19/types/index.ts: sessionLatencyTrend is never persisted —
  // buffered client-side from updates received since the page loaded, so
  // it's accumulated here as each refetch (realtime-triggered or not)
  // lands, rather than coming from the query result itself.
  const [trends, setTrends] = useState<Record<string, number[]>>({});

  useEffect(() => {
    if (!servicesQuery.data) return;

    setTrends((prev) => {
      let changed = false;
      const next = { ...prev };

      for (const service of servicesQuery.data) {
        const points = next[service.id] ?? [];
        const last = points[points.length - 1];
        if (last === service.latencyMs) continue;

        next[service.id] = [...points, service.latencyMs].slice(
          -MAX_TREND_POINTS,
        );
        changed = true;
      }

      return changed ? next : prev;
    });
  }, [servicesQuery.data]);

  const invalidateServices = (id?: string) => {
    queryClient.invalidateQueries({ queryKey: SERVICE_LIST_KEY });
    if (id) queryClient.invalidateQueries({ queryKey: ["services", id] });
  };

  const createMutation = useMutation({
    mutationFn: async (input: CreateServiceFields) =>
      unwrap(await createServiceAction(input)),
    onSuccess: () => {
      invalidateServices();
      toast.show("Service added");
      setModalState(null);
    },
    onError: (error) =>
      toast.show(failureMessage(error, "created", "service"), "error"),
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      serviceId,
      input,
    }: {
      serviceId: string;
      input: Partial<UpdateServiceFields> & {
        expectedVersion: number;
        archived?: boolean;
      };
    }) => unwrap(await updateServiceAction(serviceId, input)),

    onMutate: async ({ serviceId, input }) => {
      // Stop an in-flight refetch (e.g. a realtime invalidation from the
      // telemetry worker) from landing on top of the optimistic patch
      // and undoing it — same reasoning as TicketsView's updateMutation.
      await queryClient.cancelQueries({ queryKey: SERVICE_LIST_KEY });
      const previous = queryClient.getQueryData<Service[]>(SERVICE_LIST_KEY);

      queryClient.setQueryData<Service[]>(SERVICE_LIST_KEY, (old) =>
        old?.map((s) =>
          s.id === serviceId
            ? {
                ...s,
                ...(input.name !== undefined ? { name: input.name } : {}),
                ...(input.description !== undefined
                  ? { description: input.description }
                  : {}),
                ...(input.archived !== undefined
                  ? { archived: input.archived }
                  : {}),
                updatedAt: new Date().toISOString(),
                // `version`/status/latency/errorRate deliberately
                // untouched — only the server (or the telemetry worker)
                // gets to say what those are.
              }
            : s,
        ),
      );

      return { previous };
    },

    onError: (error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(SERVICE_LIST_KEY, context.previous);
      }

      if (error instanceof ActionFailure && error.error.code === "conflict") {
        toast.show(
          "Someone else changed this service first, so your change wasn't saved.",
          "error",
        );
        return;
      }
      toast.show(failureMessage(error, "updated", "service"), "error");
    },

    onSettled: (_data, _error, variables) => {
      invalidateServices(variables.serviceId);
    },
  });

  const archiveService = (service: Service) => {
    updateMutation.mutate(
      {
        serviceId: service.id,
        input: { archived: true, expectedVersion: service.version },
      },
      { onSuccess: () => toast.show("Service archived") },
    );
  };

  const restoreService = (service: Service) => {
    updateMutation.mutate(
      {
        serviceId: service.id,
        input: { archived: false, expectedVersion: service.version },
      },
      { onSuccess: () => toast.show("Service restored") },
    );
  };

  // Same live-row-from-cache reasoning as TicketsView's editingTicket —
  // this is how the modal notices a concurrent change (version-conflict
  // UX) instead of only ever seeing the snapshot from when it opened.
  const editingService =
    modalState?.mode === "edit"
      ? (serviceList.find((s) => s.id === modalState.service.id) ??
        modalState.service)
      : null;

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

  // Archived services never appear at all for Member — the toggle to see
  // them only exists for Manager, since only Manager can act on them
  // (restore). README §19: archiving hides from the default view without
  // destroying the record, unlike the hard-delete this replaced.
  const unarchived = useMemo(
    () => serviceList.filter((s) => !s.archived),
    [serviceList],
  );
  const archivedCount = serviceList.length - unarchived.length;
  const baseList = canManage && showArchived ? serviceList : unarchived;

  const searched = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return baseList;

    return baseList.filter(
      (s) =>
        s.name.toLowerCase().includes(query) ||
        s.description.toLowerCase().includes(query),
    );
  }, [baseList, search]);

  const filtered = useMemo(() => {
    const byStatus =
      statusFilter === "ALL"
        ? searched
        : searched.filter((s) => s.status === statusFilter);

    return [...byStatus].sort((a, b) => {
      if (a.archived !== b.archived) return a.archived ? 1 : -1;

      const byStatusRank = statusRank[a.status] - statusRank[b.status];

      if (byStatusRank !== 0) return byStatusRank;

      return a.name.localeCompare(b.name);
    });
  }, [searched, statusFilter]);

  const unhealthyCount = unarchived.filter(
    (s) => s.status !== "OPERATIONAL",
  ).length;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex shrink-0 items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-medium text-ink">Services</h1>

          <p className="text-sm text-ink-dim">
            {unarchived.length} monitored
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

              {canManage && archivedCount > 0 && (
                <FilterPill
                  active={showArchived}
                  onClick={() => setShowArchived((v) => !v)}
                  label="Archived"
                  count={archivedCount}
                />
              )}
            </div>

            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search services"
            />
          </div>
        </div>

        {servicesQuery.isLoading ? (
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-8 text-center text-sm text-ink-dim">
            Loading services…
          </div>
        ) : servicesQuery.isError ? (
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-8 text-center text-sm text-danger">
            Couldn&apos;t load services.{" "}
            <button
              type="button"
              onClick={() => servicesQuery.refetch()}
              className="underline hover:text-ink"
            >
              Try again
            </button>
          </div>
        ) : filtered.length === 0 ? (
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

                const trend = trends[service.id] ?? [];

                return (
                  <div
                    key={service.id}
                    data-testid={`service-card-${service.name}`}
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
                    className={`bg-panel p-4 transition-colors ${canManage ? "cursor-pointer hover:bg-panel-raised" : ""} ${service.archived ? "opacity-50" : ""}`}
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

                      {service.archived ? (
                        <span className="shrink-0 rounded bg-panel-raised px-1.5 py-0.5 text-[11px] font-medium text-ink-faint">
                          Archived
                        </span>
                      ) : (
                        <span
                          className={`flex shrink-0 items-center gap-1.5 rounded px-1.5 py-0.5 text-[11px] font-medium ${statusChipBg[meta.color]} ${statusText[meta.color]}`}
                        >
                          <span
                            className={`size-1.5 rounded-full ${statusDot[meta.color]}`}
                          />

                          {meta.label}
                        </span>
                      )}
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

                      <Sparkline values={trend} warn={warn} />
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
            service={editingService}
            saving={createMutation.isPending || updateMutation.isPending}
            onClose={() => setModalState(null)}
            onCreate={(input) => createMutation.mutate(input)}
            onUpdate={(input) => {
              if (modalState.mode !== "edit") return;
              updateMutation.mutate(
                { serviceId: modalState.service.id, input },
                {
                  onSuccess: () => {
                    toast.show("Service updated");
                    setModalState(null);
                  },
                },
              );
            }}
            onRequestArchive={(service) =>
              setModalState({ mode: "confirm-archive", service })
            }
            onRestore={(service) => {
              restoreService(service);
              setModalState(null);
            }}
          />
        )}

      {canManage && modalState?.mode === "confirm-archive" && (
        <ConfirmDialog
          title="Archive service?"
          message={`"${modalState.service.name}" will be hidden from the default view and won't be monitored going forward. Nothing is deleted — you can restore it any time from the Archived filter.`}
          confirmLabel="Archive service"
          destructive={false}
          onConfirm={() => {
            archiveService(modalState.service);
            setModalState(null);
          }}
          onCancel={() => setModalState(null)}
        />
      )}
    </div>
  );
}
