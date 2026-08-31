'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getMedicalSummary } from '@/lib/services/reportService'
import type { MedicalSummaryResponse } from '@/types'
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
      .catch((err) => {
        setError(err.response?.data?.detail || 'Erro ao carregar o relatório médico.')
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Spinner size="lg" className="text-primary-600" />
      </div>
    )
  }

  if (error || !report) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-red-600 dark:border-red-900/50 dark:bg-red-900/20">
        <p className="font-semibold">{error || 'Relatório não disponível.'}</p>
        <Link
          href="/dashboard"
          className="mt-4 inline-block text-sm font-medium text-primary-600 underline"
        >
          Voltar ao Painel
        </Link>
      </div>
    )
  }

  const { patient, physical, clinical } = report

  return (
    <div className="space-y-8 max-w-4xl mx-auto print:max-w-none print:m-0 print:p-0">
      {/* Barra de Ações (Oculta na Impressão) */}
      <div className="flex items-center justify-between print:hidden">
        <div>
          <Link
            href="/dashboard"
            className="text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1 mb-1"
          >
            ← Voltar ao Painel
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Relatório de Saúde Consolidado
          </h1>
        </div>
        <div className="flex gap-3">
          <Button onClick={() => window.print()} className="flex items-center gap-2 shadow-md">
            <span>🖨️</span> Imprimir / Salvar em PDF
          </Button>
        </div>
      </div>

      {/* DOCUMENTO MÉDICO IMPRESSO (Prontuário Consolidado) */}
      <div className="rounded-3xl border border-slate-200 bg-white p-8 sm:p-12 shadow-lg dark:border-slate-800 dark:bg-slate-900 print:border-none print:shadow-none print:p-0 print:bg-white print:text-slate-900 text-slate-800 dark:text-slate-200 space-y-8">
        {/* Cabeçalho do Prontuário */}
        <div className="border-b border-slate-200 dark:border-slate-800 print:border-slate-300 pb-6 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600 text-white font-bold text-sm">
                +
              </span>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white print:text-black">
                SISTEMA SAÚDE · PRONTUÁRIO PESSOAL
              </h2>
            </div>
            <p className="text-xs text-slate-500 print:text-slate-600">
              Relatório consolidado de evolução antropométrica e exames laboratoriais
            </p>
          </div>
          <div className="text-right text-xs text-slate-400 print:text-slate-600">
            <p>Gerado em: {formatDateTime(report.generated_at)}</p>
            <p className="font-mono text-[10px]">Doc Ref: #{patient.email.slice(0, 6).toUpperCase()}</p>
          </div>
        </div>

        {/* Identificação do Paciente */}
        <section className="bg-slate-50 dark:bg-slate-800/40 print:bg-slate-100/70 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 print:border-slate-300">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
            Dados do Paciente
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-xs text-slate-400 block">Nome Completo:</span>
              <span className="font-semibold text-slate-900 dark:text-white print:text-black">{patient.name}</span>
            </div>
            <div>
              <span className="text-xs text-slate-400 block">Idade / Nascimento:</span>
              <span className="font-semibold">
                {patient.age ? `${patient.age} anos` : '—'}
                {patient.birth_date ? ` (${formatDate(patient.birth_date)})` : ''}
              </span>
            </div>
            <div>
              <span className="text-xs text-slate-400 block">Altura:</span>
              <span className="font-semibold">{patient.height_cm ? `${patient.height_cm} cm` : '—'}</span>
            </div>
            <div>
              <span className="text-xs text-slate-400 block">E-mail:</span>
              <span className="font-semibold truncate block">{patient.email}</span>
            </div>
          </div>
        </section>

        {/* Seção 1: Evolução Física e Composição Corporal */}
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
            <h3 className="text-base font-bold text-slate-900 dark:text-white print:text-black flex items-center gap-2">
              <span>⚖️</span> 1. Acompanhamento Físico & Antropométrico
            </h3>
            <span className="text-xs text-slate-500">
              {physical.total_records} medições registradas
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MetricBox
              label="Peso Atual"
              value={physical.latest_weight_kg ? `${physical.latest_weight_kg} kg` : '—'}
              sub={
                physical.delta_weight_kg !== null
                  ? `${physical.delta_weight_kg > 0 ? '+' : ''}${physical.delta_weight_kg} kg desde o início`
                  : undefined
              }
            />
            <MetricBox
              label="IMC Atual"
              value={physical.latest_imc ? `${physical.latest_imc}` : '—'}
              sub={physical.imc_classification ?? undefined}
            />
            <MetricBox
              label="% Gordura Atual"
              value={physical.latest_body_fat_pct ? `${physical.latest_body_fat_pct}%` : '—'}
              sub={
                physical.delta_body_fat_pct !== null
                  ? `${physical.delta_body_fat_pct > 0 ? '+' : ''}${physical.delta_body_fat_pct}% total`
                  : undefined
              }
            />
            <MetricBox
              label="Massa Muscular"
              value={physical.latest_muscle_mass_kg ? `${physical.latest_muscle_mass_kg} kg` : '—'}
              sub="Massa magra estimada"
            />
          </div>
        </section>

        {/* Seção 2: Exames Clínicos e Biomarcadores Mais Recentes */}
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
            <h3 className="text-base font-bold text-slate-900 dark:text-white print:text-black flex items-center gap-2">
              <span>🧪</span> 2. Painel de Biomarcadores Laboratoriais
            </h3>
            {clinical.latest_exam_date && (
              <span className="text-xs text-slate-500">
                Último laudo: {formatDate(clinical.latest_exam_date)}
              </span>
            )}
          </div>

          {clinical.latest_markers.length === 0 ? (
            <p className="text-sm text-slate-400 italic">Nenhum marcador cadastrado nos exames.</p>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 print:border-slate-300">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 dark:bg-slate-800/60 print:bg-slate-200 text-slate-600 dark:text-slate-300 print:text-black font-bold uppercase tracking-wider">
                  <tr>
                    <th className="p-3">Biomarcador</th>
                    <th className="p-3">Resultado</th>
                    <th className="p-3">Referência</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Variação Recente</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 print:divide-slate-300">
                  {clinical.latest_markers.map((m) => (
                    <tr key={m.name} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                      <td className="p-3 font-semibold text-slate-900 dark:text-slate-100 print:text-black">
                        {m.name}
                      </td>
                      <td className="p-3 font-bold tabular-nums">
                        {m.value} {m.unit}
                      </td>
                      <td className="p-3 text-slate-500">{m.reference_range || '—'}</td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded-full font-semibold text-[10px] ${
                            m.status === 'normal'
                              ? 'bg-green-100 text-green-700 print:bg-transparent print:text-green-700'
                              : m.status === 'alto'
                              ? 'bg-red-100 text-red-700 print:bg-transparent print:text-red-700'
                              : m.status === 'baixo'
                              ? 'bg-yellow-100 text-yellow-700 print:bg-transparent print:text-yellow-700'
                              : 'text-slate-400'
                          }`}
                        >
                          {m.status ? m.status.toUpperCase() : 'CONFERIDO'}
                        </span>
                      </td>
                      <td className="p-3 tabular-nums">
                        {m.delta_pct !== null ? (
                          <span
                            className={`font-semibold ${
                              m.trend === 'melhora'
                                ? 'text-green-600'
                                : m.trend === 'piora'
                                ? 'text-amber-600'
                                : 'text-slate-400'
                            }`}
                          >
                            {m.delta_pct > 0 ? '+' : ''}
                            {m.delta_pct}% ({m.trend})
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Seção 3: Alertas e Observações Clínicas */}
        {clinical.active_alerts.length > 0 && (
          <section className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5 dark:border-amber-900/50 dark:bg-amber-950/20 print:border-amber-400 print:bg-amber-50 space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300 print:text-amber-900 flex items-center gap-1.5">
              <span>⚠️</span> Marcadores e Variações com Atenção Clínica
            </h4>
            <ul className="space-y-1 text-xs text-amber-900 dark:text-amber-200 print:text-black">
              {clinical.active_alerts.map((alt, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="font-bold">• {alt.marker} ({alt.value}):</span>
                  <span>{alt.message}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Rodapé e Disclaimer Médico */}
        <div className="pt-8 border-t border-slate-200 dark:border-slate-800 print:border-slate-300 space-y-4">
          <p className="text-[11px] text-slate-500 print:text-slate-600 italic">
            {report.disclaimer}
          </p>

          <div className="grid grid-cols-2 gap-8 pt-8 print:grid">
            <div className="border-t border-slate-300 dark:border-slate-700 text-center pt-2">
              <p className="text-xs font-semibold">{patient.name}</p>
              <p className="text-[10px] text-slate-400">Assinatura do Paciente</p>
            </div>
            <div className="border-t border-slate-300 dark:border-slate-700 text-center pt-2">
              <p className="text-xs font-semibold">Médico / Nutricionista Responsável</p>
              <p className="text-[10px] text-slate-400">Carimbo e CRM/CRN</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function MetricBox({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/40 print:bg-slate-100/80 p-4 border border-slate-200 dark:border-slate-800 print:border-slate-300">
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
      <p className="text-xl font-bold text-slate-900 dark:text-white print:text-black mt-1">{value}</p>
      {sub && <p className="text-[11px] text-slate-500 mt-0.5">{sub}</p>}
    </div>
  )
}
