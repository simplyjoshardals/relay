"use client";

import { useState } from "react";
import { Modal } from "@/components/shared/Modal";
import { SelectField } from "@/components/shared/SelectField";
import { TextField } from "@/components/shared/TextField";
import {
  createIncidentInputSchema,
  updateIncidentInputSchema,
} from "@/server/validation/incidents";
import {
  incidentSeverityMeta,
  incidentStatusMeta,
  type Incident,
  type IncidentSeverity,
  type IncidentStatus,
  type Service,
  type Ticket,
  type User,
} from "@/types";

const statusOptions = Object.entries(incidentStatusMeta).map(
  ([value, meta]) => ({ value, label: meta.label }),
);
const severityOptions = Object.entries(incidentSeverityMeta).map(
  ([value, meta]) => ({ value, label: meta.label }),
);

export interface CreateIncidentFields {
  title: string;
  description: string;
  status: IncidentStatus;
  severity: IncidentSeverity;
  responderId: string | null;
  serviceIds: string[];
  ticketIds: string[];
}

export interface UpdateIncidentFields {
  title: string;
  description: string;
  status: IncidentStatus;
  severity: IncidentSeverity;
  responderId: string | null;
  serviceIds: string[];
  ticketIds: string[];
  expectedVersion: number;
}

interface IncidentModalProps {
  /** null = create mode. Otherwise the incident being edited — the
   *  *live* row from the query cache (same reasoning as TicketModal's
   *  `ticket` prop), so a change made by someone else while this form is
   *  open shows up here as a new `version`. */
  incident: Incident | null;
  services: Service[];
  tickets: Ticket[];
  users: User[];
  /** True while the create/update mutation is in flight — a real
   *  network round trip now (Milestone 5), not an instant local update. */
  saving?: boolean;
  onClose: () => void;
  onCreate: (input: CreateIncidentFields) => void;
  onUpdate: (input: UpdateIncidentFields) => void;
}

/**
 * Create-or-edit form for a single incident — same one-component-both-
 * modes reasoning as TicketModal. Also owns the "linking" actions from
 * the Activity model (INCIDENT_SERVICE_LINKED/UNLINKED,
 * INCIDENT_TICKET_LINKED/UNLINKED — actually *written* starting
 * Milestone 6, see BACKEND_ROADMAP.md) as a checklist rather than a
 * separate flow, since for MVP a link/unlink is just membership in this
 * list. The checklists always submit the *full* desired membership; the
 * server (server/repositories/incidents.ts#syncIncidentServices/
 * syncIncidentTickets) diffs against current linkage itself.
 *
 * This hands the caller (IncidentsView) plain input fields, not a
 * fully-formed Incident — the server assigns the real id, version, and
 * timestamps (Milestone 5), via createIncidentAction/updateIncidentAction,
 * same reasoning TicketModal's doc comment gives for tickets.
 *
 * Validated with the same Zod schemas the server uses
 * (server/validation/incidents.ts) via `.safeParse()` on submit, per the
 * resolved decision in BACKEND_ROADMAP.md not to adopt React Hook Form.
 */
export function IncidentModal({
  incident,
  services,
  tickets,
  users,
  saving,
  onClose,
  onCreate,
  onUpdate,
}: IncidentModalProps) {
  const isCreate = incident === null;

  const [title, setTitle] = useState(incident?.title ?? "");
  const [description, setDescription] = useState(incident?.description ?? "");
  const [status, setStatus] = useState<IncidentStatus>(
    incident?.status ?? "INVESTIGATING",
  );
  const [severity, setSeverity] = useState<IncidentSeverity>(
    incident?.severity ?? "MEDIUM",
  );
  const [responderId, setResponderId] = useState(incident?.responderId ?? "");
  const [serviceIds, setServiceIds] = useState<string[]>(
    incident?.serviceIds ?? [],
  );
  const [ticketIds, setTicketIds] = useState<string[]>(
    incident?.ticketIds ?? [],
  );
  const [formError, setFormError] = useState<string | null>(null);

  // The version this form's fields were loaded from — saves go out
  // against *this*, never the live `incident.version`, so a remote
  // change can't silently rebase our stale edits onto the new version
  // (§8). Same pattern as TicketModal/ServiceModal's baseVersion.
  const [baseVersion, setBaseVersion] = useState(incident?.version ?? 0);
  const isStale = incident !== null && incident.version !== baseVersion;

  const loadLatest = () => {
    if (!incident) return;
    setTitle(incident.title);
    setDescription(incident.description);
    setStatus(incident.status);
    setSeverity(incident.severity);
    setResponderId(incident.responderId ?? "");
    setServiceIds(incident.serviceIds);
    setTicketIds(incident.ticketIds);
    setBaseVersion(incident.version);
    setFormError(null);
  };

  const toggleId = (list: string[], id: string) =>
    list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

  const handleSave = () => {
    if (isCreate) {
      const parsed = createIncidentInputSchema.safeParse({
        title,
        description,
        status,
        severity,
        responderId: responderId || null,
        serviceIds,
        ticketIds,
      });
      if (!parsed.success) {
        setFormError(parsed.error.issues[0]?.message ?? "Invalid input.");
        return;
      }
      setFormError(null);
      onCreate({
        ...parsed.data,
        responderId: parsed.data.responderId ?? null,
      });
    } else {
      const parsed = updateIncidentInputSchema.safeParse({
        title,
        description,
        status,
        severity,
        responderId: responderId || null,
        serviceIds,
        ticketIds,
        expectedVersion: baseVersion,
      });
      if (!parsed.success) {
        setFormError(parsed.error.issues[0]?.message ?? "Invalid input.");
        return;
      }
      setFormError(null);
      onUpdate({
        title: parsed.data.title ?? title,
        description: parsed.data.description ?? description,
        status: parsed.data.status ?? status,
        severity: parsed.data.severity ?? severity,
        responderId: parsed.data.responderId ?? null,
        serviceIds: parsed.data.serviceIds ?? serviceIds,
        ticketIds: parsed.data.ticketIds ?? ticketIds,
        expectedVersion: parsed.data.expectedVersion,
      });
    }
  };

  const canSave = title.trim().length > 0;

  const footer = (
    <div className="flex flex-col gap-2">
      {isStale && (
        <div className="flex items-center justify-between gap-3 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-ink">
          <span>
            Someone else updated this incident while you were editing. Load
            their version to keep going — your unsaved edits here will be
            replaced.
          </span>
          <button
            type="button"
            onClick={loadLatest}
            className="shrink-0 rounded-md border border-line-strong px-2 py-1 font-medium text-ink transition-colors hover:bg-panel-raised"
          >
            Load latest
          </button>
        </div>
      )}
      {formError && <p className="text-xs text-danger">{formError}</p>}
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          className="rounded-md border border-line px-3 py-1.5 text-sm text-ink-dim transition-colors hover:text-ink disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !canSave || isStale}
          className="rounded-md bg-ink px-3 py-1.5 text-sm font-medium text-bg transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Saving…" : isCreate ? "Create incident" : "Save changes"}
        </button>
      </div>
    </div>
  );

  return (
    <Modal
      title={isCreate ? "New incident" : "Edit incident"}
      onClose={onClose}
      footer={footer}
    >
      <div className="flex flex-col gap-3">
        <TextField
          label="Title"
          autoFocus
          value={title}
          onChange={setTitle}
          placeholder="Short, specific summary"
        />

        <TextField
          label="Description"
          multiline
          value={description}
          onChange={setDescription}
          placeholder="Optional detail"
        />

        <div className="grid grid-cols-2 gap-3">
          <SelectField
            label="Status"
            value={status}
            onChange={(value) => setStatus(value as IncidentStatus)}
            options={statusOptions}
          />
          <SelectField
            label="Severity"
            value={severity}
            onChange={(value) => setSeverity(value as IncidentSeverity)}
            options={severityOptions}
          />
        </div>

        <SelectField
          label="Responder"
          value={responderId ?? ""}
          onChange={setResponderId}
          options={[
            { value: "", label: "Unassigned" },
            ...users.map((u) => ({ value: u.id, label: u.name })),
          ]}
        />

        <div className="flex flex-col gap-1">
          <span className="text-xs text-ink-dim">Affected services</span>
          <div className="flex max-h-32 flex-col gap-1 overflow-y-auto rounded-md border border-line bg-panel-raised p-2">
            {services.map((service) => (
              <label
                key={service.id}
                className="flex items-center gap-2 text-sm text-ink"
              >
                <input
                  type="checkbox"
                  checked={serviceIds.includes(service.id)}
                  onChange={() =>
                    setServiceIds((prev) => toggleId(prev, service.id))
                  }
                  className="accent-signal"
                />
                {service.name}
              </label>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs text-ink-dim">Linked tickets</span>
          <div className="flex max-h-32 flex-col gap-1 overflow-y-auto rounded-md border border-line bg-panel-raised p-2">
            {tickets.length === 0 ? (
              <span className="text-xs text-ink-faint">No tickets yet.</span>
            ) : (
              tickets.map((ticket) => (
                <label
                  key={ticket.id}
                  className="flex items-center gap-2 text-sm text-ink"
                >
                  <input
                    type="checkbox"
                    checked={ticketIds.includes(ticket.id)}
                    onChange={() =>
                      setTicketIds((prev) => toggleId(prev, ticket.id))
                    }
                    className="accent-signal"
                  />
                  <span className="truncate">{ticket.title}</span>
                </label>
              ))
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
