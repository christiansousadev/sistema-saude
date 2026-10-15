'use client'

import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  Check,
  ClipboardCopy,
  HelpCircle,
  Stethoscope,
  X,
} from 'lucide-react'

import { getDoctorQuestions } from '@/lib/services/assistantService'
import type { DoctorQuestionsResponse } from '@/types'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'

interface DoctorQuestionsModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function DoctorQuestionsModal({ isOpen, onClose }: DoctorQuestionsModalProps) {
  const [data, setData] = useState<DoctorQuestionsResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setLoading(true)
      getDoctorQuestions()
        .then((res) => setData(res))
        .catch(() => setData(null))
        .finally(() => setLoading(false))
    }
  }, [isOpen])

  if (!isOpen) return null

  function copyQuestions() {
    if (!data?.questions?.length) return
    const text = [
      '📋 Minhas perguntas para a consulta médica:',
      '',
      ...data.questions.map((q, i) => `${i + 1}. ${q}`),
      '',
      'Gerado pelo Sistema Saúde',
    ].join('\n')

    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Perguntas para consulta médica"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 overflow-y-auto"
    >
      <div className="relative w-full max-w-xl rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-2xl space-y-5 my-auto">
        {/* cabeçalho */}
        <div className="flex items-center justify-between border-b border-white/[0.06] pb-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20">
              <Stethoscope className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-bold text-white">
                Preparação para Consulta Médica
              </h2>
              <p className="text-xs text-slate-400">
                Perguntas embasadas nos seus exames recentes
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-xl p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Spinner size="md" className="text-emerald-400" />
            <p className="text-xs text-slate-400">Analisando seus exames e formulando dúvidas...</p>
          </div>
        ) : !data || data.questions.length === 0 ? (
          <div className="p-6 text-center text-slate-400 text-sm">
            Nenhuma pergunta disponível no momento.
          </div>
        ) : (
          <>
            {/* biomarcadores alterados identificados */}
            {data.abnormal_markers_found.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-300">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                <span className="font-semibold">Alterações detectadas:</span>
                <span>{data.abnormal_markers_found.join(', ')}</span>
              </div>
            )}

            {/* lista de perguntas */}
            <div className="space-y-3">
              {data.questions.map((question, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 text-xs text-slate-200"
                >
                  <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-[10px]">
                    {i + 1}
                  </span>
                  <p className="leading-relaxed">{question}</p>
                </div>
              ))}
            </div>

            {/* aviso de rodapé */}
            <p className="text-[11px] text-slate-500 italic">
              {data.disclaimer}
            </p>

            {/* ações */}
            <div className="flex justify-between items-center pt-2 border-t border-white/[0.06]">
              <Button
                variant="secondary"
                size="sm"
                onClick={copyQuestions}
                className="gap-1.5"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    Copiado para a área de transferência!
                  </>
                ) : (
                  <>
                    <ClipboardCopy className="h-3.5 w-3.5" />
                    Copiar perguntas
                  </>
                )}
              </Button>

              <Button variant="primary" size="sm" onClick={onClose}>
                Concluir
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
