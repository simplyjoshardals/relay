interface Option {
  value: string;
  label: string;
}

interface SelectFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  disabled?: boolean;
  /** Keep the label for screen readers but don't render it visually —
   *  for compact, row-level uses (e.g. TeamView's per-row role select)
   *  where the row already provides enough visual context. */
  hideLabel?: boolean;
}

/** Labeled `<select>` styled to match SearchInput's input treatment.
 *  Shared by TicketModal and IncidentModal — both need several of these
 *  (status, priority/severity, assignee/responder) and duplicating the
 *  markup per field would drift out of sync fast. */
export function SelectField({
  label,
  value,
  onChange,
  options,
  disabled,
  hideLabel,
}: SelectFieldProps) {
  return (
    <label className="flex flex-col gap-1 text-xs text-ink-dim">
      <span className={hideLabel ? "sr-only" : undefined}>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="rounded-md border border-line bg-panel-raised px-2.5 py-1.5 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-signal disabled:opacity-50"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
