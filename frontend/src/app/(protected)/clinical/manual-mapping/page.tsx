'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft, CircleCheck, FileWarning } from 'lucide-react'

import { extractErrorMessage } from '@/lib/api'
import { formatDateTime, getFileUrl } from '@/lib/utils'
import * as clinicalService from '@/lib/services/clinicalService'
import type { ClinicalResponse } from '@/types'
import { BIOMARKER_CATEGORIES, BIOMARKERS } from '@/lib/constants/biomarkers'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Spinner from '@/components/ui/Spinner'
import Textarea from '@/components/ui/Textarea'

// ─── visualizador de arquivo (pdf ou imagem) ──────────────────────────────────

function FileViewer({ filePath }: { filePath: string | null }) {
  const url = filePath ? getFileUrl(filePath) : null
  const isPdf = filePath?.toLowerCase().endsWith('.pdf')

  if (!url) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-white/10 text-slate-500">
        <FileWarning className="h-10 w-10" strokeWidth={1.5} />
        <p className="text-sm">Nenhum arquivo anexado a este exame</p>
      </div>
    )
  }

  if (isPdf) {
    return (
      <iframe
        src={url}
        title="Laudo PDF"
        className="h-full w-full rounded-2xl border border-white/10 bg-white"
      />
    )
  }

  // imagem
  return (
    <div className="flex h-full items-center justify-center overflow-auto rounded-2xl border border-white/10 bg-white/[0.02] p-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt="Laudo"
        className="max-h-full max-w-full rounded-lg object-contain shadow"
      />
    </div>
  )
}

// ─── formulário de mapeamento manual ─────────────────────────────────────────

const numericStringSchema = z
  .string()
  .optional()
  .refine(
    (val) => {
      if (!val || val.trim() === '') return true
      const num = Number(val.replace(',', '.'))
      return !isNaN(num)
    },
    { message: 'Valor numérico inválido' }
  )

function getFormSchema() {
  const schemaObj: Record<string, z.ZodTypeAny> = {
    notes: z.string().optional(),
  }
  BIOMARKERS.forEach((m) => {
    schemaObj[m.name] = numericStringSchema
  })
  return z.object(schemaObj).refine(
    (data: Record<string, any>) =>
      BIOMARKERS.some((m) => {
        const val = data[m.name]
        return typeof val === 'string' && val.trim() !== ''
      }),
    {
      message: 'Preencha ao menos um biomarcador antes de salvar.',
      path: ['root.serverError'],
    }
  )
}

function MappingForm({
  record,
  onSuccess,
}: {
  record: ClinicalResponse
  onSuccess: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  // pré-preenche se já havia dados extraídos parcialmente
  const defaultValues: Record<string, string> = { notes: record.notes ?? '' }
  const existing = record.extracted_data?.markers as
    | Array<{ name: string; value: string | number }>
    | undefined
  if (existing?.length) {
    existing.forEach((m) => {
      defaultValues[m.name] = String(m.value)
    })
  }

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(getFormSchema()),
    defaultValues,
  })

  async function onSubmit(data: Record<string, any>) {
    setServerError(null)

    const markers = BIOMARKERS.filter((m) => data[m.name]?.trim()).map((m) => ({
      name: m.name,
      value: data[m.name].trim(),
      unit: m.unit,
      reference_range: m.reference,
      status: null,
    }))

    setSaving(true)
    try {
      await clinicalService.patchClinicalData(
        record.id,
        {
          engine: 'local_cv',
          status: 'manual',
          markers,
        },
        data.notes || undefined,
      )
      onSuccess()
    } catch (err) {
      setServerError(extractErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex h-full flex-col">
      {/* cabeçalho fixo do formulário */}
      <div className="mb-4 flex-shrink-0">
        <h2 className="text-lg font-semibold text-white">Mapeamento manual</h2>
        <p className="mt-0.5 text-sm text-slate-400">
          Preencha os valores diretamente do laudo à esquerda.
        </p>
      </div>

      {/* campos por categoria (área com scroll) */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-6 pb-4">
        {BIOMARKER_CATEGORIES.map((category) => {
          const markersInCategory = BIOMARKERS.filter((m) => m.category === category)
          return (
            <fieldset key={category}>
              <legend className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
                {category}
              </legend>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                {markersInCategory.map((m) => (
                  <Input
                    key={m.name}
                    label={m.name}
                    type="text"
                    inputMode="decimal"
                    placeholder="—"
                    helpText={`${m.unit} · ref: ${m.reference}`}
                    error={errors[m.name]?.message as string | undefined}
                    {...register(m.name)}
                  />
                ))}
              </div>
            </fieldset>
          )
        })}

        <Textarea
          label="Observações"
          placeholder="Laboratório, médico solicitante, contexto clínico..."
          rows={2}
          error={errors.notes?.message as string | undefined}
          {...register('notes')}
        />
      </div>

      {/* rodapé fixo com erro + botão */}
      <div className="flex-shrink-0 space-y-3 border-t border-white/[0.06] pt-4">
        {(serverError || errors.root?.serverError?.message) && (
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
            {serverError || (errors.root?.serverError?.message as string)}
          </div>
        )}
        <Button type="submit" loading={saving} className="w-full" size="lg">
          Confirmar e salvar biomarcadores
        </Button>
      </div>
    </form>
  )
}

// ─── conteúdo da página (usa useSearchParams) ─────────────────────────────────

function ManualMappingContent() {
  const router = useRouter()
  const params = useSearchParams()
  const id = Number(params.get('id'))

  const [record, setRecord] = useState<ClinicalResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  useEffect(() => {
    if (!id || isNaN(id)) {
      setFetchError('ID do exame inválido ou ausente.')
      setLoading(false)
      return
    }

    clinicalService
      .getClinical(id)
      .then(setRecord)
      .catch((err) => setFetchError(extractErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner size="lg" className="text-sky-400" />
      </div>
    )
  }

  if (fetchError || !record) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <p className="text-sm text-rose-400">{fetchError ?? 'Exame não encontrado.'}</p>
        <Button variant="secondary" onClick={() => router.push('/clinical')}>
          Voltar aos exames
        </Button>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-80px)] flex-col gap-4 pb-4">
      {/* breadcrumb */}
      <div className="flex flex-shrink-0 items-center justify-between">
        <div>
          <button
            type="button"
            onClick={() => router.push('/clinical')}
            className="mb-1 flex items-center gap-1 text-sm text-slate-500 transition hover:text-slate-200"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={2} />
            Exames clínicos
          </button>
          <h1 className="text-xl font-bold text-white">Mapeamento manual</h1>
          <p className="text-sm text-slate-400">
            {formatDateTime(record.recorded_at)} · exame #{record.id}
          </p>
        </div>

        {record.is_validated && (
          <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-sm font-medium text-emerald-300">
            <CircleCheck className="h-3.5 w-3.5" strokeWidth={2} />
            Validado
          </span>
        )}
      </div>

      {/* layout split */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 lg:grid-cols-2">
        {/* coluna esquerda: laudo */}
        <section className="min-h-0">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
            Laudo original
          </p>
          <div className="h-[calc(100%-24px)]">
            <FileViewer filePath={record.file_path} />
          </div>
        </section>

        {/* coluna direita: formulário */}
        <section className="flex min-h-0 flex-col rounded-2xl border border-white/[0.06] bg-slate-900/60 p-6 shadow-sm">
          <MappingForm
            record={record}
            onSuccess={() => router.push('/dashboard')}
          />
        </section>
      </div>
    </div>
  )
}

// ─── PÁGINA EXPORTADA (envolve em Suspense para useSearchParams) ──────────────

export default function ManualMappingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <Spinner size="lg" className="text-sky-400" />
        </div>
      }
    >
      <ManualMappingContent />
    </Suspense>
  )
}
