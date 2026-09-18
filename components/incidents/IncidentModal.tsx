"use client";

import { useState } from "react";
import { Modal } from "@/components/shared/Modal";
import { SelectField } from "@/components/shared/SelectField";
import { TextField } from "@/components/shared/TextField";
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

interface IncidentModalProps {
  /** null = create mode. Otherwise the incident being edited. */
  incident: Incident | null;
  services: Service[];
  tickets: Ticket[];
  users: User[];
  self: User;
  onClose: () => void;
  onSave: (incident: Incident) => void;
}

/** Create-or-edit form for a single incident — same one-component-both-
 *  modes reasoning as TicketModal. Also owns the "linking" actions from
 *  the Activity model (INCIDENT_SERVICE_LINKED/UNLINKED,
 *  INCIDENT_TICKET_LINKED/UNLINKED) as a checklist rather than a separate
 *  flow, since for MVP a link/unlink is just membership in this list.
 *
 *  Same local-only caveat as TicketModal: no backend yet, so this doesn't
 *  also append to the Activity feed — see that file's comment for why. */
export function IncidentModal({
  incident,
  services,
  tickets,
  users,
  self,
  onClose,
  onSave,
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

  const canSave = title.trim().length > 0;

  const toggleId = (list: string[], id: string) =>
    list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

  const handleSave = () => {
    if (!canSave) return;
    const now = new Date().toISOString();

    // resolvedAt tracks status: set the instant it first becomes RESOLVED,
    // keep the original timestamp if it was already resolved, clear it if
    // reopened.
    const wasResolved = incident?.status === "RESOLVED";
    const isResolved = status === "RESOLVED";
    const resolvedAt = isResolved
      ? wasResolved
        ? incident.resolvedAt
        : now
      : null;

    onSave(
      isCreate
        ? {
            id: `i_${crypto.randomUUID()}`,
            orgId: self.orgId,
            title: title.trim(),
            description: description.trim(),
            status,
            severity,
            responderId: responderId || null,
            createdAt: now,
            resolvedAt,
            version: 1,
            serviceIds,
            ticketIds,
          }
        : {
            ...incident,
            title: title.trim(),
            description: description.trim(),
            status,
            severity,
            responderId: responderId || null,
            resolvedAt,
            version: incident.version + 1,
            serviceIds,
            ticketIds,
          },
    );
    onClose();
  };

  const footer = (
    <div className="flex items-center justify-end gap-2">
      <button
        type="button"
        onClick={onClose}
        className="rounded-md border border-line px-3 py-1.5 text-sm text-ink-dim transition-colors hover:text-ink"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={handleSave}
        disabled={!canSave}
        className="rounded-md bg-ink px-3 py-1.5 text-sm font-medium text-bg transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {isCreate ? "Create incident" : "Save changes"}
      </button>
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
