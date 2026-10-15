'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  Activity,
  AlertCircle,
  Clock,
  Dumbbell,
  FlaskConical,
  KeyRound,
  Lock,
  Printer,
  ShieldCheck,
  Stethoscope,
  TriangleAlert,
} from 'lucide-react'

import * as doctorShareService from '@/lib/services/doctorShareService'
import type { MedicalSummaryResponse } from '@/types'
import { extractErrorMessage } from '@/lib/api'
import { formatDate, formatDateTime } from '@/lib/utils'
import Spinner from '@/components/ui/Spinner'
import Button from '@/components/ui/Button'

export default function PublicSharedReportPage() {
  const params = useParams<{ token: string }>()
  const token = params?.token

  const [report, setReport] = useState<MedicalSummaryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [needsPin, setNeedsPin] = useState(false)
  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState<string | null>(null)
  const [unlocking, setUnlocking] = useState(false)

  useEffect(() => {
    if (!token) return

    // 1. verifica se o link exige PIN
    doctorShareService
      .checkShareToken(token)
      .then((check) => {
        if (check.requires_pin) {
          setNeedsPin(true)
          setLoading(false)
        } else {
          // sem pin: carrega direto
          return doctorShareService.getPublicSharedReport(token).then(setReport)
        }
      })
      .catch((err) => {
        setError(extractErrorMessage(err, 'Link de compartilhamento expirado ou não encontrado.'))
      })
      .finally(() => setLoading(false))
  }, [token])

  async function handleUnlockWithPin(e: React.FormEvent) {
    e.preventDefault()
    if (!token || !pinInput) return

    setUnlocking(true)
    setPinError(null)
    try {
      const data = await doctorShareService.getPublicSharedReport(token, pinInput)
      setReport(data)
      setNeedsPin(false)
    } catch (err) {
      setPinError('PIN de segurança incorreto. Solicite o código ao paciente.')
    } finally {
      setUnlocking(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
        <div className="flex flex-col items-center gap-3">
          <Spinner size="lg" className="text-sky-400" />
          <p className="text-xs text-slate-400">Carregando prontuário compartilhado...</p>
        </div>
      </div>
    )
  }

  if (needsPin && !report) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
        <div className="max-w-md w-full rounded-3xl border border-sky-500/20 bg-slate-900/90 p-8 shadow-2xl backdrop-blur-md">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-400 ring-1 ring-sky-500/20">
            <Lock className="h-7 w-7" />
          </div>

          <h1 className="text-lg font-bold text-center text-white mb-1">
            Prontuário Protegido por PIN
          </h1>
          <p className="text-xs text-center text-slate-400 leading-relaxed mb-6">
            O paciente definiu um código de segurança obrigatório para liberação deste relatório médico.
          </p>

          <form onSubmit={handleUnlockWithPin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Digite o PIN de 4 a 8 dígitos:
              </label>
              <div className="relative">
                <input
                  type="password"
                  maxLength={8}
                  placeholder="••••"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  required
                  autoFocus
                  className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-2.5 text-center text-base tracking-widest text-white placeholder-slate-600 focus:border-sky-400 focus:outline-none"
                />
                <KeyRound className="absolute right-3 top-3 h-4 w-4 text-slate-500 pointer-events-none" />
              </div>
            </div>

            {pinError && (
              <p className="text-xs text-rose-400 text-center font-medium">
                {pinError}
              </p>
            )}

            <button
              type="submit"
              disabled={unlocking || !pinInput}
              className="w-full rounded-xl bg-sky-500 py-2.5 text-xs font-bold text-slate-950 shadow-md transition hover:bg-sky-400 disabled:opacity-50"
            >
              {unlocking ? 'Verificando código...' : 'Desbloquear Prontuário'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  if (error || !report) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
        <div className="max-w-md w-full rounded-3xl border border-rose-500/20 bg-slate-900/80 p-8 text-center shadow-2xl backdrop-blur-md">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-400">
            <Clock className="h-7 w-7" />
          </div>
          <h1 className="text-lg font-bold text-white mb-2">Link Indisponível ou Expirado</h1>
          <p className="text-xs text-slate-400 leading-relaxed mb-6">
            {error || 'Este link de acesso médico temporário não é mais válido ou foi revogado pelo paciente.'}
          </p>
          <p className="text-[11px] text-slate-500">
            Solicite um novo link de compartilhamento ao paciente para visualizar o prontuário.
          </p>
        </div>
      </div>
    )
  }

  const { patient, physical, clinical } = report

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-4 sm:p-8 print:bg-white print:p-0 print:text-black">
      <div className="max-w-4xl mx-auto space-y-6 print:max-w-none print:m-0">
        {/* barra de topo (oculta na impressao) */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sky-500/20 bg-sky-950/20 p-4 backdrop-blur-md print:hidden">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/10 text-sky-400 ring-1 ring-sky-500/20">
              <Stethoscope className="h-5 w-5" />
            </span>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-sky-400">
                Acesso Médico Autorizado
              </span>
              <p className="text-xs text-slate-400">
                Prontuário consolidado do paciente · Visualização somente-leitura
              </p>
            </div>
          </div>

          <Button
            onClick={() => window.print()}
            className="flex items-center gap-2 shadow-md bg-sky-500 text-slate-950 hover:bg-sky-400 font-bold text-xs"
          >
            <Printer className="h-4 w-4" />
            Imprimir / Salvar PDF
          </Button>
        </div>

        {/* folha do prontuario */}
        <div className="rounded-3xl border border-white/[0.06] bg-slate-900/60 p-6 sm:p-10 shadow-xl print:rounded-none print:border-none print:bg-white print:p-0 print:shadow-none space-y-8">
          {/* cabecalho do documento */}
          <div className="flex flex-col gap-4 border-b border-white/[0.06] print:border-slate-300 pb-6 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="mb-1 flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-sky-500 text-slate-950 font-bold text-sm print:bg-black print:text-white">
                  +
                </span>
                <h1 className="text-xl font-bold text-white print:text-black">
                  Sistema Saúde · Relatório Médico
                </h1>
              </div>
              <p className="text-xs text-slate-400 print:text-slate-600">
                Histórico antropométrico, biomarcadores laboratoriais e alertas
              </p>
            </div>
            <div className="text-left text-xs text-slate-400 print:text-slate-600 sm:text-right">
              <p>Gerado em: {formatDateTime(report.generated_at)}</p>
              <p className="font-mono text-[10px] text-slate-500">Ref: #{patient.email.slice(0, 6).toUpperCase()}</p>
            </div>
          </div>

          {/* dados do paciente */}
          <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] print:border-slate-300 print:bg-slate-100/70 p-5">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">
              Identificação do Paciente
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="block text-xs text-slate-500">Nome</span>
                <span className="font-semibold text-white print:text-black">{patient.name}</span>
              </div>
              <div>
                <span className="block text-xs text-slate-500">Idade</span>
                <span className="font-semibold text-slate-200 print:text-black">
                  {patient.age ? `${patient.age} anos` : '—'}
                </span>
              </div>
              <div>
                <span className="block text-xs text-slate-500">Altura</span>
                <span className="font-semibold text-slate-200 print:text-black">
                  {patient.height_cm ? `${patient.height_cm} cm` : '—'}
                </span>
              </div>
              <div>
                <span className="block text-xs text-slate-500">Data de Nasc.</span>
                <span className="font-semibold text-slate-200 print:text-black">
                  {patient.birth_date ? formatDate(patient.birth_date) : '—'}
                </span>
              </div>
            </div>
          </section>

          {/* evolucao fisica */}
          <section className="space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Parâmetros Físicos e Antropométricos
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <MetricBox
                label="Peso Atual"
                value={physical.latest_weight_kg ? `${physical.latest_weight_kg.toFixed(1)} kg` : '—'}
                sub={physical.delta_weight_kg !== null ? `${physical.delta_weight_kg > 0 ? '+' : ''}${physical.delta_weight_kg} kg total` : undefined}
              />
              <MetricBox
                label="IMC Atual"
                value={physical.latest_imc ? `${physical.latest_imc.toFixed(1)}` : '—'}
                sub={physical.imc_classification ?? undefined}
              />
              <MetricBox
                label="Gordura Corporal"
                value={physical.latest_body_fat_pct ? `${physical.latest_body_fat_pct.toFixed(1)}%` : '—'}
                sub={physical.delta_body_fat_pct !== null ? `${physical.delta_body_fat_pct > 0 ? '+' : ''}${physical.delta_body_fat_pct}% total` : undefined}
              />
              <MetricBox
                label="Massa Muscular"
                value={physical.latest_muscle_mass_kg ? `${physical.latest_muscle_mass_kg.toFixed(1)} kg` : '—'}
                sub="Bioimpedância"
              />
            </div>
          </section>

          {/* alertas clinicos ativos */}
          {clinical.active_alerts && clinical.active_alerts.length > 0 && (
            <section className="rounded-2xl border border-rose-500/20 bg-rose-500/5 print:border-rose-400 print:bg-rose-50 p-5 space-y-3">
              <div className="flex items-center gap-2 text-rose-400 print:text-rose-700">
                <TriangleAlert className="h-4 w-4" />
                <h2 className="text-xs font-bold uppercase tracking-wider">
                  Alertas de Biomarcadores Alterados ({clinical.active_alerts.length})
                </h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {clinical.active_alerts.map((alert, idx) => (
                  <div key={idx} className="rounded-xl border border-rose-500/10 bg-slate-900/60 print:bg-white p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-white print:text-black">{alert.marker}</span>
                      <span className="font-semibold text-rose-400 print:text-rose-700">{alert.value}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 print:text-slate-600">{alert.message}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* marcadores laboratoriais */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Últimos Exames Laboratoriais
              </h2>
              {clinical.latest_exam_date && (
                <span className="text-xs text-slate-500">
                  Data da coleta: {formatDate(clinical.latest_exam_date)}
                </span>
              )}
            </div>

            {clinical.latest_markers && clinical.latest_markers.length > 0 ? (
              <div className="overflow-x-auto rounded-2xl border border-white/[0.06] print:border-slate-300">
                <table className="w-full text-left text-xs">
                  <thead className="bg-white/[0.02] print:bg-slate-100 text-slate-500 border-b border-white/[0.06] print:border-slate-300">
                    <tr>
                      <th className="p-3 font-semibold">Biomarcador</th>
                      <th className="p-3 font-semibold">Resultado</th>
                      <th className="p-3 font-semibold">Referência</th>
                      <th className="p-3 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04] print:divide-slate-200">
                    {clinical.latest_markers.map((m, idx) => (
                      <tr key={idx} className="hover:bg-white/[0.02]">
                        <td className="p-3 font-medium text-white print:text-black">{m.name}</td>
                        <td className="p-3 font-bold text-slate-200 print:text-black">
                          {m.value} {m.unit}
                        </td>
                        <td className="p-3 text-slate-400 print:text-slate-600">
                          {m.reference_range || 'Padrão'}
                        </td>
                        <td className="p-3">
                          <MarkerStatusChip status={m.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-slate-500 text-center py-6">
                Nenhum exame laboratorial registrado até o momento.
              </p>
            )}
          </section>

          {/* rodape de impressao / assinatura */}
          <div className="hidden print:block pt-12 border-t border-slate-300">
            <div className="grid grid-cols-2 gap-8 text-center text-xs">
              <div>
                <div className="border-b border-black mb-1 w-48 mx-auto" />
                <p className="font-semibold">{patient.name}</p>
                <p className="text-[10px] text-slate-600">Paciente</p>
              </div>
              <div>
                <div className="border-b border-black mb-1 w-48 mx-auto" />
                <p className="font-semibold">Médico Responsável</p>
                <p className="text-[10px] text-slate-600">CRM / Assinatura</p>
              </div>
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
      <p className="mt-1 text-lg font-bold text-white print:text-black">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-slate-400 print:text-slate-600">{sub}</p>}
    </div>
  )
}

function MarkerStatusChip({ status }: { status: string | null }) {
  const styles: Record<string, string> = {
    normal: 'bg-emerald-500/10 text-emerald-300 print:bg-transparent print:text-emerald-700',
    alto: 'bg-rose-500/10 text-rose-300 print:bg-transparent print:text-rose-700 font-bold',
    baixo: 'bg-amber-500/10 text-amber-300 print:bg-transparent print:text-amber-700 font-bold',
  }
  const cls = (status && styles[status]) || 'text-slate-500'
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${cls}`}>
      {status ? status.toUpperCase() : 'CONFERIDO'}
    </span>
  )
}
