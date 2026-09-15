interface AvatarProps {
  initials: string;
  /** Stable per-person value (e.g. user.id) used to generate a consistent
   *  avatar image. Omit to always show the initials fallback — e.g. for
   *  "no such person" states like an unassigned ticket. */
  seed?: string;
  online?: boolean;
  size?: "sm" | "md";
  title?: string;
}

/** Deterministic, seed-based generated avatar (DiceBear "glass" set) so the
 *  same person always gets the same image without storing or hosting real
 *  photos — there are no real photos for these mock/demo people to begin
 *  with. Swap this one line for a real `user.avatarUrl` when accounts have
 *  actual uploaded photos; the initials fallback stays either way. */
function avatarUrlFor(seed: string) {
  return `https://api.dicebear.com/10.x/critters/svg?seed=${encodeURIComponent(seed)}`;
}

export function Avatar({
  initials,
  seed,
  online,
  size = "sm",
  title,
}: AvatarProps) {
  const dimensions = size === "sm" ? "size-6 text-[10px]" : "size-8 text-xs";

  return (
    <span className="relative inline-flex shrink-0" title={title}>
      {seed ? (
        // Plain <img>, not next/image: these are third-party SVGs generated
        // per-render from an external API, not local/optimizable assets.
        <img
          src={avatarUrlFor(seed)}
          alt={title ?? initials}
          className={`${dimensions} rounded-full bg-panel-raised object-cover ring-1 ring-line-strong`}
        />
      ) : (
        <span
          className={`${dimensions} inline-flex items-center justify-center rounded-full bg-panel-raised text-ink-dim font-medium ring-1 ring-line-strong`}
        >
          {initials}
        </span>
      )}
      {online && (
        <span className="absolute -bottom-0.5 -right-0.5 size-2 rounded-full bg-success ring-2 ring-panel" />
      )}
    </span>
  );
}
