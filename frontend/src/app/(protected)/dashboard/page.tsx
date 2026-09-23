'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'

import { useAuth } from '@/contexts/AuthContext'
import { extractErrorMessage } from '@/lib/api'
import { calcImc, formatDate, imcBarPct, imcCategory } from '@/lib/utils'
import * as physicalService from '@/lib/services/physicalService'
import * as clinicalService from '@/lib/services/clinicalService'
import type { ClinicalResponse, PhysicalResponse } from '@/types'
import { Skeleton } from '@/components/ui/Skeleton'
import MetabolicCard from '@/components/ui/MetabolicCard'
import HealthAssistantModal from '@/components/ui/HealthAssistantModal'

// recharts é pesado — carrega só no cliente e fora do bundle inicial do dashboard
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
    <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
      {children}
    </h2>
  )
}

function MetricCard({
  label,
  value,
  unit,
  sub,
  color = '',
  bg = '',
  href,
}: {
  label: string
  value: string
  unit?: string
  sub?: string
  color?: string
  bg?: string
  href: string
}) {
  return (
    <Link
      href={href}
      className="flex flex-col gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm transition hover:shadow-md hover:border-primary-300 dark:hover:border-primary-700"
    >
      <span className="text-xs font-medium uppercase tracking-wider text-slate-400">{label}</span>
      <div className="flex items-end gap-1">
        <span className={`text-3xl font-bold ${color || 'text-slate-800 dark:text-slate-100'}`}>
          {value}
        </span>
        {unit && <span className="mb-1 text-sm text-slate-400">{unit}</span>}
      </div>
      {sub && (
        <span className={`inline-block w-fit rounded-full px-2 py-0.5 text-xs font-medium ${bg} ${color}`}>
          {sub}
        </span>
      )}
    </Link>
  )
}

function ImcScale({ imc }: { imc: number }) {
  const pct = imcBarPct(imc)
  return (
    <div className="space-y-1">
      <div className="relative h-3 overflow-visible rounded-full">
        <div className="flex h-full overflow-hidden rounded-full">
          <div className="w-[14%] bg-blue-200 dark:bg-blue-900" title="Abaixo do peso" />
          <div className="w-[26%] bg-green-300 dark:bg-green-800" title="Peso ideal" />
          <div className="w-[20%] bg-yellow-300 dark:bg-yellow-800" title="Sobrepeso" />
          <div className="w-[40%] bg-red-300 dark:bg-red-900" title="Obesidade" />
        </div>
        <div
          className="absolute -top-0.5 h-4 w-1 rounded-full bg-slate-800 shadow dark:bg-white"
          style={{ left: `${pct}%`, transform: 'translateX(-50%)' }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-slate-400">
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

function clinicalStatus(tests: ClinicalResponse[]): {
  status: SemaphoreStatus
  label: string
  color: string
  dot: string
} {
  if (!tests.length)
    return { status: 'sem_dados', label: 'Sem exames', color: 'text-slate-400', dot: 'bg-slate-300' }

  const latest = tests[0]
  const markers = latest.extracted_data?.markers as Array<{ status: string | null }> | undefined

  if (!markers?.length)
    return { status: 'pendente', label: 'Dados pendentes', color: 'text-yellow-600', dot: 'bg-yellow-400' }

  const abnormal = markers.filter((m) => m.status === 'alto' || m.status === 'baixo').length
  if (!abnormal)
    return { status: 'normal', label: 'Tudo normal', color: 'text-green-600', dot: 'bg-green-500' }
  if (abnormal <= 2)
    return { status: 'atencao', label: `${abnormal} alterado(s)`, color: 'text-yellow-600', dot: 'bg-yellow-400' }
  return { status: 'critico', label: `${abnormal} alterados`, color: 'text-red-600', dot: 'bg-red-500' }
}

// ─── página principal ─────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user } = useAuth()
  const firstName = user?.name.split(' ')[0] ?? ''

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
              <div key={i} className="flex flex-col gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
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
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-[280px] w-full rounded-xl" />
          </section>

          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
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
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Olá, {firstName} 👋
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Aqui está o resumo da sua saúde.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
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
            color={imcInfo?.color}
            bg={imcInfo?.bg}
            href="/physical"
          />
          <MetricCard
            label="Peso"
            value={latest?.weight_kg?.toFixed(1) ?? '—'}
            unit="kg"
            href="/physical"
          />
          <MetricCard
            label="Gordura"
            value={latest?.body_fat_pct?.toFixed(1) ?? '—'}
            unit="%"
            href="/physical"
          />
          {/* semáforo de exames */}
          <Link
            href="/clinical"
            className="flex flex-col gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm transition hover:shadow-md hover:border-primary-300 dark:hover:border-primary-700"
          >
            <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
              Exames
            </span>
            <div className="flex items-center gap-2">
              <span
                className={`h-4 w-4 rounded-full ${semaphore.dot} ring-4 ${
                  semaphore.dot.replace('bg-', 'ring-') + '/30'
                }`}
              />
              <span className={`text-base font-semibold ${semaphore.color}`}>
                {semaphore.label}
              </span>
            </div>
            {clinicals[0] && (
              <span className="text-xs text-slate-400">
                Último: {formatDate(clinicals[0].recorded_at)}
              </span>
            )}
          </Link>
        </div>
      </section>

      {/* escala IMC */}
      {imc && (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
          <SectionLabel>Escala de IMC</SectionLabel>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm text-slate-500">Seu IMC atual</span>
            <span className={`text-lg font-bold ${imcInfo?.color}`}>
              {imc.toFixed(1)} — {imcInfo?.label}
            </span>
          </div>
          <ImcScale imc={imc} />
          <div className="mt-2 flex justify-between text-xs text-slate-400">
            <span className="text-blue-500">Abaixo</span>
            <span className="text-green-600">Ideal</span>
            <span className="text-yellow-600">Sobrepeso</span>
            <span className="text-red-500">Obesidade</span>
          </div>
        </section>
      )}

      {/* Atalhos Rápidos: Relatório Médico & Assistente IA */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          href="/reports/medical-summary"
          className="flex items-center justify-between rounded-2xl border border-primary-100 bg-gradient-to-r from-primary-50 to-indigo-50/40 dark:from-primary-950/20 dark:to-indigo-950/20 p-5 shadow-xs transition hover:shadow-md hover:border-primary-300 dark:border-primary-900/40"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-600 text-white text-lg shadow-sm">
              📄
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                Relatório Médico Completo
              </p>
              <p className="text-xs text-slate-500">
                Gere e imprima seu prontuário em PDF para consultas
              </p>
            </div>
          </div>
          <span className="text-sm font-bold text-primary-600 dark:text-primary-400">→</span>
        </Link>

        <button
          onClick={() => setIsAssistantOpen(true)}
          className="flex items-center justify-between rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50 to-purple-50/40 dark:from-indigo-950/20 dark:to-purple-950/20 p-5 shadow-xs transition hover:shadow-md hover:border-indigo-300 dark:border-indigo-900/40 text-left cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-600 text-white text-lg shadow-sm">
              🤖
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                Assistente de Saúde IA
              </p>
              <p className="text-xs text-slate-500">
                Tire dúvidas sobre seus exames e evolução
              </p>
            </div>
          </div>
          <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">💬</span>
        </button>
      </div>

      {/* Calculadora Metabólica (TMB & TDEE) */}
      <section>
        <SectionLabel>Metabolismo e Calorias</SectionLabel>
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
              className="text-xs font-medium text-primary-600 hover:underline dark:text-primary-400"
            >
              Ver todas →
            </Link>
          </div>
          {physicals.length === 0 ? (
            <EmptyState
              label="Nenhuma medição registrada"
              href="/physical"
              action="Registrar agora"
            />
          ) : (
            <ul className="space-y-2">
              {physicals.slice(0, 5).map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm"
                >
                  <span className="text-slate-500">{formatDate(p.recorded_at)}</span>
                  <div className="flex gap-4 text-right">
                    {p.weight_kg && (
                      <span className="font-medium text-slate-800 dark:text-slate-100">
                        {p.weight_kg.toFixed(1)} <span className="text-xs text-slate-400">kg</span>
                      </span>
                    )}
                    {p.body_fat_pct && (
                      <span className="font-medium text-slate-800 dark:text-slate-100">
                        {p.body_fat_pct.toFixed(1)}
                        <span className="text-xs text-slate-400">%</span>
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
              className="text-xs font-medium text-primary-600 hover:underline dark:text-primary-400"
            >
              Ver todos →
            </Link>
          </div>
          {clinicals.length === 0 ? (
            <EmptyState
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
                    className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
                  >
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-700 dark:text-slate-200">
                        {formatDate(c.recorded_at)}
                      </span>
                      {c.extraction_engine && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-800">
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
                        <div className="flex items-center gap-1">
                          <span className="font-medium text-slate-700 dark:text-slate-300">
                            {m.value} {m.unit}
                          </span>
                          <MarkerDot status={m.status} />
                        </div>
                      </div>
                    ))}
                    {!markers?.length && (
                      <p className="text-xs text-slate-400">Dados não extraídos</p>
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
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
          <div className="mb-1 flex items-center justify-between">
            <SectionLabel>Evolução do IMC e Peso</SectionLabel>
            <Link
              href="/physical"
              className="mb-3 text-xs font-medium text-primary-600 hover:underline dark:text-primary-400"
            >
              Ver detalhes →
            </Link>
          </div>
          <ImcWeightChart records={physicals} heightCm={user?.height_cm ?? null} />
        </section>

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
          <div className="mb-1 flex items-center justify-between">
            <SectionLabel>Perfil Lipídico (Colesterol)</SectionLabel>
            <Link
              href="/clinical"
              className="mb-3 text-xs font-medium text-primary-600 hover:underline dark:text-primary-400"
            >
              Ver detalhes →
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
  if (status === 'normal') return <span className="h-2 w-2 rounded-full bg-green-500" title="Normal" />
  if (status === 'alto') return <span className="h-2 w-2 rounded-full bg-red-500" title="Alto" />
  if (status === 'baixo') return <span className="h-2 w-2 rounded-full bg-yellow-500" title="Baixo" />
  return null
}

function EmptyState({ label, href, action }: { label: string; href: string; action: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 py-8 dark:border-slate-700">
      <p className="text-sm text-slate-400">{label}</p>
      <Link
        href={href}
        className="text-xs font-medium text-primary-600 hover:underline dark:text-primary-400"
      >
        {action} →
      </Link>
    </div>
  )
}
