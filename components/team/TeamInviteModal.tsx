"use client";

import { useState } from "react";
import { Modal } from "@/components/shared/Modal";
import { SelectField } from "@/components/shared/SelectField";
import { TextField } from "@/components/shared/TextField";
import { inviteMemberInputSchema } from "@/server/validation/invitations";
import { INVITATION_TTL_DAYS } from "@/server/domain/team";
import type { Role } from "@/types";

export interface InviteFields {
  name: string;
  email: string;
  role: Role;
}

/** What TeamView hands back once the server has created the invitation. */
export interface InviteResult {
  email: string;
  /** Full accept URL, built from the one-time token. */
  link: string;
}

interface TeamInviteModalProps {
  onClose: () => void;
  onInvite: (fields: InviteFields) => void;
  saving: boolean;
  /** null while filling in the form; set once the invitation exists. */
  result: InviteResult | null;
}

const roleOptions: { value: Role; label: string }[] = [
  { value: "MEMBER", label: "Member" },
  { value: "MANAGER", label: "Manager" },
];

/**
 * Milestone 10: submitting creates a *pending invitation* (decision 1),
 * not a user — the invitee sets their own password when they open the
 * link. There's no email transport yet, so after creating it this
 * modal's second phase shows the Manager the link to pass along
 * themselves. The link is only ever visible here, right now: the server
 * stores just a hash of its token.
 *
 * Same `useState` + `.safeParse()`-on-submit form pattern as the other
 * modals (resolved React-Hook-Form decision, BACKEND_ROADMAP.md).
 */
export function TeamInviteModal({
  onClose,
  onInvite,
  saving,
  result,
}: TeamInviteModalProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("MEMBER");
  const [formError, setFormError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleInvite = () => {
    const parsed = inviteMemberInputSchema.safeParse({ name, email, role });
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? "Invalid input.");
      return;
    }
    setFormError(null);
    onInvite(parsed.data);
  };

  const copyLink = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.link);
      setCopied(true);
    } catch {
      // Clipboard can be unavailable (insecure context, denied
      // permission) — the field is selectable, so nothing is lost.
      setCopied(false);
    }
  };

  if (result) {
    return (
      <Modal
        title="Invitation created"
        onClose={onClose}
        footer={
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md bg-ink px-3 py-1.5 text-sm font-medium text-bg transition-opacity hover:opacity-90"
            >
              Done
            </button>
          </div>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="text-sm text-ink-dim">
            Email delivery isn&apos;t set up yet, so send this link to{" "}
            <span className="text-ink">{result.email}</span> yourself. It works
            once and expires in {INVITATION_TTL_DAYS} days. You won&apos;t be
            able to see it again — if you lose it, revoke the invitation and
            send a new one.
          </p>

          <div className="flex items-center gap-2">
            <input
              readOnly
              aria-label="Invitation link"
              value={result.link}
              onFocus={(e) => e.currentTarget.select()}
              className="min-w-0 flex-1 rounded-md border border-line bg-panel-raised px-2.5 py-1.5 font-mono text-xs text-ink focus:outline-none focus:ring-1 focus:ring-inset focus:ring-signal"
            />
            <button
              type="button"
              onClick={copyLink}
              className="shrink-0 rounded-md border border-line px-3 py-1.5 text-sm text-ink-dim transition-colors hover:text-ink"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  const footer = (
    <div className="flex flex-col gap-2">
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
          onClick={handleInvite}
          disabled={saving}
          className="rounded-md bg-ink px-3 py-1.5 text-sm font-medium text-bg transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Creating…" : "Create invitation"}
        </button>
      </div>
    </div>
  );

  return (
    <Modal title="Invite member" onClose={onClose} footer={footer}>
      <div className="flex flex-col gap-3">
        <TextField
          label="Name"
          autoFocus
          value={name}
          onChange={setName}
          placeholder="Full name"
        />

        <TextField
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="name@company.com"
        />

        <SelectField
          label="Role"
          value={role}
          onChange={(value) => setRole(value as Role)}
          options={roleOptions}
        />
      </div>
    </Modal>
  );
}
