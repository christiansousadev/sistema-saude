'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import {
  Activity,
  ArrowRight,
  FileText,
  FlaskConical,
  Scale,
  Sparkles,
} from 'lucide-react'

import { useAuth } from '@/contexts/AuthContext'
import { extractErrorMessage } from '@/lib/api'
import { calcImc, formatDate, imcBarPct, imcCategory } from '@/lib/utils'
import { calculateHealthScore } from '@/lib/healthScore'
import * as physicalService from '@/lib/services/physicalService'
import * as clinicalService from '@/lib/services/clinicalService'
import type { ClinicalResponse, PhysicalResponse } from '@/types'
import { Skeleton } from '@/components/ui/Skeleton'
import MetabolicCard from '@/components/ui/MetabolicCard'
import HealthAssistantModal from '@/components/ui/HealthAssistantModal'
import HealthScoreRing from '@/components/ui/HealthScoreRing'
import HydrationWidget from '@/components/ui/HydrationWidget'

// recharts é pesado, carrega só no cliente e fora do bundle inicial do dashboard
const ImcWeightChart = dynamic(() => import('@/components/charts/ImcWeightChart'), {
  ssr: false,
  loading: () => <Skeleton className="h-64 w-full rounded-2xl" />,
})
const CholesterolChart = dynamic(() => import('@/components/charts/CholesterolChart'), {
  ssr: false,
  loading: () => <Skeleton className="h-64 w-full rounded-2xl" />,
})

// ─── sub-componentes ─────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
      {children}
    </h2>
  )
}

function MetricCard({
  label,
  value,
  unit,
  sub,
  subColor,
  subBg,
  subBorder,
  icon: Icon,
  iconColor,
  href,
}: {
  label: string
  value: string
  unit?: string
  sub?: string
  subColor?: string
  subBg?: string
  subBorder?: string
  icon: typeof Activity
  iconColor?: string
  href: string
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-3 rounded-2xl border border-white/[0.06] bg-slate-900/60 p-5 shadow-sm transition hover:border-white/[0.12]"
    >
      <div className="flex items-start justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</span>
        <span className={`flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.04] ${iconColor ?? 'text-slate-500'}`}>
          <Icon className="h-4 w-4" strokeWidth={2} />
        </span>
      </div>
      <div className="flex items-end gap-1">
        <span className="text-3xl font-bold tracking-tight text-white">{value}</span>
        {unit && <span className="mb-1 text-sm text-slate-500">{unit}</span>}
      </div>
      {sub && (
        <span
          className={`inline-block w-fit rounded-full border px-2.5 py-0.5 text-xs font-medium ${subBg ?? 'bg-white/5'} ${subColor ?? 'text-slate-400'} ${subBorder ?? 'border-white/10'}`}
        >
          {sub}
        </span>
      )}
    </Link>
  )
}

function ImcScale({ imc }: { imc: number }) {
  const pct = imcBarPct(imc)
  return (
    <div className="space-y-1.5">
      <div className="relative h-2.5 overflow-visible rounded-full">
        <div className="flex h-full overflow-hidden rounded-full">
          <div className="w-[14%] bg-sky-500/40" title="Abaixo do peso" />
          <div className="w-[26%] bg-emerald-500/50" title="Peso ideal" />
          <div className="w-[20%] bg-amber-500/50" title="Sobrepeso" />
          <div className="w-[40%] bg-rose-500/40" title="Obesidade" />
        </div>
        <div
          className="absolute -top-1 h-4 w-1 rounded-full bg-white shadow-[0_0_0_3px_rgba(2,6,23,0.8)]"
          style={{ left: `${pct}%`, transform: 'translateX(-50%)' }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-slate-500">
        <span>15</span>
        <span>18.5</span>
        <span>25</span>
        <span>30</span>
        <span>40+</span>
      </div>
    </div>
  )
}

type SemaphoreStatus = 'sem_dados' | 'pendente' | 'normal' | 'atencao' | 'critico'

// classes literais, nunca construídas em runtime: o compilador do tailwind só
// gera css para classes que aparecem escritas por extenso no código-fonte
const SEMAPHORE_STYLES: Record<SemaphoreStatus, { dot: string; ring: string; text: string }> = {
  sem_dados: { dot: 'bg-slate-500', ring: 'ring-slate-500/20', text: 'text-slate-400' },
  pendente: { dot: 'bg-amber-400', ring: 'ring-amber-400/20', text: 'text-amber-300' },
  normal: { dot: 'bg-emerald-400', ring: 'ring-emerald-400/20', text: 'text-emerald-300' },
  atencao: { dot: 'bg-amber-400', ring: 'ring-amber-400/20', text: 'text-amber-300' },
  critico: { dot: 'bg-rose-400', ring: 'ring-rose-400/20', text: 'text-rose-300' },
}

function clinicalStatus(tests: ClinicalResponse[]): { status: SemaphoreStatus; label: string } {
  if (!tests.length) return { status: 'sem_dados', label: 'Sem exames' }

  const latest = tests[0]
  const markers = latest.extracted_data?.markers as Array<{ status: string | null }> | undefined

  if (!markers?.length) return { status: 'pendente', label: 'Dados pendentes' }

  const abnormal = markers.filter((m) => m.status === 'alto' || m.status === 'baixo').length
  if (!abnormal) return { status: 'normal', label: 'Tudo normal' }
  if (abnormal <= 2) return { status: 'atencao', label: `${abnormal} alterado(s)` }
  return { status: 'critico', label: `${abnormal} alterados` }
}

// ─── página principal ─────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user } = useAuth()
  const firstName = user?.name.split(' ')[0] ?? ''

  // data de hoje calculada uma única vez no cliente: lazy initializer evita
  // divergência entre a renderização do servidor e a hidratação no navegador
  const [todayLabel] = useState(() => {
    const raw = new Date().toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
    })
    return raw.charAt(0).toUpperCase() + raw.slice(1)
  })

  const [physicals, setPhysicals] = useState<PhysicalResponse[]>([])
  const [clinicals, setClinicals] = useState<ClinicalResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAssistantOpen, setIsAssistantOpen] = useState(false)

  useEffect(() => {
    Promise.allSettled([
      physicalService.listPhysical(0, 52),  // histórico anual completo para o gráfico
      clinicalService.listClinical(0, 20),  // últimos 20 exames para o gráfico lipídico
    ]).then(([pRes, cRes]) => {
      if (pRes.status === 'fulfilled') setPhysicals(pRes.value.items)
      if (cRes.status === 'fulfilled') setClinicals(cRes.value.items)
      // B-6: exibe erro se QUALQUER uma das requisições falhar (antes: apenas se ambas falhassem)
      if (pRes.status === 'rejected') {
        setError(extractErrorMessage(pRes.reason))
      } else if (cRes.status === 'rejected') {
        setError(extractErrorMessage(cRes.reason))
      }
    }).finally(() => setLoading(false))
  }, [])

  const latest = physicals[0] ?? null
  const imc =
    latest?.weight_kg && user?.height_cm
      ? calcImc(latest.weight_kg, user.height_cm)
      : null
  const imcInfo = imc ? imcCategory(imc) : null
  const semaphore = clinicalStatus(clinicals)
  const semaphoreStyle = SEMAPHORE_STYLES[semaphore.status]
  const healthScore = calculateHealthScore(physicals, clinicals)

  if (loading) {
    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        {/* Skeleton Saudação */}
        <div>
          <Skeleton className="mb-2 h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>

        {/* Skeleton Cards */}
        <section>
          <Skeleton className="mb-3 h-4 w-32" />
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex flex-col gap-2 rounded-2xl border border-white/[0.06] bg-slate-900/60 p-5 shadow-sm">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-8 w-24" />
                <Skeleton className="h-4 w-12" />
              </div>
            ))}
          </div>
        </section>

        {/* Skeleton Listas Recentes */}
        <div className="grid gap-6 lg:grid-cols-2">
          <section>
             <div className="mb-3 flex items-center justify-between">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-16" />
             </div>
             <div className="space-y-2">
               {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}
             </div>
          </section>
          <section>
             <div className="mb-3 flex items-center justify-between">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-16" />
             </div>
             <div className="space-y-2">
               {[1, 2].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
             </div>
          </section>
        </div>

        {/* Skeleton Gráficos */}
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-white/[0.06] bg-slate-900/60 p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-[280px] w-full rounded-xl" />
          </section>

          <section className="rounded-2xl border border-white/[0.06] bg-slate-900/60 p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-[280px] w-full rounded-xl" />
          </section>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* saudação */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Painel de Saúde
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Olá, {firstName} · {todayLabel}
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${semaphoreStyle.text} border-white/10 bg-white/[0.04]`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${semaphoreStyle.dot}`} />
          {semaphore.status === 'normal' || semaphore.status === 'sem_dados'
            ? 'Tudo em dia'
            : 'Requer atenção'}
        </span>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {error}
        </div>
      )}

      {/* cards de métricas */}
      <section>
        <SectionLabel>Últimas medições</SectionLabel>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <MetricCard
            label="IMC"
            value={imc ? imc.toFixed(1) : '—'}
            sub={imcInfo?.label}
            subColor={imcInfo?.color}
            subBg={imcInfo?.bg}
            subBorder={imcInfo?.border}
            icon={Activity}
            iconColor="text-sky-400"
            href="/physical"
          />
          <MetricCard
            label="Peso"
            value={latest?.weight_kg?.toFixed(1) ?? '—'}
            unit="kg"
            icon={Scale}
            iconColor="text-sky-400"
            href="/physical"
          />
          <MetricCard
            label="Gordura corporal"
            value={latest?.body_fat_pct?.toFixed(1) ?? '—'}
            unit="%"
            icon={Activity}
            iconColor="text-sky-400"
            href="/physical"
          />
          {/* semáforo de exames */}
          <Link
            href="/clinical"
            className="flex flex-col gap-3 rounded-2xl border border-white/[0.06] bg-slate-900/60 p-5 shadow-sm transition hover:border-white/[0.12]"
          >
            <div className="flex items-start justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
                Exames
              </span>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.04] text-emerald-400">
                <FlaskConical className="h-4 w-4" strokeWidth={2} />
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`h-3 w-3 rounded-full ${semaphoreStyle.dot} ring-4 ${semaphoreStyle.ring}`} />
              <span className={`text-lg font-bold tracking-tight ${semaphoreStyle.text}`}>
                {semaphore.label}
              </span>
            </div>
            {clinicals[0] && (
              <span className="text-xs text-slate-500">
                Último em {formatDate(clinicals[0].recorded_at)}
              </span>
            )}
          </Link>
        </div>
      </section>

      {/* índice de vitalidade + hidratação diária */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        <section className="flex items-center rounded-2xl border border-white/[0.06] bg-slate-900/60 p-5 shadow-sm">
          <HealthScoreRing score={healthScore.score} level={healthScore.level} label={healthScore.label} />
        </section>
        <HydrationWidget />
      </div>

      {/* escala IMC */}
      {imc && (
        <section className="rounded-2xl border border-white/[0.06] bg-slate-900/60 p-5 shadow-sm">
          <SectionLabel>Escala de IMC</SectionLabel>
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm text-slate-400">Seu IMC atual</span>
            <span className={`text-lg font-bold tracking-tight ${imcInfo?.color}`}>
              {imc.toFixed(1)} <span className="text-slate-500">— {imcInfo?.label}</span>
            </span>
          </div>
          <ImcScale imc={imc} />
          <div className="mt-2 flex justify-between text-xs text-slate-500">
            <span>Abaixo</span>
            <span>Ideal</span>
            <span>Sobrepeso</span>
            <span>Obesidade</span>
          </div>
        </section>
      )}

      {/* Atalhos Rápidos: Relatório Médico & Assistente IA */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link
          href="/reports/medical-summary"
          className="group flex items-center justify-between rounded-2xl border border-white/[0.06] bg-slate-900/60 p-5 shadow-sm transition hover:border-sky-500/30 hover:bg-slate-900"
        >
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-500/10 text-sky-400">
              <FileText className="h-5 w-5" strokeWidth={2} />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">
                Relatório médico completo
              </p>
              <p className="text-xs text-slate-400">
                Gere e imprima seu prontuário em PDF para consultas
              </p>
            </div>
          </div>
          <ArrowRight
            className="h-4 w-4 flex-shrink-0 text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-sky-400"
            strokeWidth={2}
          />
        </Link>

        <button
          onClick={() => setIsAssistantOpen(true)}
          className="group flex items-center justify-between rounded-2xl border border-white/[0.06] bg-slate-900/60 p-5 text-left shadow-sm transition hover:border-emerald-500/30 hover:bg-slate-900"
        >
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
              <Sparkles className="h-5 w-5" strokeWidth={2} />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">
                Assistente de saúde IA
              </p>
              <p className="text-xs text-slate-400">
                Tire dúvidas sobre seus exames e evolução
              </p>
            </div>
          </div>
          <ArrowRight
            className="h-4 w-4 flex-shrink-0 text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-emerald-400"
            strokeWidth={2}
          />
        </button>
      </div>

      {/* Calculadora Metabólica (TMB & TDEE) */}
      <section>
        <SectionLabel>Metabolismo e calorias</SectionLabel>
        <MetabolicCard
          weightKg={latest?.weight_kg ?? null}
          heightCm={user?.height_cm ?? null}
          birthDate={user?.birth_date ?? null}
        />
      </section>

      {/* histórico recente */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* medições físicas */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <SectionLabel>Últimas medições físicas</SectionLabel>
            <Link
              href="/physical"
              className="text-xs font-medium text-sky-400 transition hover:text-sky-300"
            >
              Ver todas
            </Link>
          </div>
          {physicals.length === 0 ? (
            <EmptyState
              icon={Scale}
              label="Nenhuma medição registrada"
              href="/physical"
              action="Registrar agora"
            />
          ) : (
            <ul className="space-y-2">
              {physicals.slice(0, 5).map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-slate-900/60 px-4 py-3 text-sm"
                >
                  <span className="text-slate-400">{formatDate(p.recorded_at)}</span>
                  <div className="flex gap-4 text-right">
                    {p.weight_kg && (
                      <span className="font-medium text-white">
                        {p.weight_kg.toFixed(1)} <span className="text-xs text-slate-500">kg</span>
                      </span>
                    )}
                    {p.body_fat_pct && (
                      <span className="font-medium text-white">
                        {p.body_fat_pct.toFixed(1)}
                        <span className="text-xs text-slate-500">%</span>
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* exames clínicos */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <SectionLabel>Últimos exames clínicos</SectionLabel>
            <Link
              href="/clinical"
              className="text-xs font-medium text-sky-400 transition hover:text-sky-300"
            >
              Ver todos
            </Link>
          </div>
          {clinicals.length === 0 ? (
            <EmptyState
              icon={FlaskConical}
              label="Nenhum exame cadastrado"
              href="/clinical"
              action="Adicionar exame"
            />
          ) : (
            <ul className="space-y-2">
              {clinicals.slice(0, 3).map((c) => {
                const markers = c.extracted_data?.markers as
                  | Array<{ name: string; value: string | number; unit: string; status: string | null }>
                  | undefined
                return (
                  <li
                    key={c.id}
                    className="rounded-xl border border-white/[0.06] bg-slate-900/60 px-4 py-3"
                  >
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-300">
                        {formatDate(c.recorded_at)}
                      </span>
                      {c.extraction_engine && (
                        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-slate-400">
                          {c.extraction_engine}
                        </span>
                      )}
                    </div>
                    {markers?.slice(0, 3).map((m) => (
                      <div
                        key={m.name}
                        className="flex items-center justify-between py-0.5 text-xs"
                      >
                        <span className="text-slate-500">{m.name}</span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-slate-300">
                            {m.value} {m.unit}
                          </span>
                          <MarkerDot status={m.status} />
                        </div>
                      </div>
                    ))}
                    {!markers?.length && (
                      <p className="text-xs text-slate-500">Dados não extraídos</p>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>

      {/* gráficos de evolução */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-white/[0.06] bg-slate-900/60 p-5 shadow-sm">
          <div className="mb-1 flex items-center justify-between">
            <SectionLabel>Evolução do IMC e peso</SectionLabel>
            <Link
              href="/physical"
              className="mb-3 text-xs font-medium text-sky-400 transition hover:text-sky-300"
            >
              Ver detalhes
            </Link>
          </div>
          <ImcWeightChart records={physicals} heightCm={user?.height_cm ?? null} />
        </section>

        <section className="rounded-2xl border border-white/[0.06] bg-slate-900/60 p-5 shadow-sm">
          <div className="mb-1 flex items-center justify-between">
            <SectionLabel>Perfil lipídico (colesterol)</SectionLabel>
            <Link
              href="/clinical"
              className="mb-3 text-xs font-medium text-sky-400 transition hover:text-sky-300"
            >
              Ver detalhes
            </Link>
          </div>
          <CholesterolChart records={clinicals} />
        </section>
      </div>

      {/* Modal do Assistente de Saúde IA */}
      <HealthAssistantModal
        isOpen={isAssistantOpen}
        onClose={() => setIsAssistantOpen(false)}
      />
    </div>
  )
}

function MarkerDot({ status }: { status: string | null | undefined }) {
  if (status === 'normal') return <span className="h-2 w-2 rounded-full bg-emerald-400" title="Normal" />
  if (status === 'alto') return <span className="h-2 w-2 rounded-full bg-rose-400" title="Alto" />
  if (status === 'baixo') return <span className="h-2 w-2 rounded-full bg-amber-400" title="Baixo" />
  return null
}

function EmptyState({
  icon: Icon,
  label,
  href,
  action,
}: {
  icon: typeof Activity
  label: string
  href: string
  action: string
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2.5 rounded-xl border border-dashed border-white/10 py-8">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.04] text-slate-500">
        <Icon className="h-4 w-4" strokeWidth={2} />
      </span>
      <p className="text-sm text-slate-500">{label}</p>
      <Link
        href={href}
        className="text-xs font-medium text-sky-400 transition hover:text-sky-300"
      >
        {action} →
      </Link>
    </div>
  )
}
