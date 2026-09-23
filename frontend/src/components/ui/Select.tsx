import { type SelectHTMLAttributes } from 'react'

interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  options: SelectOption[]
  error?: string
  helpText?: string
  placeholder?: string
}

export default function Select({
  label,
  options,
  error,
  helpText,
  placeholder,
  id,
  className = '',
  ...props
}: SelectProps) {
  const selectId = id ?? `select-${label.toLowerCase().replace(/\s+/g, '-')}`

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={selectId} className="text-sm font-medium text-slate-300">
        {label}
      </label>
      <select
        id={selectId}
        className={[
          'min-h-11 w-full rounded-lg border bg-white/[0.03] px-3 py-2.5 text-sm text-slate-100 outline-none transition',
          'focus:border-sky-500/50 focus:ring-2 focus:ring-sky-500/20',
          'disabled:cursor-not-allowed disabled:opacity-60',
          error ? 'border-rose-500/50' : 'border-white/10',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        {...props}
      >
        {placeholder && (
          <option value="" disabled className="bg-slate-900">
            {placeholder}
          </option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled} className="bg-slate-900">
            {opt.label}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-rose-400">{error}</p>}
      {helpText && !error && <p className="text-xs text-slate-500">{helpText}</p>}
    </div>
  )
}
