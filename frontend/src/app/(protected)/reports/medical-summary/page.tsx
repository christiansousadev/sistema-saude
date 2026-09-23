'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Dumbbell, FlaskConical, Printer, TriangleAlert } from 'lucide-react'
import { getMedicalSummary } from '@/lib/services/reportService'
import type { MedicalSummaryResponse } from '@/types'
import { extractErrorMessage } from '@/lib/api'
import { formatDateTime, formatDate } from '@/lib/utils'
import Spinner from '@/components/ui/Spinner'
import Button from '@/components/ui/Button'

export default function MedicalSummaryPage() {
  const [report, setReport] = useState<MedicalSummaryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getMedicalSummary()
      .then(setReport)
      .catch((err) => setError(extractErrorMessage(err, 'Erro ao carregar o relatório médico.')))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Spinner size="lg" className="text-sky-400" />
      </div>
    )
  }

  if (error || !report) {
    return (
      <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-6 text-center text-rose-300">
        <p className="font-semibold">{error || 'Relatório não disponível.'}</p>
        <Link
          href="/dashboard"
          className="mt-4 inline-block text-sm font-medium text-sky-400 underline"
        >
          Voltar ao painel
        </Link>
      </div>
    )
  }

  const { patient, physical, clinical } = report

  return (
    <div className="space-y-8 max-w-4xl mx-auto print:max-w-none print:m-0 print:p-0">
      {/* barra de ações (oculta na impressão) */}
      <div className="flex items-center justify-between print:hidden">
        <div>
          <Link
            href="/dashboard"
            className="mb-1 flex items-center gap-1 text-xs font-medium text-slate-500 transition hover:text-slate-200"
          >
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
            Voltar ao painel
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Relatório de saúde consolidado
          </h1>
        </div>
        <Button onClick={() => window.print()} className="flex items-center gap-2 shadow-md">
          <Printer className="h-4 w-4" strokeWidth={2} />
          Imprimir / exportar PDF
        </Button>
      </div>

      {/* documento médico impresso (prontuário consolidado) */}
      {/* fora da impressão: cartão escuro premium. na impressão: fundo branco puro, texto preto de alto contraste */}
      <div className="rounded-3xl border border-white/[0.06] bg-slate-900/60 p-6 sm:p-8 lg:p-12 shadow-lg print:rounded-none print:border-none print:bg-white print:p-0 print:shadow-none text-slate-300 print:text-black space-y-8">
        {/* cabeçalho do prontuário */}
        <div className="flex flex-col gap-4 border-b border-white/[0.06] print:border-slate-300 pb-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-sky-500 text-slate-950 font-bold text-sm print:bg-black print:text-white">
                +
              </span>
              <h2 className="text-xl font-bold text-white print:text-black">
                Sistema Saúde · Prontuário pessoal
              </h2>
            </div>
            <p className="text-xs text-slate-500 print:text-slate-600">
              Relatório consolidado de evolução antropométrica e exames laboratoriais
            </p>
          </div>
          <div className="text-left text-xs text-slate-500 print:text-slate-600 sm:text-right">
            <p>Gerado em: {formatDateTime(report.generated_at)}</p>
            <p className="font-mono text-[10px]">Doc Ref: #{patient.email.slice(0, 6).toUpperCase()}</p>
          </div>
        </div>

        {/* identificação do paciente */}
        <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] print:border-slate-300 print:bg-slate-100/70 p-5">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">
            Dados do paciente
          </h3>
          <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div>
              <span className="block text-xs text-slate-500">Nome completo</span>
              <span className="font-semibold text-white print:text-black">{patient.name}</span>
            </div>
            <div>
              <span className="block text-xs text-slate-500">Idade / nascimento</span>
              <span className="font-semibold text-slate-200 print:text-black">
                {patient.age ? `${patient.age} anos` : '—'}
                {patient.birth_date ? ` (${formatDate(patient.birth_date)})` : ''}
              </span>
            </div>
            <div>
              <span className="block text-xs text-slate-500">Altura</span>
              <span className="font-semibold text-slate-200 print:text-black">
                {patient.height_cm ? `${patient.height_cm} cm` : '—'}
              </span>
            </div>
            <div className="min-w-0">
              <span className="block text-xs text-slate-500">E-mail</span>
              <span className="block truncate font-semibold text-slate-200 print:text-black">{patient.email}</span>
            </div>
          </div>
        </section>

        {/* seção 1: evolução física e composição corporal */}
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-white/[0.06] print:border-slate-300 pb-2">
            <h3 className="flex items-center gap-2 text-base font-bold text-white print:text-black">
              <Dumbbell className="h-4 w-4 text-sky-400 print:hidden" strokeWidth={2} />
              1. Acompanhamento físico & antropométrico
            </h3>
            <span className="text-xs text-slate-500">
              {physical.total_records} medições registradas
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricBox
              label="Peso atual"
              value={physical.latest_weight_kg ? `${physical.latest_weight_kg} kg` : '—'}
              sub={
                physical.delta_weight_kg !== null
                  ? `${physical.delta_weight_kg > 0 ? '+' : ''}${physical.delta_weight_kg} kg desde o início`
                  : undefined
              }
            />
            <MetricBox
              label="IMC atual"
              value={physical.latest_imc ? `${physical.latest_imc}` : '—'}
              sub={physical.imc_classification ?? undefined}
            />
            <MetricBox
              label="% gordura atual"
              value={physical.latest_body_fat_pct ? `${physical.latest_body_fat_pct}%` : '—'}
              sub={
                physical.delta_body_fat_pct !== null
                  ? `${physical.delta_body_fat_pct > 0 ? '+' : ''}${physical.delta_body_fat_pct}% total`
                  : undefined
              }
            />
            <MetricBox
              label="Massa muscular"
              value={physical.latest_muscle_mass_kg ? `${physical.latest_muscle_mass_kg} kg` : '—'}
              sub="Massa magra estimada"
            />
          </div>
        </section>

        {/* seção 2: exames clínicos e biomarcadores mais recentes */}
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-white/[0.06] print:border-slate-300 pb-2">
            <h3 className="flex items-center gap-2 text-base font-bold text-white print:text-black">
              <FlaskConical className="h-4 w-4 text-emerald-400 print:hidden" strokeWidth={2} />
              2. Painel de biomarcadores laboratoriais
            </h3>
            {clinical.latest_exam_date && (
              <span className="text-xs text-slate-500">
                Último laudo: {formatDate(clinical.latest_exam_date)}
              </span>
            )}
          </div>

          {clinical.latest_markers.length === 0 ? (
            <p className="text-sm italic text-slate-500">Nenhum marcador cadastrado nos exames.</p>
          ) : (
            <>
              {/* tabela: telas >= sm e impressão */}
              <div className="hidden overflow-hidden rounded-2xl border border-white/[0.06] print:border-slate-300 sm:block print:block">
                <table className="w-full border-collapse text-left text-xs">
                  <thead className="bg-white/[0.03] print:bg-slate-200 font-bold uppercase tracking-wider text-slate-400 print:text-black">
                    <tr>
                      <th className="p-3">Biomarcador</th>
                      <th className="p-3">Resultado</th>
                      <th className="p-3">Referência</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Variação recente</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06] print:divide-slate-300">
                    {clinical.latest_markers.map((m) => (
                      <tr key={m.name} className="hover:bg-white/[0.02]">
                        <td className="p-3 font-semibold text-slate-100 print:text-black">{m.name}</td>
                        <td className="p-3 font-bold tabular-nums text-slate-200 print:text-black">
                          {m.value} {m.unit}
                        </td>
                        <td className="p-3 text-slate-500">{m.reference_range || '—'}</td>
                        <td className="p-3">
                          <MarkerStatusChip status={m.status} />
                        </td>
                        <td className="p-3 tabular-nums">
                          <MarkerTrend deltaPct={m.delta_pct} trend={m.trend} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* cartões: mobile (< sm), evita quebra horizontal forçada da tabela; some na impressão */}
              <div className="space-y-2 sm:hidden print:hidden">
                {clinical.latest_markers.map((m) => (
                  <div key={m.name} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <span className="font-semibold text-slate-100">{m.name}</span>
                      <MarkerStatusChip status={m.status} />
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span className="font-bold tabular-nums text-slate-200">
                        {m.value} {m.unit}
                      </span>
                      <span className="text-slate-500">ref: {m.reference_range || '—'}</span>
                    </div>
                    <div className="mt-1.5 text-xs">
                      <MarkerTrend deltaPct={m.delta_pct} trend={m.trend} />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        {/* seção 3: alertas e observações clínicas */}
        {clinical.active_alerts.length > 0 && (
          <section className="space-y-2 rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] print:border-amber-400 print:bg-amber-50 p-5">
            <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-300 print:text-amber-900">
              <TriangleAlert className="h-3.5 w-3.5 print:hidden" strokeWidth={2} />
              Marcadores e variações com atenção clínica
            </h4>
            <ul className="space-y-1 text-xs text-amber-200/90 print:text-black">
              {clinical.active_alerts.map((alt, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="font-bold">• {alt.marker} ({alt.value}):</span>
                  <span>{alt.message}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* rodapé e disclaimer médico */}
        <div className="space-y-4 border-t border-white/[0.06] print:border-slate-300 pt-8">
          <p className="text-[11px] italic text-slate-500 print:text-slate-600">
            {report.disclaimer}
          </p>

          <div className="grid grid-cols-1 gap-8 pt-8 sm:grid-cols-2 print:grid">
            <div className="border-t border-slate-600 print:border-slate-300 pt-2 text-center">
              <p className="text-xs font-semibold text-slate-200 print:text-black">{patient.name}</p>
              <p className="text-[10px] text-slate-500">Assinatura do paciente</p>
            </div>
            <div className="border-t border-slate-600 print:border-slate-300 pt-2 text-center">
              <p className="text-xs font-semibold text-slate-200 print:text-black">Médico / nutricionista responsável</p>
              <p className="text-[10px] text-slate-500">Carimbo e CRM/CRN</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function MetricBox({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] print:border-slate-300 print:bg-slate-100/80 p-4">
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</span>
      <p className="mt-1 text-xl font-bold text-white print:text-black">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-slate-500">{sub}</p>}
    </div>
  )
}

function MarkerStatusChip({ status }: { status: string | null }) {
  const styles: Record<string, string> = {
    normal: 'bg-emerald-500/10 text-emerald-300 print:bg-transparent print:text-emerald-700',
    alto: 'bg-rose-500/10 text-rose-300 print:bg-transparent print:text-rose-700',
    baixo: 'bg-amber-500/10 text-amber-300 print:bg-transparent print:text-amber-700',
  }
  const cls = (status && styles[status]) || 'text-slate-500'
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${cls}`}>
      {status ? status.toUpperCase() : 'CONFERIDO'}
    </span>
  )
}

function MarkerTrend({ deltaPct, trend }: { deltaPct: number | null; trend: string | null }) {
  if (deltaPct === null) return <span className="text-slate-500">—</span>
  const cls =
    trend === 'melhora' ? 'text-emerald-400' : trend === 'piora' ? 'text-amber-400' : 'text-slate-500'
  return (
    <span className={`font-semibold ${cls}`}>
      {deltaPct > 0 ? '+' : ''}
      {deltaPct}% ({trend})
    </span>
  )
}
