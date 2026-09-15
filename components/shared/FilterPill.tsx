interface FilterPillProps {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}

/** The "All / Open / In progress / ..." style filter button used at the top
 *  of every list page (tickets, incidents, services, activity). Pulled out
 *  once it turned out four view components had each defined an identical
 *  copy locally. */
export function FilterPill({ active, onClick, label, count }: FilterPillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "rounded-md px-3 py-1.5 text-xs font-medium text-ink bg-panel-raised"
          : "rounded-md px-3 py-1.5 text-xs text-ink-dim transition-colors hover:text-ink"
      }
    >
      {label} <span className="text-ink-faint">{count}</span>
    </button>
  );
}
