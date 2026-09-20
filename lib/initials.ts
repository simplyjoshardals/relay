/** Derives display initials from a full name — never stored, always
 *  computed from the one thing that can't itself be derived (a real
 *  name). Shared between client code (TeamInviteModal, for a
 *  newly-invited member who has no DB row yet) and server code
 *  (server/auth/session.ts, for a real user's initials) rather than
 *  each keeping its own copy. */
export function initialsFor(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return (
    words
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase() || "?"
  );
}
