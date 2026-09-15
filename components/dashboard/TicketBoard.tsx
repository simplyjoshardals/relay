import { Avatar } from "./Avatar";
import {
  ticketPriorityMeta,
  ticketStatusMeta,
  type Ticket,
  type TicketStatus,
  type User,
} from "@/types";
import { statusDot } from "@/lib/style";

const columns: TicketStatus[] = ["OPEN", "IN_PROGRESS", "BLOCKED", "RESOLVED"];

interface TicketBoardProps {
  tickets: Ticket[];
  resolveUser: (id: string | null) => User | null;
}

export function TicketBoard({ tickets, resolveUser }: TicketBoardProps) {
  return (
    <div className="rounded-lg border border-line bg-panel">
      <div className="border-b border-line px-4 py-3">
        <h2 className="text-sm font-medium text-ink">Work</h2>
      </div>

      <div className="grid grid-cols-1 gap-px bg-line sm:grid-cols-2 lg:grid-cols-4">
        {columns.map((status) => {
          const items = tickets.filter((t) => t.status === status);
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
                <span className="text-xs text-ink-faint">{items.length}</span>
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
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
