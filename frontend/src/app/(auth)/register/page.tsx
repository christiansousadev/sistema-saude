'use client'

import { type FormEvent, useMemo, useState } from 'react'
import Link from 'next/link'
import { Activity } from 'lucide-react'

import { type RegisterPayload, useAuth } from '@/contexts/AuthContext'
import { extractErrorMessage } from '@/lib/api'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
    </svg>
  )
}

interface FormState {
  name: string
  email: string
  password: string
  confirmPassword: string
  height_cm: string
  birth_date: string
}

interface FieldErrors {
  name?: string
  password?: string
  confirmPassword?: string
  height_cm?: string
  birth_date?: string
}

const EMPTY: FormState = {
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
  height_cm: '',
  birth_date: '',
}

export default function RegisterPage() {
  const { register } = useAuth()

  const [form, setForm] = useState<FormState>(EMPTY)
  const [showPassword, setShowPassword] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // limite máximo para data de nascimento = hoje
  const maxBirthDate = useMemo(() => new Date().toISOString().split('T')[0], [])
  // mínimo: 120 anos atrás
  const minBirthDate = useMemo(() => {
    const d = new Date()
    d.setFullYear(d.getFullYear() - 120)
    return d.toISOString().split('T')[0]
  }, [])

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }))
    setFieldErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  function validate(): boolean {
    const errs: FieldErrors = {}

    if (form.name.trim().length < 2) errs.name = 'Nome deve ter ao menos 2 caracteres'
    if (form.password.length < 8) errs.password = 'Senha deve ter ao menos 8 caracteres'
    if (form.password !== form.confirmPassword) errs.confirmPassword = 'As senhas não coincidem'

    const h = Number(form.height_cm)
    if (!form.height_cm || isNaN(h) || h < 50 || h > 300) {
      errs.height_cm = 'Informe uma altura válida entre 50 e 300 cm'
    }

    if (!form.birth_date) {
      errs.birth_date = 'Informe sua data de nascimento'
    } else if (form.birth_date > maxBirthDate) {
      errs.birth_date = 'Data de nascimento não pode ser no futuro'
    }

    setFieldErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!validate()) return

    setLoading(true)
    try {
      const payload: RegisterPayload = {
        name: form.name.trim(),
        email: form.email,
        password: form.password,
        height_cm: form.height_cm ? Number(form.height_cm) : null,
        birth_date: form.birth_date || null,
      }
      await register(payload)
    } catch (err) {
      setError(extractErrorMessage(err, 'erro ao criar conta'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="rounded-2xl border border-white/10 bg-slate-900/80 shadow-2xl backdrop-blur-xl px-8 py-10 space-y-6">

        {/* cabeçalho */}
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-sky-500 text-slate-950 shadow">
            <Activity className="h-6 w-6" strokeWidth={2.5} />
          </div>
          <h1 className="text-xl font-bold text-white">Criar conta</h1>
          <p className="text-sm text-slate-400">Comece a acompanhar sua saúde hoje</p>
        </div>

        {/* formulário */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Nome completo"
            type="text"
            value={form.name}
            onChange={set('name')}
            placeholder="Seu nome"
            autoComplete="name"
            error={fieldErrors.name}
            required
            autoFocus
          />

          <Input
            label="E-mail"
            type="email"
            value={form.email}
            onChange={set('email')}
            placeholder="voce@email.com"
            autoComplete="email"
            required
          />

          <Input
            label="Senha"
            type={showPassword ? 'text' : 'password'}
            value={form.password}
            onChange={set('password')}
            placeholder="Mínimo 8 caracteres"
            autoComplete="new-password"
            error={fieldErrors.password}
            required
            suffix={
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="text-slate-500 hover:text-slate-300 transition"
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              >
                <EyeIcon open={showPassword} />
              </button>
            }
          />

          <Input
            label="Confirmar senha"
            type={showPassword ? 'text' : 'password'}
            value={form.confirmPassword}
            onChange={set('confirmPassword')}
            placeholder="Repita a senha"
            autoComplete="new-password"
            error={fieldErrors.confirmPassword}
            required
          />

          {/* divisor de dados físicos */}
          <div className="flex items-center gap-3 pt-1">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-xs text-slate-500">dados físicos</span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          <Input
            label="Altura"
            type="number"
            value={form.height_cm}
            onChange={set('height_cm')}
            placeholder="170"
            min={50}
            max={300}
            step={1}
            error={fieldErrors.height_cm}
            helpText="em centímetros"
            required
          />

          <Input
            label="Data de nascimento"
            type="date"
            value={form.birth_date}
            onChange={set('birth_date')}
            min={minBirthDate}
            max={maxBirthDate}
            error={fieldErrors.birth_date}
            required
          />

          {error && (
            <div
              role="alert"
              className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300"
            >
              {error}
            </div>
          )}

          <Button type="submit" loading={loading} className="w-full mt-2">
            Criar conta
          </Button>
        </form>

        <p className="text-center text-sm text-slate-400">
          Já tem conta?{' '}
          <Link href="/login" className="font-medium text-sky-400 transition hover:text-sky-300">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  )
}
