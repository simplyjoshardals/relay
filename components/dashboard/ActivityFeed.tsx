import { CpuIcon } from "@phosphor-icons/react/ssr";
import { Avatar } from "./Avatar";
import { describeActivity } from "@/components/shared/ActivityDescription";
import type { Activity, User } from "@/types";
import { relativeTime } from "@/lib/style";

interface ActivityFeedProps {
  activities: Activity[];
  resolveUser: (id: string | null) => User | null;
}

export function ActivityFeed({ activities, resolveUser }: ActivityFeedProps) {
  const sorted = [...activities].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return (
    <div className="rounded-lg border border-line bg-panel p-4">
      <h2 className="text-sm font-medium text-ink">Activity</h2>

      <ul className="mt-3 flex flex-col gap-3">
        {sorted.map((activity) => {
          const actor = resolveUser(activity.actorId);
          return (
            <li key={activity.id} className="flex items-start gap-2.5">
              {actor ? (
                <Avatar
                  initials={actor.initials}
                  seed={actor.id}
                  title={actor.name}
                />
              ) : (
                <span
                  className="flex size-6 shrink-0 items-center justify-center rounded-full bg-panel-raised text-ink-faint"
                  title="Telemetry"
                >
                  <CpuIcon size={12} weight="bold" />
                </span>
              )}
              <div className="min-w-0 text-xs leading-snug">
                <span className="text-ink-dim">
                  <span
                    className={actor ? "text-ink" : "text-ink-faint font-mono"}
                  >
                    {actor ? actor.name : "telemetry"}
                  </span>{" "}
                  {describeActivity(activity)}
                </span>
                <div className="mt-0.5 text-[11px] text-ink-faint">
                  {relativeTime(activity.createdAt)}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
