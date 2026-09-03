export function CourseFeedbackTextarea({ label, value, onChange, placeholder }: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder: string
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-light">{label}</span>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={2} placeholder={placeholder} className="w-full resize-none rounded-sm border border-border bg-white px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary" />
    </label>
  )
}
