import { Avatar } from "./Avatar";
import {
  incidentSeverityMeta,
  incidentStatusMeta,
  type Incident,
  type Service,
  type User,
} from "@/types";
import {
  relativeTime,
  statusBorderLeft,
  statusChipBg,
  statusText,
} from "@/lib/style";

const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

interface IncidentsPanelProps {
  incidents: Incident[];
  services: Service[];
  resolveUser: (id: string | null) => User | null;
}

export function IncidentsPanel({
  incidents,
  services,
  resolveUser,
}: IncidentsPanelProps) {
  const sorted = [...incidents].sort(
    (a, b) => severityOrder[a.severity] - severityOrder[b.severity],
  );
  const serviceById = Object.fromEntries(services.map((s) => [s.id, s]));

  if (sorted.length === 0) {
    return (
      <div className="rounded-lg border border-line bg-panel p-5">
        <div className="text-sm text-ink-dim">
          No active incidents. Everything reporting normal.
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-line bg-panel">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="text-sm font-medium text-ink">Active incidents</h2>
        <span className="text-xs text-ink-faint">Sorted by severity</span>
      </div>

      <ul>
        {sorted.map((incident) => {
          const sevMeta = incidentSeverityMeta[incident.severity];
          const statusMeta = incidentStatusMeta[incident.status];
          const responder = resolveUser(incident.responderId);
          const affectedServices = incident.serviceIds
            .map((id) => serviceById[id])
            .filter((s): s is Service => Boolean(s));

          return (
            <li
              key={incident.id}
              className={`flex items-center gap-4 border-l-2 px-4 py-3 border-b border-line last:border-b-0 ${statusBorderLeft[sevMeta.color]}`}
            >
              <span
                className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium ${statusChipBg[sevMeta.color]} ${statusText[sevMeta.color]}`}
              >
                {sevMeta.label}
              </span>

              <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-ink">
                  {incident.title}
                </div>
                <div className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-faint">
                  <span className={statusText[statusMeta.color]}>
                    {statusMeta.label}
                  </span>
                  <span>·</span>
                  {/* Server Component (no "use client") — this never
                      hydrates/re-executes on the client, so a plain
                      `new Date()` here is safe and doesn't need useNow(). */}
                  <span>{relativeTime(incident.createdAt, new Date())}</span>
                  {affectedServices.length > 0 && (
                    <>
                      <span>·</span>
                      <span className="truncate">
                        {affectedServices.map((s) => s.name).join(", ")}
                      </span>
                    </>
                  )}
                  {incident.ticketIds.length > 0 && (
                    <>
                      <span>·</span>
                      <span>
                        {incident.ticketIds.length}{" "}
                        {incident.ticketIds.length === 1 ? "ticket" : "tickets"}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {responder ? (
                <Avatar
                  initials={responder.initials}
                  seed={responder.id}
                  title={`${responder.name} responding`}
                />
              ) : (
                <span className="shrink-0 text-xs text-ink-faint">
                  Unassigned
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
