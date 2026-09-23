import { type ButtonHTMLAttributes } from 'react'
import Spinner from './Spinner'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
}

const variants = {
  primary: 'bg-sky-500 text-white hover:bg-sky-400 active:bg-sky-600',
  secondary: 'border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10',
  ghost: 'text-slate-300 hover:bg-white/5',
  danger: 'bg-rose-500 text-white hover:bg-rose-400 active:bg-rose-600',
}

// alturas mínimas de 44px nos tamanhos usados como ação principal, alvo de toque confortável no mobile
const sizes = {
  sm: 'px-3 py-1.5 text-xs gap-1.5',
  md: 'min-h-11 px-4 py-2.5 text-sm gap-2',
  lg: 'min-h-11 px-5 py-3 text-base gap-2',
}

export default function Button({
  children,
  loading = false,
  variant = 'primary',
  size = 'md',
  disabled,
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={[
        'inline-flex items-center justify-center rounded-lg font-medium transition',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950',
        'disabled:cursor-not-allowed disabled:opacity-60',
        variants[variant],
        sizes[size],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {loading && <Spinner size="sm" />}
      {children}
    </button>
  )
}
