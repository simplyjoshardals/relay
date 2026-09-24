import { CpuIcon } from "@phosphor-icons/react/ssr";
import { Avatar } from "./Avatar";
import { describeActivity } from "@/components/shared/ActivityDescription";
import { SkeletonCircle, SkeletonText } from "@/components/shared/Skeleton";
import type { Activity, User } from "@/types";
import { relativeTime } from "@/lib/style";

interface ActivityFeedProps {
  activities: Activity[];
  resolveUser: (id: string | null) => User | null;
  /** Milestone 9: set by DashboardView while its activity query is
   *  still `isLoading` — see IncidentsPanel's `loading` prop for the
   *  same reasoning. */
  loading?: boolean;
  /** The activity query failed. */
  error?: boolean;
  onRetry?: () => void;
}

export function ActivityFeed({
  activities,
  resolveUser,
  loading,
  error,
  onRetry,
}: ActivityFeedProps) {
  if (loading) {
    return (
      <div className="rounded-lg border border-line bg-panel p-4">
        <h2 className="text-sm font-medium text-ink">Activity</h2>

        <ul className="mt-3 flex flex-col gap-3">
          {[0, 1, 2, 3].map((i) => (
            <li key={i} className="flex items-start gap-2.5">
              <SkeletonCircle />
              <div className="min-w-0 flex-1 space-y-1.5">
                <SkeletonText width="w-4/5" />
                <SkeletonText width="w-1/4" className="h-2.5" />
              </div>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-line bg-panel p-4">
        <h2 className="text-sm font-medium text-ink">Activity</h2>
        <div className="mt-3 text-sm text-danger">
          Couldn&apos;t load activity.{" "}
          <button
            type="button"
            onClick={onRetry}
            className="underline hover:text-ink"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

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
                  {/* Server Component (no "use client") — this never
                      hydrates/re-executes on the client, so a plain
                      `new Date()` here is safe and doesn't need useNow(). */}
                  {relativeTime(activity.createdAt, new Date())}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
