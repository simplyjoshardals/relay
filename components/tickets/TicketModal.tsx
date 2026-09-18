"use client";

import { useState } from "react";
import { Modal } from "@/components/shared/Modal";
import { SelectField } from "@/components/shared/SelectField";
import { TextField } from "@/components/shared/TextField";
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

interface TicketModalProps {
  /** null = create mode. Otherwise the ticket being edited. */
  ticket: Ticket | null;
  users: User[];
  self: User;
  onClose: () => void;
  onSave: (ticket: Ticket) => void;
}

/** Create-or-edit form for a single ticket. One component handles both
 *  modes (rather than a separate create form) since the fields are
 *  identical — only the starting values and what onSave does with the id
 *  differ, and that's the caller's job (TicketsView), not this form's.
 *
 *  Note: this only updates the caller's local ticket list — there's no
 *  backend yet (see ROADMAP_ROLES.md Phase 2), so it deliberately does
 *  NOT also append to the Activity feed. Activity's mock data lives on a
 *  separate route with its own fetch, and there's no shared client store
 *  wiring the two together; building one just for mock data would be
 *  thrown away once real Server Actions + a query cache land anyway. */
export function TicketModal({
  ticket,
  users,
  self,
  onClose,
  onSave,
}: TicketModalProps) {
  const isCreate = ticket === null;

  const [title, setTitle] = useState(ticket?.title ?? "");
  const [description, setDescription] = useState(ticket?.description ?? "");
  const [status, setStatus] = useState<TicketStatus>(ticket?.status ?? "OPEN");
  const [priority, setPriority] = useState<TicketPriority>(
    ticket?.priority ?? "MEDIUM",
  );
  const [assigneeId, setAssigneeId] = useState(ticket?.assigneeId ?? "");

  const canSave = title.trim().length > 0;

  const handleSave = () => {
    if (!canSave) return;
    const now = new Date().toISOString();

    onSave(
      isCreate
        ? {
            id: `t_${crypto.randomUUID()}`,
            orgId: self.orgId,
            title: title.trim(),
            description: description.trim(),
            status,
            priority,
            assigneeId: assigneeId || null,
            creatorId: self.id,
            version: 1,
            createdAt: now,
            updatedAt: now,
          }
        : {
            ...ticket,
            title: title.trim(),
            description: description.trim(),
            status,
            priority,
            assigneeId: assigneeId || null,
            version: ticket.version + 1,
            updatedAt: now,
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
        {isCreate ? "Create ticket" : "Save changes"}
      </button>
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

        <div className="grid grid-cols-2 gap-3">
          <SelectField
            label="Status"
            value={status}
            onChange={(value) => setStatus(value as TicketStatus)}
            options={statusOptions}
          />
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
            ...users.map((u) => ({ value: u.id, label: u.name })),
          ]}
        />
      </div>
    </Modal>
  );
}
