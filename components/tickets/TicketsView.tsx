"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PlusIcon } from "@phosphor-icons/react";
import { Avatar } from "@/components/dashboard/Avatar";
import { FilterPill } from "@/components/shared/FilterPill";
import { SearchInput } from "@/components/shared/SearchInput";
import {
  TicketModal,
  type CreateTicketFields,
  type UpdateTicketFields,
} from "@/components/tickets/TicketModal";
import { useToast } from "@/components/shared/Toast";
import {
  createTicketAction,
  listOrgUsersAction,
  listTicketsAction,
  updateTicketAction,
} from "@/app/(dashboard)/tickets/actions";
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

// Stable references for the "not loaded yet" fallback — `?? []` inline
// would create a new array every render, which then defeats the
// useMemo()s below that depend on `users`/`ticketList` (a fresh []
// reference each time looks like a real change).
const EMPTY_TICKETS: Ticket[] = [];
const EMPTY_USERS: User[] = [];

interface TicketsViewProps {
  self: User;
}

type ModalState = { mode: "create" } | { mode: "edit"; ticket: Ticket } | null;

/**
 * Milestone 2: tickets are real now. This component owns its own data —
 * `useQuery`/`useMutation` against the Server Actions in
 * app/(dashboard)/tickets/actions.ts — rather than receiving `tickets`
 * as a prop and mirroring it into local state, which is how this looked
 * before the backend existed.
 *
 * Mutations here are "mutate, then invalidate and refetch" (via
 * onSuccess), not true client-side optimistic updates with rollback —
 * that refinement is explicitly Milestone 8's job (BACKEND_ROADMAP.md),
 * once there's a real reason to roll something back visibly rather than
 * just re-showing server state a moment later.
 */
export function TicketsView({ self }: TicketsViewProps) {
  const now = useNow();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TicketStatus | "ALL">("ALL");
  const [modalState, setModalState] = useState<ModalState>(null);

  const ticketsQuery = useQuery({
    queryKey: ["tickets", "list"],
    queryFn: listTicketsAction,
  });

  const usersQuery = useQuery({
    queryKey: ["org-users", "list"],
    queryFn: listOrgUsersAction,
  });

  const users = usersQuery.data ?? EMPTY_USERS;
  const userById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const resolveUser = (id: string | null): User | null =>
    id ? (userById.get(id) ?? null) : null;

  // §7's exact invalidation pattern: invalidate the list and the
  // single-ticket key together. There's no separate `useQuery(['tickets',
  // id])` cached anywhere yet, so the second call is a no-op today — it's
  // here so this already matches what Milestone 3's realtime handler
  // will do on a `ticket.updated` broadcast, rather than needing a
  // rewrite then.
  const invalidateTickets = (id?: string) => {
    queryClient.invalidateQueries({ queryKey: ["tickets", "list"] });
    if (id) queryClient.invalidateQueries({ queryKey: ["tickets", id] });
  };

  const createMutation = useMutation({
    mutationFn: (input: CreateTicketFields) => createTicketAction(input),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.show(result.error.message, "error");
        return;
      }
      invalidateTickets();
      toast.show("Ticket created");
      setModalState(null);
    },
    onError: () =>
      toast.show("Couldn't create the ticket. Try again.", "error"),
  });

  const updateMutation = useMutation({
    mutationFn: ({
      ticketId,
      input,
    }: {
      ticketId: string;
      input: UpdateTicketFields;
    }) => updateTicketAction(ticketId, input),
    onSuccess: (result, variables) => {
      if (!result.ok) {
        // A conflict means someone else's write landed first — there's
        // nothing client-side to roll back (no optimistic update was
        // applied), but the stale data on screen needs replacing with
        // whatever's actually current now, which invalidating triggers.
        toast.show(result.error.message, "error");
        invalidateTickets(variables.ticketId);
        return;
      }
      invalidateTickets(variables.ticketId);
      toast.show("Ticket updated");
      setModalState(null);
    },
    onError: () =>
      toast.show("Couldn't update the ticket. Try again.", "error"),
  });

  const assignToMe = (ticket: Ticket) => {
    updateMutation.mutate(
      {
        ticketId: ticket.id,
        input: {
          title: ticket.title,
          description: ticket.description,
          status: ticket.status,
          priority: ticket.priority,
          assigneeId: self.id,
          expectedVersion: ticket.version,
        },
      },
      {
        onSuccess: (result) => {
          if (result.ok) toast.show("Assigned to you");
        },
      },
    );
  };

  const ticketList = ticketsQuery.data ?? EMPTY_TICKETS;

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

        {ticketsQuery.isLoading ? (
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-8 text-center text-sm text-ink-dim">
            Loading tickets…
          </div>
        ) : ticketsQuery.isError ? (
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-8 text-center text-sm text-danger">
            Couldn&apos;t load tickets.{" "}
            <button
              type="button"
              onClick={() => ticketsQuery.refetch()}
              className="underline hover:text-ink"
            >
              Try again
            </button>
          </div>
        ) : filtered.length === 0 ? (
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
          saving={createMutation.isPending || updateMutation.isPending}
          onClose={() => setModalState(null)}
          onCreate={(input) => createMutation.mutate(input)}
          onUpdate={(input) => {
            if (modalState.mode !== "edit") return;
            updateMutation.mutate({ ticketId: modalState.ticket.id, input });
          }}
        />
      )}
    </div>
  );
}
