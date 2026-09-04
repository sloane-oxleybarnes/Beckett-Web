export default function RatingQuestion<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value?: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="rounded-sm border border-border bg-white p-3">
      <legend className="px-1 text-sm font-medium leading-snug text-ink">{label}</legend>
      <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-5">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
            className={`min-h-11 rounded-sm border px-2 py-2 text-center text-xs leading-tight transition-colors ${
              value === option.value
                ? "border-primary bg-primary-light font-medium text-primary"
                : "border-border bg-bg text-ink-mid hover:border-primary-mid"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
