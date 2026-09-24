"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PlusIcon } from "@phosphor-icons/react";
import { Avatar } from "@/components/dashboard/Avatar";
import { SearchInput } from "@/components/shared/SearchInput";
import { SelectField } from "@/components/shared/SelectField";
import {
  TeamInviteModal,
  type InviteFields,
  type InviteResult,
} from "@/components/team/TeamInviteModal";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useToast } from "@/components/shared/Toast";
import { failureMessage, unwrap } from "@/lib/action-result";
import { initialsFor } from "@/lib/initials";
import { listOrgUsersAction } from "@/app/(dashboard)/tickets/actions";
import {
  deactivateMemberAction,
  inviteMemberAction,
  listPendingInvitationsAction,
  revokeInvitationAction,
  updateMemberRoleAction,
} from "@/app/(dashboard)/team/actions";
import { relativeTime } from "@/lib/style";
import { useNow } from "@/lib/use-now";
import type { PendingInvitation, Role, User } from "@/types";

interface TeamViewProps {
  self: User;
}

const roleOptions: { value: Role; label: string }[] = [
  { value: "MEMBER", label: "Member" },
  { value: "MANAGER", label: "Manager" },
];

const roleLabel = (role: Role) => (role === "MANAGER" ? "Manager" : "Member");

// Stable fallbacks, same reasoning as the other views' EMPTY_* constants:
// a fresh `?? []` every render would defeat the useMemo() below.
const EMPTY_USERS: User[] = [];
const EMPTY_INVITATIONS: PendingInvitation[] = [];

// `["org-users", "list"]` is shared with TicketsView, IncidentsView,
// PresenceRail and ActivityView on purpose — one roster, one cache entry,
// and RealtimeProvider's `team.updated` handler invalidates it for all of
// them at once.
const USERS_KEY = ["org-users", "list"] as const;
const INVITATIONS_KEY = ["team", "invitations"] as const;

/**
 * Manager-only member list — invite, remove, change role — now backed by
 * real queries and Server Actions (Milestone 10), following the same
 * shape ServicesView/TicketsView settled on: self-fetching,
 * `unwrap()`ed mutations, `onError` toasts, invalidate on settle so the
 * server always wins.
 *
 * What "Remove" means changed: it deactivates the member (decision 2) —
 * they can't sign in any more, but the row and everything pointing at it
 * stays. Deactivated members are hidden here; they still resolve by name
 * everywhere history is shown.
 *
 * Role changes are optimistic with rollback; invites and removals are
 * not (an invite's result — the link — comes from the server, and a
 * removal is destructive enough to wait for confirmation that it
 * happened).
 *
 * The UI disabling your own row's controls is a courtesy — the server
 * enforces self-protection and the last-Manager rule itself (AUTH-07).
 */
export function TeamView({ self }: TeamViewProps) {
  const now = useNow();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteResult, setInviteResult] = useState<InviteResult | null>(null);
  const [removeCandidate, setRemoveCandidate] = useState<User | null>(null);

  const usersQuery = useQuery({
    queryKey: USERS_KEY,
    queryFn: listOrgUsersAction,
  });
  const invitationsQuery = useQuery({
    queryKey: INVITATIONS_KEY,
    queryFn: listPendingInvitationsAction,
  });

  const members = useMemo(
    () => (usersQuery.data ?? EMPTY_USERS).filter((u) => u.active),
    [usersQuery.data],
  );
  const invitations = invitationsQuery.data ?? EMPTY_INVITATIONS;

  const query = search.trim().toLowerCase();

  const filteredMembers = useMemo(() => {
    const list = query
      ? members.filter(
          (u) =>
            u.name.toLowerCase().includes(query) ||
            u.email.toLowerCase().includes(query),
        )
      : members;

    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [members, query]);

  const filteredInvitations = useMemo(
    () =>
      query
        ? invitations.filter(
            (i) =>
              i.name.toLowerCase().includes(query) ||
              i.email.toLowerCase().includes(query),
          )
        : invitations,
    [invitations, query],
  );

  const invalidateTeam = () => {
    queryClient.invalidateQueries({ queryKey: USERS_KEY });
    queryClient.invalidateQueries({ queryKey: INVITATIONS_KEY });
  };

  const inviteMutation = useMutation({
    mutationFn: async (fields: InviteFields) =>
      unwrap(await inviteMemberAction(fields)),
    onSuccess: ({ invitation, token }) => {
      invalidateTeam();
      setInviteResult({
        email: invitation.email,
        link: `${window.location.origin}/invite/${token}`,
      });
    },
    onError: (error) =>
      toast.show(failureMessage(error, "created", "invitation"), "error"),
  });

  const revokeMutation = useMutation({
    mutationFn: async (invitation: PendingInvitation) =>
      unwrap(await revokeInvitationAction(invitation.id)),
    onSuccess: (_data, invitation) =>
      toast.show(`Invitation to ${invitation.email} revoked`),
    onError: (error) =>
      toast.show(failureMessage(error, "updated", "invitation"), "error"),
    onSettled: invalidateTeam,
  });

  const roleMutation = useMutation({
    mutationFn: async ({ user, role }: { user: User; role: Role }) =>
      unwrap(await updateMemberRoleAction(user.id, { role })),

    onMutate: async ({ user, role }) => {
      await queryClient.cancelQueries({ queryKey: USERS_KEY });
      const previous = queryClient.getQueryData<User[]>(USERS_KEY);

      queryClient.setQueryData<User[]>(USERS_KEY, (old) =>
        old?.map((u) => (u.id === user.id ? { ...u, role } : u)),
      );

      return { previous };
    },

    onSuccess: (_data, { user, role }) =>
      toast.show(`${user.name}'s role changed to ${roleLabel(role)}`),

    onError: (error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(USERS_KEY, context.previous);
      }
      // The server's own message is the useful one here (last-Manager
      // rule, "not a Manager any more", …) — failureMessage passes an
      // ActionFailure's message straight through.
      toast.show(failureMessage(error, "updated", "member"), "error");
    },

    onSettled: invalidateTeam,
  });

  const removeMutation = useMutation({
    mutationFn: async (user: User) =>
      unwrap(await deactivateMemberAction(user.id)),
    onSuccess: (user) => toast.show(`${user.name} removed from the team`),
    onError: (error) =>
      toast.show(failureMessage(error, "updated", "member"), "error"),
    onSettled: invalidateTeam,
  });

  const closeInvite = () => {
    setInviting(false);
    setInviteResult(null);
  };

  const isLoading = usersQuery.isLoading;
  const nothingToShow =
    filteredMembers.length === 0 && filteredInvitations.length === 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex shrink-0 items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-medium text-ink">Team</h1>
          <p className="text-sm text-ink-dim">
            {members.length} {members.length === 1 ? "member" : "members"}
            {invitations.length > 0 && ` · ${invitations.length} pending`}
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

        {isLoading ? (
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-8 text-center text-sm text-ink-dim">
            Loading team…
          </div>
        ) : usersQuery.isError ? (
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-8 text-center text-sm text-danger">
            Couldn&apos;t load the team.{" "}
            <button
              type="button"
              onClick={() => usersQuery.refetch()}
              className="underline hover:text-ink"
            >
              Try again
            </button>
          </div>
        ) : nothingToShow ? (
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-8 text-center text-sm text-ink-dim">
            No members match your search.
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <ul>
              {filteredMembers.map((user) => {
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
                        onChange={(value) =>
                          roleMutation.mutate({ user, role: value as Role })
                        }
                        options={roleOptions}
                        disabled={isSelf}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => setRemoveCandidate(user)}
                      disabled={isSelf}
                      title={
                        isSelf
                          ? "You can't remove yourself"
                          : "Remove from team"
                      }
                      className="shrink-0 rounded-md px-2.5 py-1.5 text-xs text-ink-faint transition-colors hover:text-danger disabled:opacity-30 disabled:hover:text-ink-faint"
                    >
                      Remove
                    </button>
                  </li>
                );
              })}
            </ul>

            {filteredInvitations.length > 0 && (
              <>
                <div className="border-y border-line bg-panel-raised/50 px-4 py-1.5 text-[11px] font-medium uppercase tracking-wide text-ink-faint">
                  Pending invitations
                </div>

                <ul>
                  {filteredInvitations.map((invitation) => (
                    <li
                      key={invitation.id}
                      className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0"
                    >
                      <span
                        className="flex size-6 shrink-0 items-center justify-center rounded-full border border-dashed border-line-strong text-[10px] text-ink-faint"
                        aria-hidden
                      >
                        {initialsFor(invitation.name)}
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-sm text-ink-dim">
                            {invitation.name}
                          </span>
                          <span className="shrink-0 rounded bg-panel-raised px-1.5 py-0.5 text-[10px] text-ink-faint">
                            Pending
                          </span>
                        </div>
                        <div className="truncate text-xs text-ink-faint">
                          {invitation.email} · expires{" "}
                          {new Date(invitation.expiresAt).toLocaleDateString()}
                        </div>
                      </div>

                      <span className="w-32 shrink-0 text-sm text-ink-dim">
                        {roleLabel(invitation.role)}
                      </span>

                      <button
                        type="button"
                        onClick={() => revokeMutation.mutate(invitation)}
                        disabled={revokeMutation.isPending}
                        title={`Sent ${relativeTime(invitation.createdAt, now)}`}
                        className="shrink-0 rounded-md px-2.5 py-1.5 text-xs text-ink-faint transition-colors hover:text-danger disabled:opacity-50"
                      >
                        Revoke
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </div>

      {inviting && (
        <TeamInviteModal
          onClose={closeInvite}
          onInvite={(fields) => inviteMutation.mutate(fields)}
          saving={inviteMutation.isPending}
          result={inviteResult}
        />
      )}

      {removeCandidate && (
        <ConfirmDialog
          title="Remove team member?"
          message={`${removeCandidate.name} won't be able to sign in again. Their past tickets, incidents and activity stay on the record. A session they already have open can keep working for up to 15 minutes.`}
          confirmLabel="Remove member"
          onConfirm={() => {
            removeMutation.mutate(removeCandidate);
            setRemoveCandidate(null);
          }}
          onCancel={() => setRemoveCandidate(null)}
        />
      )}
    </div>
  );
}
