// Mirrors prisma/schema.prisma exactly. Kept as plain TS here (rather than
// importing @prisma/client) because this dashboard currently runs on mock
// data — see mock-data.ts. Once the real queries land (README §15 /
// implementation plan milestone 9), these should be replaced by the
// generated Prisma types and this file can shrink to just the *Meta maps.

export type Role = "MEMBER" | "MANAGER";

export type TicketStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "BLOCKED";
export type TicketPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export type ServiceStatus = "OPERATIONAL" | "DEGRADED" | "OUTAGE";

export type IncidentStatus =
  | "INVESTIGATING"
  | "IDENTIFIED"
  | "MONITORING"
  | "RESOLVED";
export type IncidentSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type ActivityAction =
  | "TICKET_CREATED"
  | "TICKET_ASSIGNED"
  | "TICKET_STATUS_CHANGED"
  | "TICKET_PRIORITY_CHANGED"
  | "SERVICE_STATUS_CHANGED"
  | "INCIDENT_CREATED"
  | "INCIDENT_STATUS_CHANGED"
  | "INCIDENT_SEVERITY_CHANGED"
  | "INCIDENT_SERVICE_LINKED"
  | "INCIDENT_SERVICE_UNLINKED"
  | "INCIDENT_TICKET_LINKED"
  | "INCIDENT_TICKET_UNLINKED"
  | "INCIDENT_RESOLVED"
  // Milestone 10 — team management (BACKEND_ROADMAP.md, decision 3).
  | "MEMBER_INVITED"
  | "MEMBER_JOINED"
  | "MEMBER_ROLE_CHANGED"
  | "MEMBER_DEACTIVATED";

export interface User {
  id: string;
  orgId: string;
  email: string;
  name: string;
  role: Role;
  initials: string;
  /** Milestone 10: "removing" a member deactivates them — the row stays
   *  so tickets, incidents and activity that point at them keep resolving
   *  to a real name. `listOrgUsers` returns inactive users too (history
   *  needs them); anything that offers people as a *choice* — assignee and
   *  responder pickers, the presence roster, the team list — filters on
   *  this. */
  active: boolean;
}

/** A Manager's outstanding invitation (Milestone 10). Never carries the
 *  token or its hash — the plaintext exists only in the link handed to
 *  the inviting Manager at creation time. */
export interface PendingInvitation {
  id: string;
  orgId: string;
  email: string;
  name: string;
  role: Role;
  invitedById: string;
  createdAt: string;
  expiresAt: string;
}

export interface Ticket {
  id: string;
  orgId: string;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  assigneeId: string | null;
  creatorId: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface Service {
  id: string;
  orgId: string;
  name: string;
  description: string;
  status: ServiceStatus;
  latencyMs: number;
  errorRate: number;
  version: number;
  updatedAt: string;
  /** README §19: services are never hard-deleted in the MVP, only
   *  archived — the record (and any incident history referencing it)
   *  stays intact. Archived services are hidden from the default view. */
  archived: boolean;
  /** Not a persisted column — buffered client-side from realtime updates
   *  received since the page loaded. Empty on a fresh load. See dashboard
   *  design note on service history. */
  sessionLatencyTrend: number[];
}

export interface Incident {
  id: string;
  orgId: string;
  title: string;
  description: string;
  status: IncidentStatus;
  severity: IncidentSeverity;
  responderId: string | null;
  createdAt: string;
  resolvedAt: string | null;
  version: number;
  serviceIds: string[];
  ticketIds: string[]; // active links only (IncidentTicket.isActive = true)
}

export interface Activity {
  id: string;
  orgId: string;
  actorId: string | null; // null => telemetry-generated
  action: ActivityAction;
  // "user" (Milestone 10): the member an event is about. For
  // MEMBER_INVITED specifically no user exists yet, so `targetId` is the
  // *invitation's* id — nothing should try to resolve it as a user.
  targetType: "ticket" | "service" | "incident" | "user";
  targetId: string;
  metadata: Record<string, string | number> | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Status metadata — the single source of truth for color + label per status.
// Every component (cards, chips, list rows, activity feed) reads from these
// maps rather than deciding colors locally, so a status always looks the
// same wherever it appears.
// ---------------------------------------------------------------------------

interface StatusMeta {
  label: string;
  color: "info" | "success" | "warning" | "danger" | "ink-faint";
}

export const ticketStatusMeta: Record<TicketStatus, StatusMeta> = {
  // Grey/blue/red/green now follow the same rule everywhere on the
  // dashboard: grey = not started, blue = normal active work, red = a
  // real problem, green = done. Orange is reserved dashboard-wide for
  // "needs attention" (see service DEGRADED, priority HIGH, incident
  // IDENTIFIED) — a ticket just being worked on isn't a warning, so it
  // no longer gets the warning color.
  OPEN: { label: "Open", color: "ink-faint" },
  IN_PROGRESS: { label: "In progress", color: "info" },
  BLOCKED: { label: "Blocked", color: "danger" },
  RESOLVED: { label: "Resolved", color: "success" },
};

export const ticketPriorityMeta: Record<TicketPriority, StatusMeta> = {
  LOW: { label: "Low", color: "ink-faint" },
  MEDIUM: { label: "Medium", color: "info" },
  HIGH: { label: "High", color: "warning" },
  URGENT: { label: "Urgent", color: "danger" },
};

export const serviceStatusMeta: Record<ServiceStatus, StatusMeta> = {
  OPERATIONAL: { label: "Operational", color: "success" },
  DEGRADED: { label: "Degraded", color: "warning" },
  OUTAGE: { label: "Outage", color: "danger" },
};

export const incidentStatusMeta: Record<IncidentStatus, StatusMeta> = {
  INVESTIGATING: { label: "Investigating", color: "danger" },
  IDENTIFIED: { label: "Identified", color: "warning" },
  MONITORING: { label: "Monitoring", color: "info" },
  RESOLVED: { label: "Resolved", color: "success" },
};

export const incidentSeverityMeta: Record<IncidentSeverity, StatusMeta> = {
  LOW: { label: "Low", color: "ink-faint" },
  MEDIUM: { label: "Medium", color: "info" },
  HIGH: { label: "High", color: "warning" },
  CRITICAL: { label: "Critical", color: "danger" },
};
