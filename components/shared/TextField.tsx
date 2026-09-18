interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: "text" | "email";
  autoFocus?: boolean;
  /** Renders a <textarea> instead of an <input>. */
  multiline?: boolean;
  rows?: number;
}

const controlClass =
  "rounded-md border border-line bg-panel-raised px-2.5 py-1.5 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-1 focus:ring-signal";

/** Labeled text input, styled to match SelectField/SearchInput. Shared by
 *  every create/edit form (tickets, incidents, services, team invite) —
 *  those were each hand-rolling the same `<label>` + input markup and
 *  the same className string, which just meant four places to keep in
 *  sync instead of one. */
export function TextField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  autoFocus,
  multiline,
  rows = 3,
}: TextFieldProps) {
  return (
    <label className="flex flex-col gap-1 text-xs text-ink-dim">
      {label}
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          className={controlClass}
        />
      ) : (
        <input
          type={type}
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={controlClass}
        />
      )}
    </label>
  );
}
