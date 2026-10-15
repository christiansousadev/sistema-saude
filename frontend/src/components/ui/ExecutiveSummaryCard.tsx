'use client'

import { useEffect, useState } from 'react'
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Droplets,
  Flame,
  ListTodo,
  RotateCw,
  Scale,
  Sparkles,
  Stethoscope,
} from 'lucide-react'

import { getExecutiveSummary } from '@/lib/services/assistantService'
import type { ExecutiveSummaryResponse } from '@/types'
import { Skeleton } from '@/components/ui/Skeleton'

const STATUS_CONFIG = {
  otimo: {
    bg: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300',
    dot: 'bg-emerald-400',
    label: 'Excelente',
  },
  estavel: {
    bg: 'bg-sky-500/10 border-sky-500/20 text-sky-300',
    dot: 'bg-sky-400',
    label: 'Estável',
  },
  atencao: {
    bg: 'bg-amber-500/10 border-amber-500/20 text-amber-300',
    dot: 'bg-amber-400',
    label: 'Atenção Requerida',
  },
}

interface ExecutiveSummaryCardProps {
  onOpenQuestions?: () => void
}

export default function ExecutiveSummaryCard({ onOpenQuestions }: ExecutiveSummaryCardProps = {}) {
  const [summary, setSummary] = useState<ExecutiveSummaryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState<'geral' | 'acao'>('geral')

  async function loadSummary(isRefresh = false) {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)

    try {
      const data = await getExecutiveSummary()
      setSummary(data)
    } catch {
      // falha silenciosa em caso de offline
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadSummary()
  }, [])

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/[0.06] bg-slate-900/60 p-6 shadow-sm backdrop-blur-sm">
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-6 w-52 rounded-lg" />
          <Skeleton className="h-6 w-24 rounded-full" />
        </div>
        <Skeleton className="h-14 w-full rounded-xl mb-3" />
        <Skeleton className="h-20 w-full rounded-xl" />
      </div>
    )
  }

  if (!summary) return null

  const statusInfo = STATUS_CONFIG[summary.overall_status] || STATUS_CONFIG.estavel

  return (
    <div className="relative overflow-hidden rounded-3xl border border-sky-500/20 bg-gradient-to-br from-slate-900/90 via-slate-900/60 to-sky-950/20 p-6 shadow-xl backdrop-blur-md">
      {/* efeito de brilho sutil */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-sky-500/10 blur-3xl" />

      {/* cabeçalho */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-500/10 text-sky-400 ring-1 ring-sky-500/20">
            <Sparkles className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-sky-400">
              Resumo Executivo de Saúde por IA
            </h2>
            <p className="text-xs text-slate-400">Síntese unificada física, clínica e comportamental</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onOpenQuestions && (
            <button
              onClick={onOpenQuestions}
              className="inline-flex items-center gap-1.5 rounded-xl border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 text-xs font-medium text-sky-300 transition hover:bg-sky-500/20"
            >
              <Stethoscope className="h-3.5 w-3.5" />
              <span>Perguntas p/ Consulta</span>
            </button>
          )}
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${statusInfo.bg}`}>
            <span className={`h-2 w-2 rounded-full ${statusInfo.dot}`} />
            {statusInfo.label}
          </span>
          <button
            onClick={() => loadSummary(true)}
            disabled={refreshing}
            title="Recalcular resumo"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/5 hover:text-white disabled:opacity-50"
          >
            <RotateCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* manchete */}
      <div className="mt-4 rounded-2xl border border-white/[0.04] bg-white/[0.02] p-4">
        <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
          "{summary.summary_headline}"
        </h3>
      </div>

      {/* seletor de visualização */}
      <div className="mt-4 flex gap-2 border-b border-white/[0.06] pb-2 text-xs">
        <button
          onClick={() => setActiveTab('geral')}
          className={`pb-1 font-semibold transition ${
            activeTab === 'geral'
              ? 'border-b-2 border-sky-400 text-sky-300'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Visão Geral por Domínio
        </button>
        <button
          onClick={() => setActiveTab('acao')}
          className={`pb-1 font-semibold transition ${
            activeTab === 'acao'
              ? 'border-b-2 border-sky-400 text-sky-300'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Plano de Ação Semanal ({summary.action_plan.length})
        </button>
      </div>

      {activeTab === 'geral' ? (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Físico */}
          <div className="rounded-2xl border border-white/[0.04] bg-slate-900/50 p-4">
            <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
              <Scale className="h-4 w-4 text-sky-400" /> Evolução Física
            </div>
            <p className="text-xs leading-relaxed text-slate-300">
              {summary.physical_insights}
            </p>
          </div>

          {/* Clínico */}
          <div className="rounded-2xl border border-white/[0.04] bg-slate-900/50 p-4">
            <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
              <Activity className="h-4 w-4 text-emerald-400" /> Marcadores Clínicos
            </div>
            <p className="text-xs leading-relaxed text-slate-300">
              {summary.clinical_insights}
            </p>
          </div>

          {/* Hábitos */}
          <div className="rounded-2xl border border-white/[0.04] bg-slate-900/50 p-4">
            <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
              <Droplets className="h-4 w-4 text-blue-400" /> Hidratação & Hábitos
            </div>
            <p className="text-xs leading-relaxed text-slate-300">
              {summary.habits_insights}
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-white/[0.04] bg-slate-900/50 p-4 space-y-2.5">
          {summary.action_plan.map((action, idx) => (
            <div key={idx} className="flex items-start gap-2.5 text-xs text-slate-300">
              <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-400 mt-0.5" />
              <span>{action}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
