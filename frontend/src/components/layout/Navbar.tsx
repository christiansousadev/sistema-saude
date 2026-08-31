'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import HealthAssistantModal from '@/components/ui/HealthAssistantModal'

export default function Navbar() {
  const { user, logout } = useAuth()
  const [isAssistantOpen, setIsAssistantOpen] = useState(false)

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--surface)]/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          {/* marca */}
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-600 text-white text-xs shadow-xs">
              {/* ícone coração */}
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                <path d="M12 21.593c-.525-.444-9-7.726-9-12.593 0-3.314 2.686-6 6-6 1.858 0 3.509.858 4.627 2.198C14.74 3.692 16.392 3 18 3c3.314 0 6 2.686 6 6 0 4.867-8.475 12.149-9 12.593L12 21.593z" />
              </svg>
            </span>
            <span className="hidden sm:inline">Sistema Saúde</span>
          </Link>

          {/* nav links */}
          <nav className="hidden items-center gap-1 sm:flex">
            <Link
              href="/dashboard"
              className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white transition"
            >
              Painel
            </Link>
            <Link
              href="/physical"
              className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white transition"
            >
              Físico
            </Link>
            <Link
              href="/clinical"
              className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white transition"
            >
              Clínico
            </Link>
            <Link
              href="/reports/medical-summary"
              className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white transition flex items-center gap-1"
            >
              <span>📄</span> Relatório
            </Link>
            {user?.is_superadmin && (
              <Link
                href="/admin"
                className="rounded-md px-3 py-1.5 text-sm font-medium text-purple-600 hover:bg-purple-50 hover:text-purple-700 dark:text-purple-400 dark:hover:bg-purple-900/30 dark:hover:text-purple-300 transition"
              >
                Admin
              </Link>
            )}
          </nav>

          {/* ações do usuário & assistente */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => setIsAssistantOpen(true)}
              className="rounded-lg bg-gradient-to-r from-primary-600 to-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:from-primary-700 hover:to-indigo-700 transition flex items-center gap-1.5"
            >
              <span>🤖</span>
              <span className="hidden sm:inline">Assistente IA</span>
            </button>

            <span className="hidden text-sm text-slate-500 dark:text-slate-400 md:inline">
              {user?.name}
            </span>
            <button
              onClick={logout}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 transition"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      {/* Modal do Assistente */}
      <HealthAssistantModal
        isOpen={isAssistantOpen}
        onClose={() => setIsAssistantOpen(false)}
      />
    </>
  )
}
