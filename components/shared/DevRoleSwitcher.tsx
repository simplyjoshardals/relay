"use client";

import { useTransition } from "react";
import type { Role } from "@/types";
import { setDevRoleAction } from "@/lib/dev-role-actions";

const options: { value: Role; label: string }[] = [
  { value: "MEMBER", label: "Member" },
  { value: "MANAGER", label: "Manager" },
];

/**
 * Dev-only "view as Member / view as Manager" toggle — stands in for
 * real login until auth lands (README §5/§16, Milestone 1). Lets
 * role-gated UI actually be seen and tested now. Delete this once real
 * session switching (signing in as different users) makes it redundant.
 */
export function DevRoleSwitcher({ role }: { role: Role }) {
  const [isPending, startTransition] = useTransition();

  const setRole = (next: Role) => {
    if (next === role) return;
    startTransition(() => {
      setDevRoleAction(next);
    });
  };

  return (
    <div
      className="flex items-center gap-0.5 rounded-md border border-line bg-panel p-0.5"
      title="Dev only — stands in for real login until auth lands"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          disabled={isPending}
          onClick={() => setRole(option.value)}
          aria-pressed={option.value === role}
          className={
            option.value === role
              ? "rounded px-2 py-1 text-xs font-medium text-ink bg-panel-raised"
              : "rounded px-2 py-1 text-xs text-ink-dim transition-colors hover:text-ink disabled:opacity-50"
          }
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
