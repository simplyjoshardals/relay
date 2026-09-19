"use client";

import { useMemo, useState } from "react";
import { PlusIcon } from "@phosphor-icons/react";
import { Avatar } from "@/components/dashboard/Avatar";
import { SearchInput } from "@/components/shared/SearchInput";
import { SelectField } from "@/components/shared/SelectField";
import { TeamInviteModal } from "@/components/team/TeamInviteModal";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useToast } from "@/components/shared/Toast";
import type { Role, User } from "@/types";

interface TeamViewProps {
  users: User[];
  self: User;
}

const roleOptions: { value: Role; label: string }[] = [
  { value: "MEMBER", label: "Member" },
  { value: "MANAGER", label: "Manager" },
];

/** Manager-only member list — invite, remove, change role. Role change is
 *  an inline per-row dropdown (a single control doesn't need a dialog of
 *  its own), but remove goes through ConfirmDialog — a destructive,
 *  irreversible action deserves a real confirm step, not just a button
 *  whose label changes when you click it twice. Same local-only caveat
 *  as the other domains: no backend yet, changes here reset on reload. */
export function TeamView({ users, self }: TeamViewProps) {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [inviting, setInviting] = useState(false);
  const [removeCandidate, setRemoveCandidate] = useState<User | null>(null);

  const [userList, setUserList] = useState(users);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    const list = query
      ? userList.filter(
          (u) =>
            u.name.toLowerCase().includes(query) ||
            u.email.toLowerCase().includes(query),
        )
      : userList;

    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [userList, search]);

  const changeRole = (user: User, role: Role) => {
    setUserList((prev) =>
      prev.map((u) => (u.id === user.id ? { ...u, role } : u)),
    );
    toast.show(
      `${user.name}'s role changed to ${role === "MANAGER" ? "Manager" : "Member"}`,
    );
  };

  const addMember = (user: User) => {
    setUserList((prev) => [user, ...prev]);
    toast.show(`${user.name} added to the team`);
  };

  const removeMember = (user: User) => {
    setUserList((prev) => prev.filter((u) => u.id !== user.id));
    toast.show(`${user.name} removed from the team`);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex shrink-0 items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-medium text-ink">Team</h1>
          <p className="text-sm text-ink-dim">
            {userList.length} {userList.length === 1 ? "member" : "members"}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setInviting(true)}
          className="flex shrink-0 items-center gap-1.5 rounded-md bg-ink px-3 py-1.5 text-sm font-medium text-bg transition-opacity hover:opacity-90"
        >
          <PlusIcon size={14} weight="bold" />
          Invite member
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-line bg-panel">
        <div className="shrink-0 border-b border-line px-4 py-3">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search team"
          />
        </div>

        {filtered.length === 0 ? (
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-8 text-center text-sm text-ink-dim">
            No members match your search.
          </div>
        ) : (
          <ul className="min-h-0 flex-1 overflow-y-auto">
            {filtered.map((user) => {
              const isSelf = user.id === self.id;

              return (
                <li
                  key={user.id}
                  className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0"
                >
                  <Avatar
                    initials={user.initials}
                    seed={user.id}
                    title={user.name}
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm text-ink">
                        {user.name}
                      </span>
                      {isSelf && (
                        <span className="shrink-0 rounded bg-panel-raised px-1.5 py-0.5 text-[10px] text-ink-faint">
                          You
                        </span>
                      )}
                    </div>
                    <div className="truncate text-xs text-ink-faint">
                      {user.email}
                    </div>
                  </div>

                  <div className="w-32 shrink-0">
                    <SelectField
                      label="Role"
                      hideLabel
                      value={user.role}
                      onChange={(value) => changeRole(user, value as Role)}
                      options={roleOptions}
                      disabled={isSelf}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => setRemoveCandidate(user)}
                    disabled={isSelf}
                    title={
                      isSelf ? "You can't remove yourself" : "Remove from team"
                    }
                    className="shrink-0 rounded-md px-2.5 py-1.5 text-xs text-ink-faint transition-colors hover:text-danger disabled:opacity-30 disabled:hover:text-ink-faint"
                  >
                    Remove
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {inviting && (
        <TeamInviteModal
          self={self}
          onClose={() => setInviting(false)}
          onInvite={addMember}
        />
      )}

      {removeCandidate && (
        <ConfirmDialog
          title="Remove team member?"
          message={`This removes ${removeCandidate.name} from the team. There's no soft-delete yet, so this can't be undone.`}
          confirmLabel="Remove member"
          onConfirm={() => {
            removeMember(removeCandidate);
            setRemoveCandidate(null);
          }}
          onCancel={() => setRemoveCandidate(null)}
        />
      )}
    </div>
  );
}
