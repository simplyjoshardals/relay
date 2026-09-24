/**
 * Shared loading-placeholder primitives (Milestone 9). The dashboard is
 * the first consumer — every panel (StatRow, IncidentsPanel,
 * ServiceHealthGrid, TicketBoard, ActivityFeed, PresenceRail) renders
 * one of these, shaped like its own content, while its query is still
 * `isLoading` — instead of a plain "Loading…" line.
 *
 * Deliberately just three small building blocks rather than one
 * skeleton per screen shape: every future loading state (tickets list,
 * incidents list, services grid, activity feed, etc. — see
 * BACKEND_ROADMAP.md's Milestone 9 note) should compose these the same
 * way the dashboard panels below do, not add a new one-off component.
 */

interface SkeletonProps {
  /** Extra classes — width/height, margins, rounding overrides. */
  className?: string;
}

/** The base shimmering block. Every other skeleton shape is this with a
 *  size and border-radius applied via `className`. */
export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-md bg-line-strong ${className}`}
    />
  );
}

interface SkeletonCircleProps extends SkeletonProps {
  /** Tailwind size utility, e.g. "size-6" (Avatar's "sm") or "size-8"
   *  ("md"). Matches Avatar's own sizing so a skeleton avatar lines up
   *  exactly with the real one that replaces it. */
  size?: string;
}

/** Avatar-shaped placeholder. */
export function SkeletonCircle({
  size = "size-6",
  className = "",
}: SkeletonCircleProps) {
  return <Skeleton className={`${size} shrink-0 rounded-full ${className}`} />;
}

interface SkeletonTextProps extends SkeletonProps {
  /** Tailwind width utility, e.g. "w-24", "w-full". */
  width?: string;
}

/** A single line-of-text placeholder. */
export function SkeletonText({
  width = "w-full",
  className = "",
}: SkeletonTextProps) {
  return <Skeleton className={`h-3 ${width} ${className}`} />;
}
