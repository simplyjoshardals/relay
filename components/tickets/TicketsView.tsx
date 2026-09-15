"use client";

import { useMemo, useState } from "react";
import { MagnifyingGlassIcon } from "@phosphor-icons/react";
import { Avatar } from "@/components/dashboard/Avatar";
import {
  ticketPriorityMeta,
  ticketStatusMeta,
  type Ticket,
  type TicketStatus,
  type User,
} from "@/types";
import { relativeTime, statusChipBg, statusDot, statusText } from "@/lib/style";

const statusColumns: TicketStatus[] = [
  "OPEN",
  "IN_PROGRESS",
  "BLOCKED",
  "RESOLVED",
];

interface TicketsViewProps {
  tickets: Ticket[];
  resolveUser: (id: string | null) => User | null;
}

export function TicketsView({ tickets, resolveUser }: TicketsViewProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TicketStatus | "ALL">("ALL");

  // Search narrows the pool the status pills count against, so the counts
  // stay meaningful while typing; the status pill then narrows further.
  const searched = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return tickets;
    return tickets.filter((t) => t.title.toLowerCase().includes(query));
  }, [tickets, search]);

  const filtered = useMemo(() => {
    const byStatus =
      statusFilter === "ALL"
        ? searched
        : searched.filter((t) => t.status === statusFilter);
    // Most recently touched first — matches the "what's happening now"
    // framing used everywhere else on the dashboard (README §15).
    return [...byStatus].sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  }, [searched, statusFilter]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-medium text-ink">Tickets</h1>
        <p className="text-sm text-ink-dim">
          {tickets.length} {tickets.length === 1 ? "ticket" : "tickets"}
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

          <div className="relative w-full sm:w-64">
            <MagnifyingGlassIcon
              size={14}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tickets"
              className="w-full rounded-md border border-line bg-panel-raised py-1.5 pl-8 pr-3 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-1 focus:ring-signal"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-ink-dim">
            No tickets match your filters.
          </div>
        ) : (
          <ul>
            {filtered.map((ticket) => {
              const statusMeta = ticketStatusMeta[ticket.status];
              const priorityMeta = ticketPriorityMeta[ticket.priority];
              const assignee = resolveUser(ticket.assigneeId);

              return (
                <li
                  key={ticket.id}
                  className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0 transition-colors hover:bg-panel-raised"
                >
                  <span
                    className={`size-1.5 shrink-0 rounded-full ${statusDot[priorityMeta.color]}`}
                    title={`${priorityMeta.label} priority`}
                  />

                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-ink">
                      {ticket.title}
                    </div>
                    {/* Status + time collapse into the row on phone, where
                        the dedicated columns to the right are hidden. */}
                    <div className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-faint sm:hidden">
                      <span className={statusText[statusMeta.color]}>
                        {statusMeta.label}
                      </span>
                      <span>·</span>
                      <span>{relativeTime(ticket.updatedAt)}</span>
                    </div>
                  </div>

                  <span
                    className={`hidden shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium sm:inline-block ${statusChipBg[statusMeta.color]} ${statusText[statusMeta.color]}`}
                  >
                    {statusMeta.label}
                  </span>

                  <span className="hidden w-16 shrink-0 text-xs text-ink-faint md:inline-block">
                    {relativeTime(ticket.updatedAt)}
                  </span>

                  {assignee ? (
                    <Avatar
                      initials={assignee.initials}
                      seed={assignee.id}
                      title={assignee.name}
                    />
                  ) : (
                    <span className="size-6 shrink-0 rounded-full border border-dashed border-line-strong" />
                  )}
                </li>
              );
            })}
          </ul>
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
