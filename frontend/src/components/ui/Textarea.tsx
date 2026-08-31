import { forwardRef, type TextareaHTMLAttributes } from 'react'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string
  error?: string
  helpText?: string
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, helpText, id, className = '', ...props }, ref) => {
    const areaId = id ?? `textarea-${label.toLowerCase().replace(/\s+/g, '-')}`

    return (
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor={areaId}
          className="text-sm font-medium text-slate-700 dark:text-slate-300"
        >
          {label}
        </label>
        <textarea
          ref={ref}
          id={areaId}
          rows={3}
          className={[
            'w-full resize-y rounded-lg border bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition',
            'placeholder:text-slate-400',
            'focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20',
            'disabled:cursor-not-allowed disabled:opacity-60',
            'dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500',
            error ? 'border-red-400' : 'border-slate-300 dark:border-slate-600',
            className,
          ]
            .filter(Boolean)
            .join(' ')}
          {...props}
        />
        {error && <p className="text-xs text-red-500">{error}</p>}
        {helpText && !error && <p className="text-xs text-slate-500">{helpText}</p>}
      </div>
    )
  },
)
Textarea.displayName = 'Textarea'
export default Textarea
