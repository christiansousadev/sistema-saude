'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { useAuth } from '@/contexts/AuthContext'
import { listUsers } from '@/lib/services/adminService'
import type { AdminUserResponse } from '@/types'
import Spinner from '@/components/ui/Spinner'

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
      .catch((err) => setError(err.message || 'Erro ao carregar usuários'))
      .finally(() => setLoading(false))
  }, [user, router])

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="md" className="text-primary-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Painel Superadmin
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Gerenciamento global de usuários e chaves de API.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[var(--border)] bg-slate-50 text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3 font-medium">ID</th>
              <th className="px-4 py-3 font-medium">Nome</th>
              <th className="px-4 py-3 font-medium">E-mail</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium text-center">Exames</th>
              <th className="px-4 py-3 font-medium text-center">Medições</th>
              <th className="px-4 py-3 font-medium text-center">Motor Atual</th>
              <th className="px-4 py-3 font-medium text-right">Ação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {users.map((u) => (
              <tr key={u.id} className="transition hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <td className="px-4 py-3 text-slate-500">{u.id}</td>
                <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{u.name}</td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{u.email}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                      u.is_active
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    }`}
                  >
                    {u.is_active ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td className="px-4 py-3 text-center text-slate-600 dark:text-slate-300">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 text-xs font-medium text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                    {u.clinical_count}
                  </span>
                </td>
                <td className="px-4 py-3 text-center text-slate-600 dark:text-slate-300">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-50 text-xs font-medium text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                    {u.physical_count}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-block rounded px-2 py-1 text-xs font-medium ${
                    u.active_engine === 'llm' 
                      ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                      : u.active_engine === 'local'
                        ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                  }`}>
                    {u.active_engine ? u.active_engine.toUpperCase() : 'N/A'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/admin/users/${u.id}`}
                    className="text-sm font-medium text-primary-600 hover:text-primary-700 hover:underline dark:text-primary-400 dark:hover:text-primary-300"
                  >
                    Gerenciar
                  </Link>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                  Nenhum usuário encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
