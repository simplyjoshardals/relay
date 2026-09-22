import type { IncidentSeverity, IncidentStatus } from "@/types";

export const INCIDENT_STATUSES: IncidentStatus[] = [
  "INVESTIGATING",
  "IDENTIFIED",
  "MONITORING",
  "RESOLVED",
];

export const INCIDENT_SEVERITIES: IncidentSeverity[] = [
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL",
];

/**
 * README §6.1 draws the same kind of linear diagram ticket status gets
 * (§4.1) — INVESTIGATING → IDENTIFIED → MONITORING → RESOLVED — and it's
 * read the same permissive way here, for the same reason
 * server/domain/ticket.ts documents: real incident response doesn't
 * always move through every intermediate state (an issue can be
 * IDENTIFIED and RESOLVED in the same breath once the fix is known;
 * MONITORING might get skipped for something that self-corrects; a
 * RESOLVED incident can reopen straight back to INVESTIGATING if the
 * fix didn't hold). Nothing in §6 says otherwise, so there's no
 * transition-validation function here — any status may move to any
 * other status, and IncidentModal's status field is open on both create
 * and edit. If a real ordering rule emerges later, it belongs here, not
 * scattered into the application layer.
 */
