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
        <label
          htmlFor={inputId}
          className="text-sm font-medium text-slate-700 dark:text-slate-300"
        >
          {label}
        </label>

        <div className="relative flex items-center">
          <input
            ref={ref}
            id={inputId}
            className={[
              'w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition',
              'placeholder:text-slate-400',
              'focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20',
              'disabled:cursor-not-allowed disabled:opacity-60',
              'dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500',
              error
                ? 'border-red-400 dark:border-red-500'
                : 'border-slate-300 dark:border-slate-600',
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

        {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}
        {helpText && !error && (
          <p className="text-xs text-slate-500 dark:text-slate-400">{helpText}</p>
        )}
      </div>
    )
  },
)
Input.displayName = 'Input'
export default Input
