"use client";

import { useState } from "react";
import { Modal } from "@/components/shared/Modal";
import { TextField } from "@/components/shared/TextField";
import {
  createServiceInputSchema,
  updateServiceInputSchema,
} from "@/server/validation/services";
import type { Service } from "@/types";

export interface CreateServiceFields {
  name: string;
  description: string;
}

export interface UpdateServiceFields {
  name: string;
  description: string;
  expectedVersion: number;
}

interface ServiceModalProps {
  /** null = create mode. Otherwise the service being edited — the *live*
   *  row from the query cache (same reasoning as TicketModal's `ticket`
   *  prop), so a change made by someone else (a Manager on another tab,
   *  or the telemetry worker) while this form is open shows up here. */
  service: Service | null;
  /** True while create/update is in flight (Milestone 4: a real network
   *  round trip, not an instant local update). */
  saving?: boolean;
  onClose: () => void;
  onCreate: (input: CreateServiceFields) => void;
  onUpdate: (input: UpdateServiceFields) => void;
  /** Asks the caller (ServicesView) to switch to an archive-confirm step
   *  before actually archiving. Only for archiving (false → true) —
   *  restoring (true → false) fires immediately via onRestore, since it's
   *  not the action that hides a service from the default view. */
  onRequestArchive: (service: Service) => void;
  /** Restoring an archived service, applied immediately against its
   *  *current* version — independent of whatever's typed into the
   *  name/description fields below, same as how TicketsView's
   *  "Assign to me" acts on the live ticket rather than routing through
   *  the open form. */
  onRestore: (service: Service) => void;
}

/** Create-or-edit form for a service *catalog entry* — name and
 *  description only. Status, latency, error rate, and the sparkline are
 *  telemetry-driven (README §13, the worker) and deliberately not
 *  editable here; Manager manages which services exist, not their live
 *  health numbers. A brand-new service gets OPERATIONAL / zeroed metrics
 *  server-side (server/repositories/services.ts#createService) as a
 *  placeholder until real telemetry reports otherwise.
 *
 *  There's no delete here — README §19 is explicit that services (like
 *  tickets and incidents) are never hard-deleted in the MVP, only
 *  archived. Archiving just hides a service from the default view (and
 *  from the telemetry worker's tick, per server/application/services.ts);
 *  the record, and anything historical referencing it, stays intact.
 *
 *  Validated with the same Zod schemas the server uses
 *  (server/validation/services.ts) via `.safeParse()` on submit, per the
 *  resolved decision in BACKEND_ROADMAP.md not to adopt React Hook Form. */
export function ServiceModal({
  service,
  saving,
  onClose,
  onCreate,
  onUpdate,
  onRequestArchive,
  onRestore,
}: ServiceModalProps) {
  const isCreate = service === null;

  const [name, setName] = useState(service?.name ?? "");
  const [description, setDescription] = useState(service?.description ?? "");
  const [formError, setFormError] = useState<string | null>(null);

  // The version this form's fields were loaded from — saves go out
  // against *this*, never the live `service.version`, so a remote change
  // can't silently rebase our stale edits onto the new version (§8).
  // Same pattern as TicketModal's baseVersion.
  const [baseVersion, setBaseVersion] = useState(service?.version ?? 0);
  const isStale = service !== null && service.version !== baseVersion;

  const loadLatest = () => {
    if (!service) return;
    setName(service.name);
    setDescription(service.description);
    setBaseVersion(service.version);
    setFormError(null);
  };

  const handleSave = () => {
    if (isCreate) {
      const parsed = createServiceInputSchema.safeParse({ name, description });
      if (!parsed.success) {
        setFormError(parsed.error.issues[0]?.message ?? "Invalid input.");
        return;
      }
      setFormError(null);
      onCreate(parsed.data);
    } else {
      const parsed = updateServiceInputSchema.safeParse({
        name,
        description,
        expectedVersion: baseVersion,
      });
      if (!parsed.success) {
        setFormError(parsed.error.issues[0]?.message ?? "Invalid input.");
        return;
      }
      setFormError(null);
      onUpdate({
        name: parsed.data.name ?? name,
        description: parsed.data.description ?? description,
        expectedVersion: parsed.data.expectedVersion,
      });
    }
  };

  const canSave = name.trim().length > 0;

  const footer = (
    <div className="flex flex-col gap-2">
      {isStale && (
        <div className="flex items-center justify-between gap-3 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-ink">
          <span>
            Someone else updated this service while you were editing. Load their
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
      <div className="flex items-center justify-between gap-2">
        {!isCreate ? (
          <button
            type="button"
            onClick={() =>
              service.archived ? onRestore(service) : onRequestArchive(service)
            }
            disabled={saving}
            className="rounded-md px-3 py-1.5 text-sm text-ink-faint transition-colors hover:text-ink disabled:opacity-50"
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
            {saving ? "Saving…" : isCreate ? "Add service" : "Save changes"}
          </button>
        </div>
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
            This service is archived — hidden from the default view and skipped
            by telemetry, but its history is still intact. Restore it to monitor
            it again.
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
