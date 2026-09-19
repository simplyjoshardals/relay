"use client";

import { useState } from "react";
import { Modal } from "@/components/shared/Modal";
import { TextField } from "@/components/shared/TextField";
import type { Service, User } from "@/types";

interface ServiceModalProps {
  /** null = create mode. Otherwise the service being edited. */
  service: Service | null;
  self: User;
  onClose: () => void;
  onSave: (service: Service) => void;
  /** Asks the caller (ServicesView) to switch to an archive-confirm step
   *  before this modal's own onSave applies the change. Only called for
   *  archiving (going false → true) — restoring (true → false) doesn't
   *  need a confirm step, since it's not the action that hides a
   *  service from the default view. */
  onRequestArchive: (service: Service) => void;
}

/** Create-or-edit form for a service *catalog entry* — name and
 *  description only. Status, latency, error rate, and the sparkline are
 *  telemetry-driven (README §13, owned by the worker milestone) and
 *  deliberately not editable here; Manager manages which services exist,
 *  not their live health numbers. A brand-new service gets OPERATIONAL /
 *  zeroed metrics as a placeholder until real telemetry exists to report
 *  otherwise.
 *
 *  There's no delete here — README §19 is explicit that services (like
 *  tickets and incidents) are never hard-deleted in the MVP, only
 *  archived. Archiving just hides a service from the default view; the
 *  record, and anything historical referencing it, stays intact. */
export function ServiceModal({
  service,
  self,
  onClose,
  onSave,
  onRequestArchive,
}: ServiceModalProps) {
  const isCreate = service === null;

  const [name, setName] = useState(service?.name ?? "");
  const [description, setDescription] = useState(service?.description ?? "");

  const canSave = name.trim().length > 0;

  const handleSave = () => {
    if (!canSave) return;
    const now = new Date().toISOString();

    onSave(
      isCreate
        ? {
            id: `svc_${crypto.randomUUID()}`,
            orgId: self.orgId,
            name: name.trim(),
            description: description.trim(),
            status: "OPERATIONAL",
            latencyMs: 0,
            errorRate: 0,
            version: 1,
            updatedAt: now,
            archived: false,
            sessionLatencyTrend: [],
          }
        : {
            ...service,
            name: name.trim(),
            description: description.trim(),
            version: service.version + 1,
            updatedAt: now,
          },
    );
    onClose();
  };

  const handleRestore = () => {
    if (!service) return;
    onSave({
      ...service,
      archived: false,
      version: service.version + 1,
      updatedAt: new Date().toISOString(),
    });
    onClose();
  };

  const footer = (
    <div className="flex items-center justify-between gap-2">
      {!isCreate ? (
        <button
          type="button"
          onClick={() =>
            service.archived ? handleRestore() : onRequestArchive(service)
          }
          className="rounded-md px-3 py-1.5 text-sm text-ink-faint transition-colors hover:text-ink"
        >
          {service.archived ? "Restore service" : "Archive service"}
        </button>
      ) : (
        <span />
      )}

      <div className="flex items-center gap-2">
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
          {isCreate ? "Add service" : "Save changes"}
        </button>
      </div>
    </div>
  );

  return (
    <Modal
      title={isCreate ? "New service" : "Edit service"}
      onClose={onClose}
      footer={footer}
    >
      <div className="flex flex-col gap-3">
        {!isCreate && service.archived && (
          <p className="rounded-md bg-panel-raised px-2.5 py-1.5 text-xs text-ink-faint">
            This service is archived — hidden from the default view, but its
            history is still intact. Restore it to monitor it again.
          </p>
        )}

        <TextField
          label="Name"
          autoFocus
          value={name}
          onChange={setName}
          placeholder="e.g. Payments API"
        />

        <TextField
          label="Description"
          multiline
          rows={2}
          value={description}
          onChange={setDescription}
          placeholder="What this service does"
        />

        {isCreate && (
          <p className="text-xs text-ink-faint">
            Status and health metrics are reported by monitoring once it&apos;s
            wired up — this just registers the service to watch.
          </p>
        )}
      </div>
    </Modal>
  );
}
