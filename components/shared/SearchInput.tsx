import { MagnifyingGlassIcon } from "@phosphor-icons/react";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}

/** The search box used at the top of every list page. Same reasoning as
 *  FilterPill — four view components each had an identical copy. */
export function SearchInput({
  value,
  onChange,
  placeholder,
}: SearchInputProps) {
  return (
    <div className="relative w-full sm:w-64">
      <MagnifyingGlassIcon
        size={14}
        className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-line bg-panel-raised py-1.5 pl-8 pr-3 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-1 focus:ring-inset focus:ring-signal"
      />
    </div>
  );
}
