interface AvatarProps {
  initials: string;
  online?: boolean;
  size?: "sm" | "md";
  title?: string;
}

export function Avatar({ initials, online, size = "sm", title }: AvatarProps) {
  const dimensions = size === "sm" ? "size-6 text-[10px]" : "size-8 text-xs";

  return (
    <span className="relative inline-flex shrink-0" title={title}>
      <span
        className={`${dimensions} inline-flex items-center justify-center rounded-full bg-panel-raised text-ink-dim font-medium ring-1 ring-line-strong`}
      >
        {initials}
      </span>
      {online && (
        <span className="absolute -bottom-0.5 -right-0.5 size-2 rounded-full bg-success ring-2 ring-panel" />
      )}
    </span>
  );
}
