'use client'

import { useEffect, useState } from 'react'
import {
  Check,
  Clock,
  Copy,
  ExternalLink,
  Eye,
  Link as LinkIcon,
  Lock,
  Plus,
  ShieldCheck,
  Stethoscope,
  Trash2,
  X,
} from 'lucide-react'

import * as doctorShareService from '@/lib/services/doctorShareService'
import type { DoctorShareResponse } from '@/types'
import { formatDate, formatDateTime } from '@/lib/utils'

interface DoctorShareModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function DoctorShareModal({ isOpen, onClose }: DoctorShareModalProps) {
  const [tokens, setTokens] = useState<DoctorShareResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [copiedToken, setCopiedToken] = useState<string | null>(null)

  const [recipientName, setRecipientName] = useState('')
  const [expiresInHours, setExpiresInHours] = useState<number>(48)
  const [pin, setPin] = useState('')

  async function loadTokens() {
    try {
      const data = await doctorShareService.listShareTokens()
      setTokens(data.items)
    } catch {
      // erro silencioso
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      loadTokens()
    }
  }, [isOpen])

  if (!isOpen) return null

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault()
    setGenerating(true)
    try {
      const newShare = await doctorShareService.generateShareToken({
        recipient_name: recipientName.trim() || null,
        expires_in_hours: expiresInHours,
        pin: pin.trim() || null,
      })
      setTokens((prev) => [newShare, ...prev])
      setRecipientName('')
      setPin('')
      handleCopy(newShare.token)
    } catch {
      // erro ao gerar
    } finally {
      setGenerating(false)
    }
  }

  async function handleRevoke(id: number) {
    if (!confirm('Deseja realmente revogar este link? O médico perderá acesso imediatamente.')) return
    try {
      const updated = await doctorShareService.revokeShareToken(id)
      setTokens((prev) =>
        prev.map((t) => (t.id === id ? { ...t, is_active: false } : t))
      )
    } catch {
      // erro ao revogar
    }
  }

  function getShareUrl(token: string) {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/share/${token}`
    }
    return `/share/${token}`
  }

  function handleCopy(token: string) {
    const url = getShareUrl(token)
    navigator.clipboard.writeText(url)
    setCopiedToken(token)
    setTimeout(() => setCopiedToken(null), 3000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-sky-500/20 bg-slate-900 p-6 sm:p-8 shadow-2xl">
        {/* botao fechar */}
        <button
          onClick={onClose}
          className="absolute right-5 top-5 rounded-xl p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>

        {/* cabecalho */}
        <div className="flex items-center gap-3 mb-6">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-400 ring-1 ring-sky-500/20">
            <Stethoscope className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">
              Acesso Temporário para Médicos
            </h2>
            <p className="text-xs text-slate-400">
              Compartilhe seu prontuário consolidado com total segurança e prazo de expiração
            </p>
          </div>
        </div>

        {/* aviso de seguranca */}
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-sky-500/20 bg-sky-500/5 p-4 text-xs text-slate-300">
          <ShieldCheck className="h-5 w-5 flex-shrink-0 text-sky-400 mt-0.5" />
          <div>
            <p className="font-semibold text-white">Privacidade e Controle em Suas Mãos</p>
            <p className="text-slate-400 mt-0.5 leading-relaxed">
              O profissional terá acesso somente-leitura ao seu resumo de saúde, sem permissão para
              alterar seus dados ou acessar senhas. Você pode revogar o link a qualquer momento.
            </p>
          </div>
        </div>

        {/* formulario de geracao */}
        <form
          onSubmit={handleGenerate}
          className="mb-6 rounded-2xl border border-white/[0.06] bg-slate-950/50 p-4 space-y-3"
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Nome do médico / clínica (opcional)
              </label>
              <input
                type="text"
                placeholder="Ex: Dra. Mariana (Endócrino)"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-sky-400 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Prazo de validade
              </label>
              <select
                value={expiresInHours}
                onChange={(e) => setExpiresInHours(Number(e.target.value))}
                className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-xs text-white focus:border-sky-400 focus:outline-none"
              >
                <option value={24}>24 horas (1 dia)</option>
                <option value={48}>48 horas (2 dias)</option>
                <option value={72}>72 horas (3 dias)</option>
                <option value={168}>7 dias (1 semana)</option>
                <option value={720}>30 dias (1 mês)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                PIN de Proteção (opcional)
              </label>
              <input
                type="password"
                maxLength={8}
                placeholder="Ex: 4 a 8 dígitos"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-sky-400 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={generating}
              className="inline-flex items-center gap-1.5 rounded-xl bg-sky-500 px-4 py-2 text-xs font-bold text-slate-950 shadow-md transition hover:bg-sky-400 disabled:opacity-50"
            >
              <LinkIcon className="h-3.5 w-3.5" />
              <span>{generating ? 'Gerando link seguro...' : 'Gerar Link e Copiar'}</span>
            </button>
          </div>
        </form>

        {/* lista de links ativos */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
            Links Gerados ({tokens.length})
          </h3>

          <div className="max-h-56 overflow-y-auto space-y-2.5 pr-1">
            {tokens.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-4">
                Nenhum link de acesso ativo no momento.
              </p>
            ) : (
              tokens.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-center justify-between gap-3 rounded-2xl border p-3 text-xs transition ${
                    item.is_active
                      ? 'border-white/[0.06] bg-slate-950/40'
                      : 'border-white/[0.02] bg-slate-950/20 opacity-50'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          item.is_active ? 'bg-emerald-400' : 'bg-slate-600'
                        }`}
                      />
                      <span className="font-semibold text-white truncate">
                        {item.recipient_name || 'Link Geral'}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        ({item.access_count} acessos)
                      </span>
                      {item.has_pin && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 text-[9px] font-semibold text-amber-300">
                          <Lock className="h-2.5 w-2.5" /> PIN
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {item.is_active
                          ? `Expira em ${formatDateTime(item.expires_at)}`
                          : 'Expirado / Revogado'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {item.is_active && (
                      <>
                        <button
                          onClick={() => handleCopy(item.token)}
                          title="Copiar link"
                          className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-white/10"
                        >
                          {copiedToken === item.token ? (
                            <>
                              <Check className="h-3.5 w-3.5 text-emerald-400" />
                              <span className="text-emerald-400 font-bold">Copiado!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-3.5 w-3.5" />
                              <span>Copiar</span>
                            </>
                          )}
                        </button>

                        <a
                          href={getShareUrl(item.token)}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Abrir pré-visualização"
                          className="rounded-lg p-1.5 text-slate-400 hover:text-white transition hover:bg-white/5"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>

                        <button
                          onClick={() => handleRevoke(item.id)}
                          title="Revogar link imediatamente"
                          className="rounded-lg p-1.5 text-rose-400 hover:text-rose-300 transition hover:bg-rose-500/10"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
