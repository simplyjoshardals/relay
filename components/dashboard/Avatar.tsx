interface AvatarProps {
  initials: string;
  /** Stable per-person value (e.g. user.id) used to pick a consistent
   *  color for this person. Omit to always show the neutral initials
   *  fallback — e.g. for "no such person" states like an unassigned
   *  ticket. */
  seed?: string;
  online?: boolean;
  size?: "sm" | "md";
  title?: string;
}

/** Deterministic hue (0–359) from a string — same person always gets the
 *  same color. Doesn't need to be cryptographically strong, just stable
 *  and reasonably spread out; a simple rolling hash is enough. */
function hueFor(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) % 360;
  }
  return hash;
}

/**
 * Colored-initials avatar: a per-person hue (from `seed`) rendered as a
 * dim background + bright same-hued text — the identical "subtle fill,
 * bright foreground of the same hue" treatment status chips already use
 * (statusChipBg/statusText in lib/style.ts), just with a continuous hue
 * rotation instead of a fixed status palette. That makes every avatar in
 * the app sit in the same visual family as every status pill next to it,
 * rather than looking like a separate design language bolted on.
 *
 * This replaces an earlier version that fetched an illustrated DiceBear
 * "critter" mascot per render — cartoonish next to this app's flat,
 * technical chip language, and a live external request for every avatar
 * on the page. This version is fully local: no network call, no
 * third-party asset, computed at render time from data already in hand.
 */
export function Avatar({
  initials,
  seed,
  online,
  size = "sm",
  title,
}: AvatarProps) {
  const dimensions = size === "sm" ? "size-6 text-[10px]" : "size-8 text-xs";
  const hue = seed ? hueFor(seed) : null;

  return (
    <span className="relative inline-flex shrink-0" title={title}>
      <span
        className={`${dimensions} inline-flex items-center justify-center rounded-full font-medium ring-1 ring-line-strong ${
          hue === null ? "bg-panel-raised text-ink-dim" : ""
        }`}
        style={
          hue === null
            ? undefined
            : {
                backgroundColor: `hsl(${hue} 45% 20%)`,
                color: `hsl(${hue} 75% 72%)`,
              }
        }
      >
        {initials}
      </span>

      {online && (
        <span className="absolute -bottom-0.5 -right-0.5 size-2 rounded-full bg-success ring-2 ring-panel" />
      )}
    </span>
  );
}
