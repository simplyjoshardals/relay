import { Avatar } from "./Avatar";
import type { User } from "@/types";

interface PresenceRailProps {
  users: User[];
  onlineIds: Set<string>;
}

export function PresenceRail({ users, onlineIds }: PresenceRailProps) {
  const sorted = [...users].sort((a, b) => {
    const aOnline = onlineIds.has(a.id) ? 0 : 1;
    const bOnline = onlineIds.has(b.id) ? 0 : 1;
    return aOnline - bOnline;
  });

  return (
    <div className="rounded-lg border border-line bg-panel p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-ink">Team</h2>
        <span className="text-xs text-ink-faint">{onlineIds.size} online</span>
      </div>

      <ul className="mt-3 flex flex-col gap-2">
        {sorted.map((user) => {
          const online = onlineIds.has(user.id);
          return (
            <li key={user.id} className="flex items-center gap-2.5">
              <Avatar initials={user.initials} online={online} />
              <span
                className={
                  online ? "text-xs text-ink" : "text-xs text-ink-faint"
                }
              >
                {user.name}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
