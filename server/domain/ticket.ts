import type { TicketPriority, TicketStatus } from "@/types";

export const TICKET_STATUSES: TicketStatus[] = [
  "OPEN",
  "IN_PROGRESS",
  "BLOCKED",
  "RESOLVED",
];

export const TICKET_PRIORITIES: TicketPriority[] = [
  "LOW",
  "MEDIUM",
  "HIGH",
  "URGENT",
];

/**
 * README §4.1 describes a loose lifecycle — "OPEN → IN_PROGRESS →
 * RESOLVED, the MVP may also support BLOCKED where appropriate" — not a
 * strict adjacency matrix with rejected transitions. That wording ("may
 * also support," "where appropriate") is deliberately permissive, not
 * an oversight: real ops work reopens resolved tickets and resolves
 * things immediately without ever touching IN_PROGRESS. So there is no
 * transition-validation function here — any status may move to any
 * other status. If a real business rule requiring otherwise emerges
 * later, it belongs here, not scattered into the application layer.
 */
