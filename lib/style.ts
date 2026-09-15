// Tailwind's scanner looks for literal class-name tokens in source text, so
// `text-${color}` would silently fail to generate. These lookup tables keep
// every combination spelled out once, here, instead of interpolated at each
// call site.

export type StatusColor =
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "ink-faint";

export const statusText: Record<StatusColor, string> = {
  info: "text-info",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
  "ink-faint": "text-ink-faint",
};

export const statusDot: Record<StatusColor, string> = {
  info: "bg-info",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  "ink-faint": "bg-ink-faint",
};

export const statusChipBg: Record<StatusColor, string> = {
  info: "bg-info/10",
  success: "bg-success/10",
  warning: "bg-warning/10",
  danger: "bg-danger/10",
  "ink-faint": "bg-ink-faint/10",
};

export const statusBorderLeft: Record<StatusColor, string> = {
  info: "border-l-info",
  success: "border-l-success",
  warning: "border-l-warning",
  danger: "border-l-danger",
  "ink-faint": "border-l-ink-faint",
};

/** "3m ago", "2h ago", "Sep 4" — stable across server and client render. */
export function relativeTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  const diffMs = now.getTime() - then.getTime();
  const diffSec = Math.round(diffMs / 1000);

  if (diffSec < 5) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;

  return then.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function formatErrorRate(rate: number): string {
  return `${rate.toFixed(2)}%`;
}

/** "42m", "3h 20m", "2d 4h" — elapsed time between two instants, used for
 *  "how long has this been open" / "how long did this take to resolve"
 *  framing (README §7: "Is it getting better?"). Coarser than relativeTime
 *  since a duration doesn't need "ago" and rarely needs second-level
 *  precision once it's the length of an incident rather than a timestamp. */
export function formatDuration(startIso: string, endIso: string): string {
  const ms = Math.max(
    0,
    new Date(endIso).getTime() - new Date(startIso).getTime(),
  );
  const totalMin = Math.round(ms / 60_000);

  if (totalMin < 1) return "<1m";
  if (totalMin < 60) return `${totalMin}m`;

  const totalHr = Math.floor(totalMin / 60);
  const remMin = totalMin % 60;
  if (totalHr < 24) {
    return remMin > 0 ? `${totalHr}h ${remMin}m` : `${totalHr}h`;
  }

  const days = Math.floor(totalHr / 24);
  const remHr = totalHr % 24;
  return remHr > 0 ? `${days}d ${remHr}h` : `${days}d`;
}

/** "Today" / "Yesterday" / "Sep 12, 2026" — the day-grouping header a long
 *  activity history is read against, distinct from relativeTime's per-row
 *  "3m ago" since a whole day section only needs to establish itself once. */
export function dayLabel(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  const startOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

  const diffDays = Math.round(
    (startOfDay(now) - startOfDay(then)) / 86_400_000,
  );

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return then.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: then.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}
