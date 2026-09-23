'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Activity, ChevronRight, FlaskConical, ShieldCheck, Users2 } from 'lucide-react'

import { useAuth } from '@/contexts/AuthContext'
import { extractErrorMessage } from '@/lib/api'
import { initials } from '@/lib/utils'
import { listUsers } from '@/lib/services/adminService'
import type { AdminUserResponse } from '@/types'
import Spinner from '@/components/ui/Spinner'

// classes literais (nunca construídas em runtime) para o badge do motor ativo
const ENGINE_STYLES: Record<string, string> = {
  llm: 'border-sky-500/20 bg-sky-500/10 text-sky-300',
  local: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
}

function UserAvatar({ name }: { name: string }) {
  return (
    <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-white/10 text-[11px] font-semibold text-slate-200">
      {initials(name)}
    </span>
  )
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${
        active
          ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
          : 'border-rose-500/20 bg-rose-500/10 text-rose-300'
      }`}
    >
      {active ? 'Ativo' : 'Inativo'}
    </span>
  )
}

function EngineBadge({ engine }: { engine: string | null }) {
  const cls = (engine && ENGINE_STYLES[engine]) || 'border-white/10 bg-white/5 text-slate-400'
  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}>
      {engine ? engine.toUpperCase() : 'N/A'}
    </span>
  )
}

export default function AdminPage() {
  const { user } = useAuth()
  const router = useRouter()

  const [users, setUsers] = useState<AdminUserResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (user && !user.is_superadmin) {
      router.replace('/dashboard')
      return
    }

    listUsers()
      .then(setUsers)
      .catch((err) => setError(extractErrorMessage(err, 'Erro ao carregar usuários')))
      .finally(() => setLoading(false))
  }, [user, router])

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="md" className="text-sky-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-slate-300">
          <ShieldCheck className="h-5 w-5" strokeWidth={2} />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Painel superadmin</h1>
          <p className="text-sm text-slate-400">Gerenciamento global de usuários e chaves de API.</p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {error}
        </div>
      )}

      {users.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/10 py-12">
          <Users2 className="h-6 w-6 text-slate-500" strokeWidth={1.5} />
          <p className="text-slate-400">Nenhum usuário encontrado.</p>
        </div>
      ) : (
        <>
          {/* tabela: telas >= sm */}
          <div className="hidden overflow-hidden rounded-2xl border border-white/[0.06] bg-slate-900/60 shadow-sm sm:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-white/[0.06] bg-white/[0.02] text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Usuário</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 text-center font-medium">Exames</th>
                  <th className="px-4 py-3 text-center font-medium">Medições</th>
                  <th className="px-4 py-3 text-center font-medium">Motor atual</th>
                  <th className="px-4 py-3 text-right font-medium">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {users.map((u) => (
                  <tr key={u.id} className="transition hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <UserAvatar name={u.name} />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-100">{u.name}</p>
                          <p className="truncate text-xs text-slate-500">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge active={u.is_active} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-sky-500/10 text-xs font-medium text-sky-300">
                        {u.clinical_count}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/10 text-xs font-medium text-emerald-300">
                        {u.physical_count}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <EngineBadge engine={u.active_engine} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/users/${u.id}`}
                        className="text-sm font-medium text-sky-400 transition hover:text-sky-300"
                      >
                        Gerenciar
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* cartões: mobile (< sm), evita tabela quebrando o layout horizontal */}
          <ul className="space-y-3 sm:hidden">
            {users.map((u) => (
              <li key={u.id}>
                <Link
                  href={`/admin/users/${u.id}`}
                  className="flex min-h-11 items-center gap-3 rounded-2xl border border-white/[0.06] bg-slate-900/60 p-4 shadow-sm transition active:bg-white/[0.02]"
                >
                  <UserAvatar name={u.name} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium text-slate-100">{u.name}</p>
                      <StatusBadge active={u.is_active} />
                    </div>
                    <p className="truncate text-xs text-slate-500">{u.email}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                      <span className="flex items-center gap-1">
                        <FlaskConical className="h-3 w-3" strokeWidth={2} /> {u.clinical_count}
                      </span>
                      <span className="flex items-center gap-1">
                        <Activity className="h-3 w-3" strokeWidth={2} /> {u.physical_count}
                      </span>
                      <EngineBadge engine={u.active_engine} />
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 flex-shrink-0 text-slate-600" strokeWidth={2} />
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
