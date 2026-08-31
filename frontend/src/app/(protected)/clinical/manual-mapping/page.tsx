'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

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
      <div className="flex h-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 text-slate-400 dark:border-slate-700">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-12 w-12">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
        <p className="text-sm">Nenhum arquivo anexado a este exame</p>
      </div>
    )
  }

  if (isPdf) {
    return (
      <iframe
        src={url}
        title="Laudo PDF"
        className="h-full w-full rounded-2xl border border-slate-200 bg-white dark:border-slate-700"
      />
    )
  }

  // imagem
  return (
    <div className="flex h-full items-center justify-center overflow-auto rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900">
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
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          Mapeamento Manual
        </h2>
        <p className="mt-0.5 text-sm text-slate-500">
          Preencha os valores diretamente do laudo à esquerda.
        </p>
      </div>

      {/* campos por categoria — área com scroll */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-6 pb-4">
        {BIOMARKER_CATEGORIES.map((category) => {
          const markersInCategory = BIOMARKERS.filter((m) => m.category === category)
          return (
            <fieldset key={category}>
              <legend className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
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
      <div className="flex-shrink-0 space-y-3 border-t border-[var(--border)] pt-4">
        {(serverError || errors.root?.serverError?.message) && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
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
        <Spinner size="lg" className="text-primary-500" />
      </div>
    )
  }

  if (fetchError || !record) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <p className="text-sm text-red-500">{fetchError ?? 'Exame não encontrado.'}</p>
        <Button variant="secondary" onClick={() => router.push('/clinical')}>
          Voltar aos exames
        </Button>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-80px)] flex-col gap-4">
      {/* breadcrumb */}
      <div className="flex flex-shrink-0 items-center justify-between">
        <div>
          <button
            type="button"
            onClick={() => router.push('/clinical')}
            className="mb-1 flex items-center gap-1 text-sm text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
            </svg>
            Exames Clínicos
          </button>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            Mapeamento Manual
          </h1>
          <p className="text-sm text-slate-500">
            {formatDateTime(record.recorded_at)} · exame #{record.id}
          </p>
        </div>

        {record.is_validated && (
          <span className="flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
            Validado
          </span>
        )}
      </div>

      {/* layout split */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 lg:grid-cols-2">
        {/* coluna esquerda: laudo */}
        <section className="min-h-0">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
            Laudo original
          </p>
          <div className="h-[calc(100%-24px)]">
            <FileViewer filePath={record.file_path} />
          </div>
        </section>

        {/* coluna direita: formulário */}
        <section className="flex min-h-0 flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
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
          <Spinner size="lg" className="text-primary-500" />
        </div>
      }
    >
      <ManualMappingContent />
    </Suspense>
  )
}
