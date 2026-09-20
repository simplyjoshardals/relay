"use client";

import { useMemo, useState } from "react";
import { PlusIcon } from "@phosphor-icons/react";
import { Avatar } from "@/components/dashboard/Avatar";
import { FilterPill } from "@/components/shared/FilterPill";
import { SearchInput } from "@/components/shared/SearchInput";
import { TicketModal } from "@/components/tickets/TicketModal";
import { useToast } from "@/components/shared/Toast";
import {
  ticketPriorityMeta,
  ticketStatusMeta,
  type Ticket,
  type TicketStatus,
  type User,
} from "@/types";
import { relativeTime, statusChipBg, statusDot, statusText } from "@/lib/style";
import { useNow } from "@/lib/use-now";

const statusColumns: TicketStatus[] = [
  "OPEN",
  "IN_PROGRESS",
  "BLOCKED",
  "RESOLVED",
];

interface TicketsViewProps {
  tickets: Ticket[];
  users: User[];
  self: User;
}

type ModalState = { mode: "create" } | { mode: "edit"; ticket: Ticket } | null;

export function TicketsView({ tickets, users, self }: TicketsViewProps) {
  const now = useNow();
  const toast = useToast();

  // Built locally from `users` rather than taken as a `resolveUser`
  // function prop: this component's parent page is a Server Component
  // (it needs to read the session), and a plain function can't
  // be passed across the server/client boundary — only serializable data
  // like `users` can. Same reasoning applies to IncidentsView.
  const userById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const resolveUser = (id: string | null): User | null =>
    id ? (userById.get(id) ?? null) : null;

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TicketStatus | "ALL">("ALL");
  const [modalState, setModalState] = useState<ModalState>(null);

  // Local-only, optimistic state — there's no backend yet (README §15 /
  // ROADMAP_ROLES.md Phase 2), so mutations live here and reset on
  // reload. The `tickets` prop still seeds the initial list from
  // mock-data so a hard navigation looks the same as before.
  const [ticketList, setTicketList] = useState(tickets);

  const searched = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return ticketList;

    return ticketList.filter((t) => t.title.toLowerCase().includes(query));
  }, [ticketList, search]);

  const filtered = useMemo(() => {
    const byStatus =
      statusFilter === "ALL"
        ? searched
        : searched.filter((t) => t.status === statusFilter);

    return [...byStatus].sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  }, [searched, statusFilter]);

  const applyTicket = (saved: Ticket) => {
    setTicketList((prev) => {
      const exists = prev.some((t) => t.id === saved.id);
      return exists
        ? prev.map((t) => (t.id === saved.id ? saved : t))
        : [saved, ...prev];
    });
  };

  const upsertTicket = (saved: Ticket) => {
    const isNew = !ticketList.some((t) => t.id === saved.id);
    applyTicket(saved);
    toast.show(isNew ? "Ticket created" : "Ticket updated");
  };

  const assignToMe = (ticket: Ticket) => {
    applyTicket({
      ...ticket,
      assigneeId: self.id,
      version: ticket.version + 1,
      updatedAt: new Date().toISOString(),
    });
    toast.show("Assigned to you");
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex shrink-0 items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-medium text-ink">Tickets</h1>
          <p className="text-sm text-ink-dim">
            {ticketList.length} {ticketList.length === 1 ? "ticket" : "tickets"}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setModalState({ mode: "create" })}
          className="flex shrink-0 items-center gap-1.5 rounded-md bg-ink px-3 py-1.5 text-sm font-medium text-bg transition-opacity hover:opacity-90"
        >
          <PlusIcon size={14} weight="bold" />
          New ticket
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

              {statusColumns.map((status) => (
                <FilterPill
                  key={status}
                  active={statusFilter === status}
                  onClick={() => setStatusFilter(status)}
                  label={ticketStatusMeta[status].label}
                  count={searched.filter((t) => t.status === status).length}
                />
              ))}
            </div>

            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search tickets"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-8 text-center text-sm text-ink-dim">
            No tickets match your filters.
          </div>
        ) : (
          <ul className="min-h-0 flex-1 overflow-y-auto">
            {filtered.map((ticket) => {
              const statusMeta = ticketStatusMeta[ticket.status];
              const priorityMeta = ticketPriorityMeta[ticket.priority];
              const assignee = resolveUser(ticket.assigneeId);

              return (
                <li
                  key={ticket.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setModalState({ mode: "edit", ticket })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setModalState({ mode: "edit", ticket });
                    }
                  }}
                  className="flex cursor-pointer items-center gap-3 border-b border-line px-4 py-3 last:border-b-0 transition-colors hover:bg-panel-raised"
                >
                  <span
                    className={`size-1.5 shrink-0 rounded-full ${statusDot[priorityMeta.color]}`}
                    title={`${priorityMeta.label} priority`}
                  />

                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-ink">
                      {ticket.title}
                    </div>

                    <div className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-faint sm:hidden">
                      <span className={statusText[statusMeta.color]}>
                        {statusMeta.label}
                      </span>
                      <span>·</span>
                      <span>{relativeTime(ticket.updatedAt, now)}</span>
                    </div>
                  </div>

                  <span
                    className={`hidden shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium sm:inline-block ${statusChipBg[statusMeta.color]} ${statusText[statusMeta.color]}`}
                  >
                    {statusMeta.label}
                  </span>

                  <span className="hidden w-16 shrink-0 text-xs text-ink-faint md:inline-block">
                    {relativeTime(ticket.updatedAt, now)}
                  </span>

                  {assignee ? (
                    <Avatar
                      initials={assignee.initials}
                      seed={assignee.id}
                      title={assignee.name}
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        assignToMe(ticket);
                      }}
                      className="shrink-0 rounded-full border border-dashed border-line-strong px-2 py-0.5 text-[11px] text-ink-faint transition-colors hover:border-signal hover:text-ink"
                    >
                      Assign to me
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {modalState && (
        <TicketModal
          ticket={modalState.mode === "edit" ? modalState.ticket : null}
          users={users}
          self={self}
          onClose={() => setModalState(null)}
          onSave={upsertTicket}
        />
      )}
    </div>
  );
}
