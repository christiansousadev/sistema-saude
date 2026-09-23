import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
  helpText?: string
  suffix?: ReactNode
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helpText, suffix, id, className = '', ...props }, ref) => {
    const inputId = id ?? `input-${label.toLowerCase().replace(/\s+/g, '-')}`

    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={inputId} className="text-sm font-medium text-slate-300">
          {label}
        </label>

        <div className="relative flex items-center">
          <input
            ref={ref}
            id={inputId}
            className={[
              'min-h-11 w-full rounded-lg border bg-white/[0.03] px-3 py-2.5 text-sm text-slate-100 outline-none transition',
              'placeholder:text-slate-500',
              'focus:border-sky-500/50 focus:ring-2 focus:ring-sky-500/20',
              'disabled:cursor-not-allowed disabled:opacity-60',
              error ? 'border-rose-500/50' : 'border-white/10',
              suffix ? 'pr-10' : '',
              className,
            ]
              .filter(Boolean)
              .join(' ')}
            {...props}
          />
          {suffix && (
            <div className="absolute right-0 flex h-full items-center pr-3">{suffix}</div>
          )}
        </div>

        {error && <p className="text-xs text-rose-400">{error}</p>}
        {helpText && !error && <p className="text-xs text-slate-500">{helpText}</p>}
      </div>
    )
  },
)
Input.displayName = 'Input'
export default Input
