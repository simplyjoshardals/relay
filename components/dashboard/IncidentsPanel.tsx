"use client";

import Link from "next/link";
import { Avatar } from "./Avatar";
import { useNow } from "@/lib/use-now";
import {
  Skeleton,
  SkeletonCircle,
  SkeletonText,
} from "@/components/shared/Skeleton";
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
import { PATHS } from "@/utils/paths";

const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

// Milestone 9: "active incidents" is normally small, but nothing stops
// it from piling up during a bad day at a real org — this is a glance
// widget (the full history lives on the Incidents page), so show the
// top few by severity and link out to the rest, same reasoning as
// TicketBoard's COLUMN_LIMIT.
const PANEL_LIMIT = 5;

interface IncidentsPanelProps {
  incidents: Incident[];
  services: Service[];
  resolveUser: (id: string | null) => User | null;
  /** Milestone 9: the panel is a Server Component elsewhere in the app
   *  (it never fetches on its own), so the client-side query owner
   *  (DashboardView) passes this while its incidents/services queries
   *  are still `isLoading`. Skeleton rows render instead of the "No
   *  active incidents" empty state, which only applies once the real
   *  answer is known to be zero. */
  loading?: boolean;
  /** Either the incidents or services query failed — shown instead of
   *  the empty state, which would otherwise misread as "no active
   *  incidents" rather than "couldn't check." */
  error?: boolean;
  onRetry?: () => void;
}

/** The panel's loading placeholder, extracted so it can also be reused
 *  as this route's `loading.tsx` fallback (`DashboardSkeleton.tsx`) —
 *  the same shape whether it's showing because the client query is
 *  still `isLoading` or because the page itself is still streaming in
 *  from the server. */
export function IncidentsPanelSkeleton() {
  return (
    <div className="rounded-lg border border-line bg-panel">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="text-sm font-medium text-ink">Active incidents</h2>
      </div>

      <ul>
        {[0, 1, 2].map((i) => (
          <li
            key={i}
            className="flex items-center gap-4 border-b border-line px-4 py-3 last:border-b-0"
          >
            <Skeleton className="h-5 w-16 shrink-0" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <SkeletonText width="w-2/3" />
              <SkeletonText width="w-1/3" className="h-2.5" />
            </div>
            <SkeletonCircle />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function IncidentsPanel({
  incidents,
  services,
  resolveUser,
  loading,
  error,
  onRetry,
}: IncidentsPanelProps) {
  // Rendered inside DashboardView (a Client Component), so this
  // re-executes during hydration too — a bare `new Date()` here
  // is not safe (see ServiceHealthGrid.tsx). useNow() keeps the
  // server and first-client-paint text identical.
  const now = useNow();

  const sorted = [...incidents].sort(
    (a, b) => severityOrder[a.severity] - severityOrder[b.severity],
  );
  const shown = sorted.slice(0, PANEL_LIMIT);
  const remaining = sorted.length - shown.length;
  const serviceById = Object.fromEntries(services.map((s) => [s.id, s]));

  if (loading) {
    return <IncidentsPanelSkeleton />;
  }

  if (error) {
    return (
      <div className="rounded-lg border border-line bg-panel p-5">
        <div className="text-sm text-danger">
          Couldn&apos;t load incidents.{" "}
          <button
            type="button"
            onClick={onRetry}
            className="underline hover:text-ink"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

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
        {shown.map((incident) => {
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
                  <span>{relativeTime(incident.createdAt, now)}</span>
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
        {remaining > 0 && (
          <li className="px-4 py-2">
            <Link
              href={PATHS.INCIDENTS}
              className="text-xs text-ink-faint underline-offset-2 hover:text-ink hover:underline"
            >
              +{remaining} more
            </Link>
          </li>
        )}
      </ul>
    </div>
  );
}
