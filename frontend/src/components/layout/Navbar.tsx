'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Activity,
  FileText,
  FlaskConical,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { initials } from '@/lib/utils'
import HealthAssistantModal from '@/components/ui/HealthAssistantModal'

// links de navegação compartilhados entre a barra desktop e o menu mobile
const NAV_LINKS = [
  { href: '/dashboard', label: 'Painel', icon: LayoutDashboard },
  { href: '/physical', label: 'Físico', icon: Activity },
  { href: '/clinical', label: 'Clínico', icon: FlaskConical },
  { href: '/reports/medical-summary', label: 'Relatório', icon: FileText },
  { href: '/settings', label: 'Configurações', icon: Settings },
]

export default function Navbar() {
  const { user, logout } = useAuth()
  const [isAssistantOpen, setIsAssistantOpen] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  return (
    <>
      {/* padding-top soma a área do notch/status bar quando instalado como pwa standalone */}
      <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-slate-950/90 backdrop-blur-md pt-[env(safe-area-inset-top,0px)]">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          {/* marca */}
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold text-white">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-sky-500 text-slate-950 shadow-[0_0_0_1px_rgba(255,255,255,0.08)]">
              <Activity className="h-4 w-4" strokeWidth={2.5} />
            </span>
            <span className="hidden tracking-tight sm:inline">Sistema Saúde</span>
          </Link>

          {/* nav links (desktop) */}
          <nav className="hidden items-center gap-1 sm:flex">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-slate-400 transition-colors hover:text-white"
              >
                <link.icon className="h-3.5 w-3.5" strokeWidth={2} />
                {link.label}
              </Link>
            ))}
            {user?.is_superadmin && (
              <Link
                href="/admin"
                className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-slate-400 transition-colors hover:text-white"
              >
                <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2} />
                Admin
                <span className="rounded-full bg-white/10 px-1.5 py-px text-[9px] font-bold tracking-widest text-slate-400">
                  ADMIN
                </span>
              </Link>
            )}
          </nav>

          {/* ações do usuário & assistente */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => setIsAssistantOpen(true)}
              className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-slate-200 transition hover:border-white/20 hover:bg-white/10"
            >
              <Sparkles className="h-3.5 w-3.5 text-emerald-400" strokeWidth={2} />
              <span className="hidden sm:inline">Assistente</span>
            </button>

            <div className="hidden items-center gap-2 md:flex">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-[11px] font-semibold text-slate-200">
                {initials(user?.name)}
              </span>
              <span className="text-sm text-slate-300">{user?.name}</span>
            </div>

            <button
              onClick={logout}
              aria-label="Sair"
              className="hidden items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-slate-400 transition hover:bg-white/5 hover:text-white sm:flex"
            >
              <LogOut className="h-4 w-4" strokeWidth={2} />
            </button>

            {/* botão hambúrguer, visível só em mobile: sem ele a navbar não tem como navegar em telas pequenas */}
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen((v) => !v)}
              className="flex h-11 w-11 items-center justify-center rounded-lg border border-white/10 text-slate-300 transition hover:bg-white/5 sm:hidden"
              aria-label={isMobileMenuOpen ? 'Fechar menu' : 'Abrir menu'}
              aria-expanded={isMobileMenuOpen}
            >
              {isMobileMenuOpen ? (
                <X className="h-5 w-5" strokeWidth={2} />
              ) : (
                <Menu className="h-5 w-5" strokeWidth={2} />
              )}
            </button>
          </div>
        </div>

        {/* gaveta de navegação (mobile) */}
        {isMobileMenuOpen && (
          <nav className="flex flex-col gap-1 border-t border-white/[0.06] px-4 py-3 sm:hidden">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex min-h-11 items-center gap-2.5 rounded-md px-3 text-sm text-slate-300 transition hover:bg-white/5 hover:text-white"
              >
                <link.icon className="h-4 w-4" strokeWidth={2} />
                {link.label}
              </Link>
            ))}
            {user?.is_superadmin && (
              <Link
                href="/admin"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex min-h-11 items-center gap-2.5 rounded-md px-3 text-sm text-slate-300 transition hover:bg-white/5 hover:text-white"
              >
                <ShieldCheck className="h-4 w-4" strokeWidth={2} />
                Admin
                <span className="rounded-full bg-white/10 px-1.5 py-px text-[9px] font-bold tracking-widest text-slate-400">
                  ADMIN
                </span>
              </Link>
            )}
            <button
              onClick={() => {
                setIsMobileMenuOpen(false)
                logout()
              }}
              className="mt-1 flex min-h-11 items-center gap-2.5 rounded-md border border-white/10 px-3 text-left text-sm text-slate-300 transition hover:bg-white/5"
            >
              <LogOut className="h-4 w-4" strokeWidth={2} />
              Sair
            </button>
          </nav>
        )}
      </header>

      {/* Modal do Assistente */}
      <HealthAssistantModal
        isOpen={isAssistantOpen}
        onClose={() => setIsAssistantOpen(false)}
      />
    </>
  )
}
