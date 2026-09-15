import { ArrowRight, Cpu } from "@phosphor-icons/react/ssr";
import { Avatar } from "./Avatar";
import {
  incidentSeverityMeta,
  incidentStatusMeta,
  serviceStatusMeta,
  ticketPriorityMeta,
  ticketStatusMeta,
  type Activity,
  type User,
} from "@/types";
import { relativeTime } from "@/lib/style";

// Activity metadata stores raw enum values (e.g. "IN_PROGRESS") as they're
// persisted in the DB. Never show those directly — always translate through
// the same label maps the rest of the dashboard uses, so the feed reads like
// something a person wrote ("In progress") rather than a code left showing.
type LabelMap = Record<string, { label: string }>;

function humanize(value: unknown, labels?: LabelMap): string {
  if (value == null) return "?";
  const key = String(value);
  return labels?.[key]?.label ?? key;
}

function Transition({
  from,
  to,
  labels,
}: {
  from: unknown;
  to: unknown;
  labels?: LabelMap;
}) {
  return (
    <span className="inline-flex items-center gap-1 align-middle">
      <span>{humanize(from, labels)}</span>
      <ArrowRight size={11} weight="bold" className="text-ink-faint" />
      <span>{humanize(to, labels)}</span>
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
          moved a ticket{" "}
          <Transition from={m.from} to={m.to} labels={ticketStatusMeta} />
        </>
      );
    case "TICKET_PRIORITY_CHANGED":
      return (
        <>
          changed ticket priority{" "}
          <Transition from={m.from} to={m.to} labels={ticketPriorityMeta} />
        </>
      );
    case "SERVICE_STATUS_CHANGED":
      return (
        <>
          status changed{" "}
          <Transition from={m.from} to={m.to} labels={serviceStatusMeta} />
        </>
      );
    case "INCIDENT_CREATED":
      return <>opened incident &ldquo;{m.title ?? ""}&rdquo;</>;
    case "INCIDENT_STATUS_CHANGED":
      return (
        <>
          moved incident{" "}
          <Transition from={m.from} to={m.to} labels={incidentStatusMeta} />
        </>
      );
    case "INCIDENT_SEVERITY_CHANGED":
      return (
        <>
          changed severity{" "}
          <Transition from={m.from} to={m.to} labels={incidentSeverityMeta} />
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
