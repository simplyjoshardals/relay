"use client";

import { useActionState, useState } from "react";
import { TextField } from "@/components/shared/TextField";
import { loginAction, type LoginFormState } from "@/app/login/actions";

const initialState: LoginFormState = { error: null };

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(
    loginAction,
    initialState,
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <TextField
        label="Email"
        name="email"
        type="email"
        autoFocus
        value={email}
        onChange={setEmail}
        placeholder="name@company.com"
      />

      <TextField
        label="Password"
        name="password"
        type="password"
        value={password}
        onChange={setPassword}
        placeholder="••••••••"
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
        {isPending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
