import { ArrowRight, Cpu } from "@phosphor-icons/react/ssr";
import { Avatar } from "./Avatar";
import type { Activity, User } from "@/types";
import { relativeTime } from "@/lib/style";

function Transition({ from, to }: { from: unknown; to: unknown }) {
  return (
    <span className="inline-flex items-center gap-1 align-middle">
      <span>{String(from ?? "?")}</span>
      <ArrowRight size={11} weight="bold" className="text-ink-faint" />
      <span>{String(to ?? "?")}</span>
    </span>
  );
}

function describe(activity: Activity) {
  const m = activity.metadata ?? {};
  switch (activity.action) {
    case "TICKET_CREATED":
      return <>opened &ldquo;{m.title ?? "a ticket"}&rdquo;</>;
    case "TICKET_ASSIGNED":
      return <>assigned this ticket to {m.assignee ?? "someone"}</>;
    case "TICKET_STATUS_CHANGED":
      return (
        <>
          moved a ticket <Transition from={m.from} to={m.to} />
        </>
      );
    case "TICKET_PRIORITY_CHANGED":
      return (
        <>
          changed ticket priority <Transition from={m.from} to={m.to} />
        </>
      );
    case "SERVICE_STATUS_CHANGED":
      return (
        <>
          status changed <Transition from={m.from} to={m.to} />
        </>
      );
    case "INCIDENT_CREATED":
      return <>opened incident &ldquo;{m.title ?? ""}&rdquo;</>;
    case "INCIDENT_STATUS_CHANGED":
      return (
        <>
          moved incident <Transition from={m.from} to={m.to} />
        </>
      );
    case "INCIDENT_SEVERITY_CHANGED":
      return (
        <>
          changed severity <Transition from={m.from} to={m.to} />
        </>
      );
    case "INCIDENT_SERVICE_LINKED":
      return <>linked a service to this incident</>;
    case "INCIDENT_SERVICE_UNLINKED":
      return <>unlinked a service from this incident</>;
    case "INCIDENT_TICKET_LINKED":
      return <>linked &ldquo;{m.ticketTitle ?? "a ticket"}&rdquo;</>;
    case "INCIDENT_TICKET_UNLINKED":
      return <>unlinked a ticket</>;
    case "INCIDENT_RESOLVED":
      return <>resolved &ldquo;{m.title ?? "an incident"}&rdquo;</>;
    default:
      return <>made a change</>;
  }
}

interface ActivityFeedProps {
  activities: Activity[];
  resolveUser: (id: string | null) => User | null;
}

export function ActivityFeed({ activities, resolveUser }: ActivityFeedProps) {
  const sorted = [...activities].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return (
    <div className="rounded-lg border border-line bg-panel p-4">
      <h2 className="text-sm font-medium text-ink">Activity</h2>

      <ul className="mt-3 flex flex-col gap-3">
        {sorted.map((activity) => {
          const actor = resolveUser(activity.actorId);
          return (
            <li key={activity.id} className="flex items-start gap-2.5">
              {actor ? (
                <Avatar initials={actor.initials} title={actor.name} />
              ) : (
                <span
                  className="flex size-6 shrink-0 items-center justify-center rounded-full bg-panel-raised text-ink-faint"
                  title="Telemetry"
                >
                  <Cpu size={12} weight="bold" />
                </span>
              )}
              <div className="min-w-0 text-xs leading-snug">
                <span className="text-ink-dim">
                  <span
                    className={actor ? "text-ink" : "text-ink-faint font-mono"}
                  >
                    {actor ? actor.name : "telemetry"}
                  </span>{" "}
                  {describe(activity)}
                </span>
                <div className="mt-0.5 text-[11px] text-ink-faint">
                  {relativeTime(activity.createdAt)}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
