"use client";

import { useState } from "react";
import { Modal } from "@/components/shared/Modal";
import { SelectField } from "@/components/shared/SelectField";
import { TextField } from "@/components/shared/TextField";
import {
  createTicketInputSchema,
  updateTicketInputSchema,
} from "@/server/validation/tickets";
import {
  ticketPriorityMeta,
  ticketStatusMeta,
  type Ticket,
  type TicketPriority,
  type TicketStatus,
  type User,
} from "@/types";

const statusOptions = Object.entries(ticketStatusMeta).map(([value, meta]) => ({
  value,
  label: meta.label,
}));
const priorityOptions = Object.entries(ticketPriorityMeta).map(
  ([value, meta]) => ({ value, label: meta.label }),
);

export interface CreateTicketFields {
  title: string;
  description: string;
  priority: TicketPriority;
  assigneeId: string | null;
}

export interface UpdateTicketFields {
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  assigneeId: string | null;
  expectedVersion: number;
}

interface TicketModalProps {
  /** null = create mode. Otherwise the ticket being edited — the *live*
   *  row from the query cache, so a change made by someone else while
   *  this form is open shows up here as a new `version`. */
  ticket: Ticket | null;
  users: User[];
  /** True while the create/update mutation is in flight — this is a
   *  real network round trip now (Milestone 2), not an instant local
   *  state update, so the Save button needs to say so. */
  saving?: boolean;
  onClose: () => void;
  onCreate: (input: CreateTicketFields) => void;
  onUpdate: (input: UpdateTicketFields) => void;
}

/**
 * Create-or-edit form for a single ticket. One component handles both
 * modes since the fields are almost identical — only the starting
 * values and which callback fires differ.
 *
 * This hands the caller (TicketsView) plain input fields, not a
 * fully-formed Ticket: the server is what assigns the real id, version,
 * and timestamps now (Milestone 2), via createTicketAction/
 * updateTicketAction. Building a fake client-side Ticket object here —
 * which the pre-backend version of this file used to do — would just be
 * guessing at values the server is actually responsible for.
 *
 * Validated with the same Zod schemas the server uses
 * (server/validation/tickets.ts) via `.safeParse()` on submit, per the
 * resolved decision in BACKEND_ROADMAP.md not to adopt React Hook Form —
 * one shared definition of "a valid ticket," without a form-library
 * rewrite these ~5 fields don't need.
 */
export function TicketModal({
  ticket,
  users,
  saving,
  onClose,
  onCreate,
  onUpdate,
}: TicketModalProps) {
  const isCreate = ticket === null;

  const [title, setTitle] = useState(ticket?.title ?? "");
  const [description, setDescription] = useState(ticket?.description ?? "");
  const [status, setStatus] = useState<TicketStatus>(ticket?.status ?? "OPEN");
  const [priority, setPriority] = useState<TicketPriority>(
    ticket?.priority ?? "MEDIUM",
  );
  const [assigneeId, setAssigneeId] = useState(ticket?.assigneeId ?? "");
  const [formError, setFormError] = useState<string | null>(null);

  // The version this form's fields were loaded from. Saves are sent
  // against *this*, never the live `ticket.version` — otherwise a
  // remote change would silently rebase our stale edits onto the new
  // version and overwrite someone else's work (§8).
  const [baseVersion, setBaseVersion] = useState(ticket?.version ?? 0);
  const isStale = ticket !== null && ticket.version !== baseVersion;

  const loadLatest = () => {
    if (!ticket) return;
    setTitle(ticket.title);
    setDescription(ticket.description);
    setStatus(ticket.status);
    setPriority(ticket.priority);
    setAssigneeId(ticket.assigneeId ?? "");
    setBaseVersion(ticket.version);
    setFormError(null);
  };

  const handleSave = () => {
    if (isCreate) {
      const parsed = createTicketInputSchema.safeParse({
        title,
        description,
        priority,
        assigneeId: assigneeId || null,
      });
      if (!parsed.success) {
        setFormError(parsed.error.issues[0]?.message ?? "Invalid input.");
        return;
      }
      setFormError(null);
      onCreate({ ...parsed.data, assigneeId: parsed.data.assigneeId ?? null });
    } else {
      const parsed = updateTicketInputSchema.safeParse({
        title,
        description,
        status,
        priority,
        assigneeId: assigneeId || null,
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
        priority: parsed.data.priority ?? priority,
        assigneeId: parsed.data.assigneeId ?? null,
        expectedVersion: parsed.data.expectedVersion,
      });
    }
  };

  const footer = (
    <div className="flex flex-col gap-2">
      {isStale && (
        <div className="flex items-center justify-between gap-3 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-ink">
          <span>
            Someone else updated this ticket while you were editing. Load their
            version to keep going — your unsaved edits here will be replaced.
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
          disabled={saving || isStale}
          className="rounded-md bg-ink px-3 py-1.5 text-sm font-medium text-bg transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Saving…" : isCreate ? "Create ticket" : "Save changes"}
        </button>
      </div>
    </div>
  );

  return (
    <Modal
      title={isCreate ? "New ticket" : "Edit ticket"}
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

        <div
          className={
            isCreate ? "grid grid-cols-1 gap-3" : "grid grid-cols-2 gap-3"
          }
        >
          {!isCreate && (
            <SelectField
              label="Status"
              value={status}
              onChange={(value) => setStatus(value as TicketStatus)}
              options={statusOptions}
            />
          )}
          <SelectField
            label="Priority"
            value={priority}
            onChange={(value) => setPriority(value as TicketPriority)}
            options={priorityOptions}
          />
        </div>

        <SelectField
          label="Assignee"
          value={assigneeId ?? ""}
          onChange={setAssigneeId}
          options={[
            { value: "", label: "Unassigned" },
            // Deactivated members aren't offered as a new assignee — but a
            // ticket already assigned to one keeps showing them, so the
            // select doesn't silently fall back to "Unassigned".
            ...users
              .filter((u) => u.active || u.id === ticket?.assigneeId)
              .map((u) => ({
                value: u.id,
                label: u.active ? u.name : `${u.name} (removed)`,
              })),
          ]}
        />
      </div>
    </Modal>
  );
}
