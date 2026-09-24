import Link from "next/link";
import { Avatar } from "./Avatar";
import {
  Skeleton,
  SkeletonCircle,
  SkeletonText,
} from "@/components/shared/Skeleton";
import {
  ticketPriorityMeta,
  ticketStatusMeta,
  type Ticket,
  type TicketStatus,
  type User,
} from "@/types";
import { statusDot } from "@/lib/style";
import { PATHS } from "@/utils/paths";

const columns: TicketStatus[] = ["OPEN", "IN_PROGRESS", "BLOCKED", "RESOLVED"];

// Milestone 9: `tickets` is now the org's *entire* ticket history, not
// a fixed handful of mock rows — a RESOLVED column in particular only
// ever grows. This is a glance widget, not the Tickets page (which has
// its own search/filter/pagination), so each column shows only its
// most-recently-updated items; anything past that links out to the
// full page instead of rendering unbounded.
const COLUMN_LIMIT = 5;

interface TicketBoardProps {
  tickets: Ticket[];
  resolveUser: (id: string | null) => User | null;
  /** Milestone 9: set by DashboardView while its tickets query is still
   *  `isLoading` — see IncidentsPanel's `loading` prop for the same
   *  reasoning. */
  loading?: boolean;
}

export function TicketBoard({
  tickets,
  resolveUser,
  loading,
}: TicketBoardProps) {
  if (loading) {
    return (
      <div className="rounded-lg border border-line bg-panel">
        <div className="border-b border-line px-4 py-3">
          <h2 className="text-sm font-medium text-ink">Work</h2>
        </div>

        <div className="grid grid-cols-1 gap-px bg-line sm:grid-cols-2 lg:grid-cols-4">
          {columns.map((status) => (
            <div key={status} className="bg-panel">
              <div className="flex items-center gap-1.5 px-3 py-2.5">
                <SkeletonText width="w-16" className="h-2.5" />
              </div>

              <ul>
                {[0, 1].map((i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 border-t border-line px-3 py-2"
                  >
                    <Skeleton className="mt-1 size-1.5 shrink-0 rounded-full" />
                    <SkeletonText className="mt-0.5 flex-1" />
                    <SkeletonCircle />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-line bg-panel">
      <div className="border-b border-line px-4 py-3">
        <h2 className="text-sm font-medium text-ink">Work</h2>
      </div>

      <div className="grid grid-cols-1 gap-px bg-line sm:grid-cols-2 lg:grid-cols-4">
        {columns.map((status) => {
          const columnTickets = tickets
            .filter((t) => t.status === status)
            .sort(
              (a, b) =>
                new Date(b.updatedAt).getTime() -
                new Date(a.updatedAt).getTime(),
            );
          const items = columnTickets.slice(0, COLUMN_LIMIT);
          const remaining = columnTickets.length - items.length;
          const meta = ticketStatusMeta[status];

          return (
            <div key={status} className="bg-panel">
              <div className="flex items-center gap-1.5 px-3 py-2.5">
                <span
                  className={`size-1.5 rounded-full ${statusDot[meta.color]}`}
                />
                <span className="text-xs font-medium text-ink-dim">
                  {meta.label}
                </span>
                <span className="text-xs text-ink-faint">
                  {columnTickets.length}
                </span>
              </div>

              <ul>
                {items.map((ticket) => {
                  const priority = ticketPriorityMeta[ticket.priority];
                  const assignee = resolveUser(ticket.assigneeId);
                  return (
                    <li
                      key={ticket.id}
                      className="flex items-start gap-2 px-3 py-2 border-t border-line"
                    >
                      <span
                        className={`mt-1 size-1.5 shrink-0 rounded-full ${statusDot[priority.color]}`}
                        title={`${priority.label} priority`}
                      />
                      <span className="min-w-0 flex-1 text-xs leading-snug text-ink-dim">
                        {ticket.title}
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
                {items.length === 0 && (
                  <li className="px-3 py-2 text-xs text-ink-faint border-t border-line">
                    Nothing here
                  </li>
                )}
                {remaining > 0 && (
                  <li className="border-t border-line px-3 py-2">
                    <Link
                      href={PATHS.TICKETS}
                      className="text-xs text-ink-faint underline-offset-2 hover:text-ink hover:underline"
                    >
                      +{remaining} more
                    </Link>
                  </li>
                )}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
