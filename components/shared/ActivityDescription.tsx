import { ArrowRight } from "@phosphor-icons/react/ssr";
import {
  incidentSeverityMeta,
  incidentStatusMeta,
  serviceStatusMeta,
  ticketPriorityMeta,
  ticketStatusMeta,
  type Activity,
} from "@/types";

// Activity metadata stores raw enum values (e.g. "IN_PROGRESS") as they're
// persisted in the DB. Never show those directly — always translate through
// the same label maps the rest of the dashboard uses, so activity reads like
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

/** Rich, JSX description used in both the dashboard's compact feed and the
 *  full activity page, so the same event always reads identically wherever
 *  it shows up. */
export function describeActivity(activity: Activity) {
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

/** Plain-text render of the same event, for search matching and anywhere
 *  JSX isn't appropriate — kept as a thin wrapper so the two never drift
 *  in what counts as a match vs. what's displayed. */
export function describeActivityText(activity: Activity): string {
  const m = activity.metadata ?? {};
  switch (activity.action) {
    case "TICKET_CREATED":
      return `opened "${m.title ?? "a ticket"}"`;
    case "TICKET_ASSIGNED":
      return `assigned this ticket to ${m.assignee ?? "someone"}`;
    case "TICKET_STATUS_CHANGED":
      return `moved a ticket ${humanize(m.from, ticketStatusMeta)} to ${humanize(m.to, ticketStatusMeta)}`;
    case "TICKET_PRIORITY_CHANGED":
      return `changed ticket priority ${humanize(m.from, ticketPriorityMeta)} to ${humanize(m.to, ticketPriorityMeta)}`;
    case "SERVICE_STATUS_CHANGED":
      return `status changed ${humanize(m.from, serviceStatusMeta)} to ${humanize(m.to, serviceStatusMeta)}`;
    case "INCIDENT_CREATED":
      return `opened incident "${m.title ?? ""}"`;
    case "INCIDENT_STATUS_CHANGED":
      return `moved incident ${humanize(m.from, incidentStatusMeta)} to ${humanize(m.to, incidentStatusMeta)}`;
    case "INCIDENT_SEVERITY_CHANGED":
      return `changed severity ${humanize(m.from, incidentSeverityMeta)} to ${humanize(m.to, incidentSeverityMeta)}`;
    case "INCIDENT_SERVICE_LINKED":
      return "linked a service to this incident";
    case "INCIDENT_SERVICE_UNLINKED":
      return "unlinked a service from this incident";
    case "INCIDENT_TICKET_LINKED":
      return `linked "${m.ticketTitle ?? "a ticket"}"`;
    case "INCIDENT_TICKET_UNLINKED":
      return "unlinked a ticket";
    case "INCIDENT_RESOLVED":
      return `resolved "${m.title ?? "an incident"}"`;
    default:
      return "made a change";
  }
}
