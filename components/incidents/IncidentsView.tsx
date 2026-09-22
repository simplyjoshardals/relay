"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PlusIcon } from "@phosphor-icons/react";
import { Avatar } from "@/components/dashboard/Avatar";
import { FilterPill } from "@/components/shared/FilterPill";
import { SearchInput } from "@/components/shared/SearchInput";
import {
  IncidentModal,
  type CreateIncidentFields,
  type UpdateIncidentFields,
} from "@/components/incidents/IncidentModal";
import { useToast } from "@/components/shared/Toast";
import { ActionFailure, failureMessage, unwrap } from "@/lib/action-result";
import {
  createIncidentAction,
  listIncidentsAction,
  updateIncidentAction,
} from "@/app/(dashboard)/incidents/actions";
import { listServicesAction } from "@/app/(dashboard)/services/actions";
import {
  listOrgUsersAction,
  listTicketsAction,
} from "@/app/(dashboard)/tickets/actions";
import {
  incidentSeverityMeta,
  incidentStatusMeta,
  type Incident,
  type IncidentStatus,
  type Service,
  type Ticket,
  type User,
} from "@/types";
import {
  formatDuration,
  relativeTime,
  statusBorderLeft,
  statusChipBg,
  statusDot,
  statusText,
} from "@/lib/style";
import { useNow } from "@/lib/use-now";

const severityOrder = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

const statusFilters: IncidentStatus[] = [
  "INVESTIGATING",
  "IDENTIFIED",
  "MONITORING",
  "RESOLVED",
];

// Stable references for the "not loaded yet" fallback, same reasoning
// as TicketsView's EMPTY_TICKETS: a fresh `?? []` every render would
// defeat the useMemo()s below that depend on these.
const EMPTY_INCIDENTS: Incident[] = [];
const EMPTY_SERVICES: Service[] = [];
const EMPTY_TICKETS: Ticket[] = [];
const EMPTY_USERS: User[] = [];

const INCIDENT_LIST_KEY = ["incidents", "list"] as const;

interface IncidentsViewProps {
  self: User;
}

type ModalState =
  | { mode: "create" }
  | { mode: "edit"; incident: Incident }
  | null;

/**
 * Incidents are real (Milestone 5) and follow the same reliability
 * pattern tickets/services got in Milestone 8 (see TicketsView's doc
 * comment, and BACKEND_ROADMAP.md's M8 "Still to do" note this closes
 * out): optimistic patch on `onMutate`, rollback on `onError`, always
 * invalidate on `onSettled` so the server's version wins. Creates
 * aren't optimistic — the server assigns the id.
 *
 * Services, tickets, and users are all real by this point too (M2/M4),
 * so this fetches them itself for the checklist/responder pickers
 * rather than taking them as props — a mock ticket/service id in a
 * checklist wouldn't reference a real foreign key at all.
 */
export function IncidentsView({ self }: IncidentsViewProps) {
  const now = useNow();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<IncidentStatus | "ALL">(
    "ALL",
  );
  const [modalState, setModalState] = useState<ModalState>(null);

  const incidentsQuery = useQuery({
    queryKey: INCIDENT_LIST_KEY,
    queryFn: listIncidentsAction,
  });

  const servicesQuery = useQuery({
    queryKey: ["services", "list"],
    queryFn: listServicesAction,
  });

  const ticketsQuery = useQuery({
    queryKey: ["tickets", "list"],
    queryFn: listTicketsAction,
  });

  const usersQuery = useQuery({
    queryKey: ["org-users", "list"],
    queryFn: listOrgUsersAction,
  });

  const services = servicesQuery.data ?? EMPTY_SERVICES;
  const tickets = ticketsQuery.data ?? EMPTY_TICKETS;
  const users = usersQuery.data ?? EMPTY_USERS;

  const userById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const resolveUser = (id: string | null): User | null =>
    id ? (userById.get(id) ?? null) : null;

  const serviceById = useMemo(
    () => new Map(services.map((s) => [s.id, s])),
    [services],
  );

  // §7's exact invalidation pattern — same reasoning TicketsView's
  // invalidateTickets documents.
  const invalidateIncidents = (id?: string) => {
    queryClient.invalidateQueries({ queryKey: INCIDENT_LIST_KEY });
    if (id) queryClient.invalidateQueries({ queryKey: ["incidents", id] });
  };

  const createMutation = useMutation({
    mutationFn: async (input: CreateIncidentFields) =>
      unwrap(await createIncidentAction(input)),
    onSuccess: () => {
      invalidateIncidents();
      toast.show("Incident created");
      setModalState(null);
    },
    onError: (error) =>
      toast.show(failureMessage(error, "created", "incident"), "error"),
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      incidentId,
      input,
    }: {
      incidentId: string;
      input: UpdateIncidentFields;
    }) => unwrap(await updateIncidentAction(incidentId, input)),

    onMutate: async ({ incidentId, input }) => {
      // Stop an in-flight refetch (e.g. from a realtime invalidation)
      // from landing on top of the optimistic patch and undoing it —
      // same reasoning as TicketsView/ServicesView's updateMutation.
      await queryClient.cancelQueries({ queryKey: INCIDENT_LIST_KEY });
      const previous = queryClient.getQueryData<Incident[]>(INCIDENT_LIST_KEY);

      queryClient.setQueryData<Incident[]>(INCIDENT_LIST_KEY, (old) =>
        old?.map((i) =>
          i.id === incidentId
            ? {
                ...i,
                title: input.title,
                description: input.description,
                status: input.status,
                severity: input.severity,
                responderId: input.responderId,
                serviceIds: input.serviceIds,
                ticketIds: input.ticketIds,
                // `version`/`resolvedAt` deliberately untouched — only
                // the server gets to say what those are (resolvedAt in
                // particular depends on the *previous* status, which
                // this optimistic patch doesn't have enough context to
                // recompute correctly).
              }
            : i,
        ),
      );

      return { previous };
    },

    onError: (error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(INCIDENT_LIST_KEY, context.previous);
      }

      if (error instanceof ActionFailure && error.error.code === "conflict") {
        toast.show(
          "Someone else changed this incident first, so your change wasn't saved.",
          "error",
        );
        return;
      }

      // §2/§8.1's partial-unique-index conflict — a linked ticket is
      // already actively linked to a different incident. Distinct
      // message from the plain version conflict above, per
      // BACKEND_ROADMAP.md's M8 note that this needs its own copy.
      if (
        error instanceof ActionFailure &&
        error.error.code === "ticket_conflict"
      ) {
        toast.show(error.error.message, "error");
        return;
      }

      toast.show(failureMessage(error, "updated", "incident"), "error");
    },

    onSettled: (_data, _error, variables) => {
      invalidateIncidents(variables.incidentId);
    },
  });

  const respond = (incident: Incident) => {
    updateMutation.mutate(
      {
        incidentId: incident.id,
        input: {
          title: incident.title,
          description: incident.description,
          status: incident.status,
          severity: incident.severity,
          responderId: self.id,
          serviceIds: incident.serviceIds,
          ticketIds: incident.ticketIds,
          expectedVersion: incident.version,
        },
      },
      { onSuccess: () => toast.show("You're responding") },
    );
  };

  const incidentList = incidentsQuery.data ?? EMPTY_INCIDENTS;

  // Same reasoning as TicketsView's editingTicket: the modal gets the
  // *live* row from the cache, not the snapshot taken when it was
  // opened, so it notices someone else changed the incident underneath
  // an open edit form (version-conflict UX).
  const editingIncident =
    modalState?.mode === "edit"
      ? (incidentList.find((i) => i.id === modalState.incident.id) ??
        modalState.incident)
      : null;

  const searched = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return incidentList;

    return incidentList.filter((i) => i.title.toLowerCase().includes(query));
  }, [incidentList, search]);

  const filtered = useMemo(() => {
    const byStatus =
      statusFilter === "ALL"
        ? searched
        : searched.filter((i) => i.status === statusFilter);

    return [...byStatus].sort((a, b) => {
      const aResolved = a.status === "RESOLVED";
      const bResolved = b.status === "RESOLVED";

      if (aResolved !== bResolved) {
        return aResolved ? 1 : -1;
      }

      if (!aResolved) {
        const bySeverity =
          severityOrder[a.severity] - severityOrder[b.severity];

        if (bySeverity !== 0) return bySeverity;

        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      }

      return (
        new Date(b.resolvedAt ?? b.createdAt).getTime() -
        new Date(a.resolvedAt ?? a.createdAt).getTime()
      );
    });
  }, [searched, statusFilter]);

  const activeCount = incidentList.filter(
    (i) => i.status !== "RESOLVED",
  ).length;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex shrink-0 items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-medium text-ink">Incidents</h1>
          <p className="text-sm text-ink-dim">
            {activeCount} active · {incidentList.length} total
          </p>
        </div>

        <button
          type="button"
          onClick={() => setModalState({ mode: "create" })}
          className="flex shrink-0 items-center gap-1.5 rounded-md bg-ink px-3 py-1.5 text-sm font-medium text-bg transition-opacity hover:opacity-90"
        >
          <PlusIcon size={14} weight="bold" />
          New incident
        </button>
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
                  label={incidentStatusMeta[status].label}
                  count={searched.filter((i) => i.status === status).length}
                />
              ))}
            </div>

            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search incidents"
            />
          </div>
        </div>

        {incidentsQuery.isLoading ? (
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-8 text-center text-sm text-ink-dim">
            Loading incidents…
          </div>
        ) : incidentsQuery.isError ? (
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-8 text-center text-sm text-danger">
            Couldn&apos;t load incidents.{" "}
            <button
              type="button"
              onClick={() => incidentsQuery.refetch()}
              className="underline hover:text-ink"
            >
              Try again
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-8 text-center text-sm text-ink-dim">
            No incidents match your filters.
          </div>
        ) : (
          <ul className="min-h-0 flex-1 overflow-y-auto">
            {filtered.map((incident) => {
              const sevMeta = incidentSeverityMeta[incident.severity];

              const statusMeta = incidentStatusMeta[incident.status];

              const responder = resolveUser(incident.responderId);

              const resolved = incident.status === "RESOLVED";

              const affectedServices = incident.serviceIds
                .map((id) => serviceById.get(id))
                .filter((s): s is Service => Boolean(s));

              const duration = resolved
                ? incident.resolvedAt
                  ? formatDuration(incident.createdAt, incident.resolvedAt)
                  : null
                : now
                  ? formatDuration(incident.createdAt, now.toISOString())
                  : null;

              return (
                <li
                  key={incident.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setModalState({ mode: "edit", incident })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setModalState({ mode: "edit", incident });
                    }
                  }}
                  className={`flex cursor-pointer items-center gap-4 border-l-2 border-b border-line px-4 py-3 last:border-b-0 transition-colors hover:bg-panel-raised ${statusBorderLeft[sevMeta.color]}`}
                >
                  <span
                    className={`hidden shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium sm:inline-block ${statusChipBg[sevMeta.color]} ${statusText[sevMeta.color]}`}
                  >
                    {sevMeta.label}
                  </span>

                  <span
                    className={`size-1.5 shrink-0 rounded-full sm:hidden ${statusDot[sevMeta.color]}`}
                  />

                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-ink">
                      {incident.title}
                    </div>

                    <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-ink-faint">
                      <span className={statusText[statusMeta.color]}>
                        {statusMeta.label}
                      </span>

                      <span>·</span>

                      <span>
                        {resolved
                          ? `Resolved ${relativeTime(
                              incident.resolvedAt ?? incident.createdAt,
                              now,
                            )}`
                          : `Opened ${relativeTime(incident.createdAt, now)}`}
                      </span>

                      {duration && (
                        <>
                          <span>·</span>
                          <span>
                            {resolved ? "took" : "open"} {duration}
                          </span>
                        </>
                      )}

                      {affectedServices.length > 0 && (
                        <>
                          <span className="hidden sm:inline">·</span>
                          <span className="hidden truncate sm:inline">
                            {affectedServices.map((s) => s.name).join(", ")}
                          </span>
                        </>
                      )}

                      {incident.ticketIds.length > 0 && (
                        <>
                          <span className="hidden sm:inline">·</span>
                          <span className="hidden sm:inline">
                            {incident.ticketIds.length}{" "}
                            {incident.ticketIds.length === 1
                              ? "ticket"
                              : "tickets"}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {responder ? (
                    <Avatar
                      initials={responder.initials}
                      seed={responder.id}
                      title={`${responder.name} responding`}
                    />
                  ) : resolved ? (
                    <span className="shrink-0 text-xs text-ink-faint">
                      Unassigned
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        respond(incident);
                      }}
                      className="shrink-0 rounded-full border border-dashed border-line-strong px-2 py-0.5 text-[11px] text-ink-faint transition-colors hover:border-signal hover:text-ink"
                    >
                      Respond
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {modalState && (
        <IncidentModal
          incident={modalState.mode === "edit" ? editingIncident : null}
          services={services}
          tickets={tickets}
          users={users}
          saving={createMutation.isPending || updateMutation.isPending}
          onClose={() => setModalState(null)}
          onCreate={(input) => createMutation.mutate(input)}
          onUpdate={(input) => {
            if (modalState.mode !== "edit") return;
            updateMutation.mutate(
              { incidentId: modalState.incident.id, input },
              {
                onSuccess: () => {
                  toast.show("Incident updated");
                  setModalState(null);
                },
              },
            );
          }}
        />
      )}
    </div>
  );
}
