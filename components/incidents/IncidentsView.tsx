"use client";

import { useMemo, useState } from "react";
import { PlusIcon } from "@phosphor-icons/react";
import { Avatar } from "@/components/dashboard/Avatar";
import { FilterPill } from "@/components/shared/FilterPill";
import { SearchInput } from "@/components/shared/SearchInput";
import { IncidentModal } from "@/components/incidents/IncidentModal";
import { useToast } from "@/components/shared/Toast";
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

interface IncidentsViewProps {
  incidents: Incident[];
  services: Service[];
  tickets: Ticket[];
  users: User[];
  self: User;
}

type ModalState =
  | { mode: "create" }
  | { mode: "edit"; incident: Incident }
  | null;

export function IncidentsView({
  incidents,
  services,
  tickets,
  users,
  self,
}: IncidentsViewProps) {
  const now = useNow();
  const toast = useToast();

  // Built locally from `users` rather than taken as a `resolveUser`
  // function prop — see the same comment in TicketsView for why (this
  // page is a Server Component, and functions can't cross that boundary
  // to a Client Component).
  const userById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const resolveUser = (id: string | null): User | null =>
    id ? (userById.get(id) ?? null) : null;

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<IncidentStatus | "ALL">(
    "ALL",
  );
  const [modalState, setModalState] = useState<ModalState>(null);

  // Local-only, optimistic state — same reasoning as TicketsView: no
  // backend yet (README §15 / ROADMAP_ROLES.md Phase 2), so mutations
  // live here and reset on reload.
  const [incidentList, setIncidentList] = useState(incidents);

  const serviceById = useMemo(
    () => Object.fromEntries(services.map((s) => [s.id, s])),
    [services],
  );

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

  const applyIncident = (saved: Incident) => {
    setIncidentList((prev) => {
      const exists = prev.some((i) => i.id === saved.id);
      return exists
        ? prev.map((i) => (i.id === saved.id ? saved : i))
        : [saved, ...prev];
    });
  };

  const upsertIncident = (saved: Incident) => {
    const isNew = !incidentList.some((i) => i.id === saved.id);
    applyIncident(saved);
    toast.show(isNew ? "Incident created" : "Incident updated");
  };

  const respond = (incident: Incident) => {
    applyIncident({
      ...incident,
      responderId: self.id,
      version: incident.version + 1,
    });
    toast.show("You're responding");
  };

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

        {filtered.length === 0 ? (
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
                .map((id) => serviceById[id])
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
                    className={`size-1.5 shrink-0 rounded-full sm:hidden ${statusChipBg[sevMeta.color]} ${statusText[sevMeta.color]}`}
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
          incident={modalState.mode === "edit" ? modalState.incident : null}
          services={services}
          tickets={tickets}
          users={users}
          self={self}
          onClose={() => setModalState(null)}
          onSave={upsertIncident}
        />
      )}
    </div>
  );
}
