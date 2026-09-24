"use client";

import { useActionState, useState } from "react";
import { TextField } from "@/components/shared/TextField";
import {
  acceptInvitationAction,
  type AcceptInviteFormState,
} from "@/app/invite/[token]/actions";

const initialState: AcceptInviteFormState = { error: null };

interface AcceptInviteFormProps {
  token: string;
  /** Pre-filled from what the Manager typed; the invitee has the final
   *  say over their own display name. */
  defaultName: string;
}

export function AcceptInviteForm({
  token,
  defaultName,
}: AcceptInviteFormProps) {
  const [state, formAction, isPending] = useActionState(
    acceptInvitationAction,
    initialState,
  );
  const [name, setName] = useState(defaultName);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="token" value={token} />

      <TextField
        label="Your name"
        name="name"
        autoFocus
        value={name}
        onChange={setName}
        placeholder="Full name"
      />

      <TextField
        label="Choose a password"
        name="password"
        type="password"
        value={password}
        onChange={setPassword}
        placeholder="At least 8 characters"
      />

      <TextField
        label="Confirm password"
        name="confirmPassword"
        type="password"
        value={confirmPassword}
        onChange={setConfirmPassword}
        placeholder="Repeat your password"
      />

      {state.error && (
        <p className="rounded-md bg-panel-raised px-2.5 py-1.5 text-xs text-danger">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="mt-1 rounded-md bg-ink px-3 py-1.5 text-sm font-medium text-bg transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {isPending ? "Joining…" : "Join the team"}
      </button>
    </form>
  );
}
