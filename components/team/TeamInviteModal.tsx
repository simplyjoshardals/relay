"use client";

import { useState } from "react";
import { Modal } from "@/components/shared/Modal";
import { SelectField } from "@/components/shared/SelectField";
import { TextField } from "@/components/shared/TextField";
import type { Role, User } from "@/types";

interface TeamInviteModalProps {
  self: User;
  onClose: () => void;
  onInvite: (user: User) => void;
}

const roleOptions: { value: Role; label: string }[] = [
  { value: "MEMBER", label: "Member" },
  { value: "MANAGER", label: "Manager" },
];

function initialsFor(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return (
    words
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase() || "?"
  );
}

/** There's no real invite flow yet — no email sends, no pending/accepted
 *  states (that's genuine auth-system work, not scaffolding). This adds
 *  the person directly to the org's local member list, standing in for
 *  what accepting an invite would eventually leave behind. */
export function TeamInviteModal({
  self,
  onClose,
  onInvite,
}: TeamInviteModalProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("MEMBER");

  const canSave = name.trim().length > 0 && email.trim().includes("@");

  const handleInvite = () => {
    if (!canSave) return;

    onInvite({
      id: `u_${crypto.randomUUID()}`,
      orgId: self.orgId,
      email: email.trim(),
      name: name.trim(),
      role,
      initials: initialsFor(name.trim()),
    });
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
        onClick={handleInvite}
        disabled={!canSave}
        className="rounded-md bg-ink px-3 py-1.5 text-sm font-medium text-bg transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        Add member
      </button>
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
