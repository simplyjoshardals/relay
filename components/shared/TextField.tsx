interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: "text" | "email" | "password";
  autoFocus?: boolean;
  /** Renders a <textarea> instead of an <input>. */
  multiline?: boolean;
  rows?: number;
  /** HTML `name` attribute — needed when this field's value should be
   *  readable via `FormData` on submit (e.g. a Server Action), rather
   *  than only through the controlled `value`/`onChange` pair. */
  name?: string;
}

const controlClass =
  "rounded-md border border-line bg-panel-raised px-2.5 py-1.5 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-1 focus:ring-inset focus:ring-signal";

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
  name,
}: TextFieldProps) {
  return (
    <label className="flex flex-col gap-1 text-xs text-ink-dim">
      {label}
      {multiline ? (
        <textarea
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          className={controlClass}
        />
      ) : (
        <input
          type={type}
          name={name}
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
