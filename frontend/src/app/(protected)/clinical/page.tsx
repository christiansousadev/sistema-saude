'use client'

import { type FormEvent, memo, useCallback, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { extractErrorMessage } from '@/lib/api'
import { formatDateTime } from '@/lib/utils'
import * as clinicalService from '@/lib/services/clinicalService'
import type { ClinicalResponse } from '@/types'
import { BIOMARKERS } from '@/lib/constants/biomarkers'
import { usePagination } from '@/lib/hooks/usePagination'
import Button from '@/components/ui/Button'
import FileUpload from '@/components/ui/FileUpload'
import Input from '@/components/ui/Input'
import Spinner from '@/components/ui/Spinner'
import Textarea from '@/components/ui/Textarea'

// ─── formulário de fallback (inserção manual) ─────────────────────────────────

function FallbackForm({
  record,
  onSaved,
}: {
  record: ClinicalResponse
  onSaved: (updated: ClinicalResponse) => void
}) {
  // M-1: pré-preenche com dados já extraídos pela IA
  const [values, setValues] = useState<Record<string, string>>(() => {
    const extracted = record.extracted_data?.markers ?? []
    return Object.fromEntries(
      (extracted as Array<{ name: string; value: string | number }>)
        .map((m) => [m.name, String(m.value)])
    )
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function setMarker(name: string, val: string) {
    setValues((prev) => ({ ...prev, [name]: val }))
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const markers = BIOMARKERS.filter((m) => values[m.name]?.trim()).map((m) => ({
      name: m.name,
      value: values[m.name].trim(),
      unit: m.unit,
      reference_range: m.reference,
      status: null,
    }))

    if (!markers.length) {
      setError('Preencha ao menos um marcador antes de salvar.')
      setSaving(false)
      return
    }

    try {
      const updated = await clinicalService.patchClinicalData(record.id, {
        engine: 'local_cv',
        status: 'manual',
        markers,
      })
      onSaved(updated)
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-5 dark:border-yellow-800/50 dark:bg-yellow-900/10">
      <div className="mb-4 flex items-start gap-3">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="mt-0.5 h-5 w-5 flex-shrink-0 text-yellow-600">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
        <div>
          <p className="font-medium text-yellow-700 dark:text-yellow-400">
            Extração automática incompleta
          </p>
          <p className="text-sm text-yellow-600 dark:text-yellow-500">
            Preencha os marcadores disponíveis no laudo manualmente.
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
          {BIOMARKERS.map((m) => (
            <Input
              key={m.name}
              label={m.name}
              type="text"
              inputMode="decimal"
              value={values[m.name] ?? ''}
              onChange={(e) => setMarker(m.name, e.target.value)}
              placeholder="—"
              helpText={`${m.unit} · ref: ${m.reference}`}
            />
          ))}
        </div>

        {error && (
          <p className="text-sm text-red-500">{error}</p>
        )}

        <Button type="submit" loading={saving} variant="secondary">
          Salvar dados manuais
        </Button>
      </form>
    </div>
  )
}

// ─── card de exame histórico ──────────────────────────────────────────────────
// memo evita re-render de toda a lista a cada tecla digitada no formulário ao lado

const ClinicalCard = memo(function ClinicalCard({
  record,
  onUpdated,
  onDelete,
}: {
  record: ClinicalResponse
  onUpdated: (r: ClinicalResponse) => void
  onDelete: (id: number) => void
}) {
  const [showFallback, setShowFallback] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const markers = record.extracted_data?.markers as
    | Array<{ name: string; value: string | number; unit: string; status: string | null }>
    | undefined

  const hasMarkers = markers && markers.length > 0
  const needsFallback = !hasMarkers

  async function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    setDeleting(true)
    setDeleteError(null)
    try {
      await clinicalService.deleteClinical(record.id)
      onDelete(record.id)
    } catch (err) {
      // B-2: exibe erro ao usuário em vez de silenciar
      setDeleteError(extractErrorMessage(err))
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  function statusColor(s: string | null) {
    if (s === 'normal') return 'text-green-600'
    if (s === 'alto') return 'text-red-600'
    if (s === 'baixo') return 'text-yellow-600'
    return 'text-slate-500'
  }

  function statusIcon(s: string | null) {
    if (s === 'normal') return '✓'
    if (s === 'alto') return '↑'
    if (s === 'baixo') return '↓'
    return '•'
  }

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm space-y-3">
      {/* cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium text-slate-800 dark:text-slate-100">
            {formatDateTime(record.recorded_at)}
          </p>
          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            {record.extraction_engine && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-800">
                {record.extraction_engine}
              </span>
            )}
            {!record.is_validated && (
              <Link
                href={`/clinical/manual-mapping?id=${record.id}`}
                className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700 hover:bg-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 transition"
              >
                ⚠ Não validado — mapear
              </Link>
            )}
            {record.file_path && (
              <span className="text-xs text-slate-400">
                📎 {record.file_path.split('/').pop()}
              </span>
            )}
          </div>
        </div>
        {/* botão deletar com confirmação inline — B-3 */}
        <div className="flex flex-col items-end gap-1">
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-red-600 dark:text-red-400">Confirmar?</span>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="rounded px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 transition"
              >
                {deleting ? '...' : 'Sim'}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="rounded px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 transition"
              >
                Não
              </button>
            </div>
          ) : (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="rounded-lg p-1.5 text-slate-300 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 transition"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
              </svg>
            </button>
          )}
          {deleteError && (
            <p className="text-xs text-red-500 max-w-[140px] text-right">{deleteError}</p>
          )}
        </div>
      </div>

      {/* marcadores */}
      {hasMarkers ? (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
          {markers.map((m) => (
            <div key={m.name} className="flex items-center justify-between gap-2 text-xs">
              <span className="truncate text-slate-500">{m.name}</span>
              <span className={`font-medium tabular-nums ${statusColor(m.status)}`}>
                {statusIcon(m.status)} {m.value} {m.unit}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-400">Nenhum dado extraído</p>
          {needsFallback && (
            <button
              type="button"
              onClick={() => setShowFallback((v) => !v)}
              className="text-xs font-medium text-yellow-600 hover:underline dark:text-yellow-400"
            >
              {showFallback ? 'Fechar' : 'Inserir manualmente'}
            </button>
          )}
        </div>
      )}

      {/* fallback inline para registros sem dados */}
      {showFallback && needsFallback && (
        <FallbackForm
          record={record}
          onSaved={(updated) => {
            onUpdated(updated)
            setShowFallback(false)
          }}
        />
      )}

      {record.notes && <p className="text-xs text-slate-400 italic">{record.notes}</p>}
    </div>
  )
})

// ─── formulário de novo exame ──────────────────────────────────────────────────
// isolado em componente próprio: recordedAt/notes/file/etc ficam fora de ClinicalPage,
// então digitar aqui não re-renderiza a lista de histórico ao lado

function NewExamForm({
  onCreated,
}: {
  onCreated: (created: ClinicalResponse) => void
}) {
  const router = useRouter()

  // B-1: recordedAt inicializado com lazy initializer para evitar hydration mismatch
  const [recordedAt, setRecordedAt] = useState(() => new Date().toISOString().slice(0, 16))
  const [notes, setNotes] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    setSubmitting(true)

    const fd = new FormData()
    fd.append('recorded_at', new Date(recordedAt).toISOString())
    if (notes) fd.append('notes', notes)
    if (file) fd.append('file', file)

    try {
      const created = await clinicalService.createClinical(fd)
      setNotes('')
      setFile(null)

      // extração não validada → abre tela de mapeamento manual com o laudo ao lado
      if (!created.is_validated) {
        router.push(`/clinical/manual-mapping?id=${created.id}`)
        return
      }

      onCreated(created)
    } catch (err) {
      setFormError(extractErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <h2 className="font-semibold text-slate-800 dark:text-slate-200">Novo Exame</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <FileUpload
          label="Arquivo do exame (PDF ou imagem)"
          accept=".pdf,.jpg,.jpeg,.png"
          maxMB={10}
          onChange={setFile}
        />

        <Input
          label="Data do exame"
          type="datetime-local"
          value={recordedAt}
          onChange={(e) => setRecordedAt(e.target.value)}
          required
        />

        <Textarea
          label="Observações"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Médico solicitante, contexto do exame..."
          rows={2}
        />

        {formError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
            {formError}
          </div>
        )}

        <Button type="submit" loading={submitting} className="w-full">
          Enviar e extrair dados
        </Button>
      </form>
    </>
  )
}

// ─── página ───────────────────────────────────────────────────────────────────

export default function ClinicalPage() {
  const [justCreated, setJustCreated] = useState<ClinicalResponse | null>(null)
  const [showFallbackOnNew, setShowFallbackOnNew] = useState(false)

  // M-4: paginação com hook usePagination
  const pagination = usePagination<ClinicalResponse>({
    fetcher: (skip, limit) => clinicalService.listClinical(skip, limit),
    pageSize: 20,
  })

  // identidades estáveis — evitam que ClinicalCard memoizado re-renderize à toa
  const updateRecord = useCallback(
    (updated: ClinicalResponse) => {
      pagination.updateItem((r) => r.id === updated.id, () => updated)
      setJustCreated((prev) => (prev?.id === updated.id ? updated : prev))
    },
    [pagination.updateItem],
  )

  const handleDelete = useCallback(
    (id: number) => {
      pagination.removeItem((r) => r.id === id)
      setJustCreated((prev) => (prev?.id === id ? null : prev))
    },
    [pagination.removeItem],
  )

  const handleCreated = useCallback(
    (created: ClinicalResponse) => {
      // M-4: adiciona no início sem refetch
      pagination.prependItem(created)
      setJustCreated(created)
      setShowFallbackOnNew(false)
    },
    [pagination.prependItem],
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Exames Clínicos</h1>
        <p className="mt-1 text-sm text-slate-500">
          Envie seu PDF ou foto do laudo. A IA tentará extrair os marcadores automaticamente.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[380px_1fr]">
        {/* formulário de envio */}
        <section className="space-y-4">
          <NewExamForm onCreated={handleCreated} />

          {/* resultado após envio */}
          {justCreated && !showFallbackOnNew && (() => {
            const markers = justCreated.extracted_data?.markers as
              | Array<{ name: string; value: string | number; unit: string; status: string | null }>
              | undefined
            return markers?.length ? (
              <div className="rounded-2xl border border-green-200 bg-green-50 p-4 dark:border-green-800/50 dark:bg-green-900/20">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-green-700 dark:text-green-400">
                  ✓ {markers.length} marcador(es) extraído(s)
                </p>
                <div className="space-y-1">
                  {markers.map((m) => (
                    <div key={m.name} className="flex justify-between text-xs">
                      <span className="text-slate-500">{m.name}</span>
                      <span className="font-medium">
                        {m.value} {m.unit}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null
          })()}

          {/* fallback imediato quando extração falha */}
          {justCreated && showFallbackOnNew && (
            <FallbackForm
              record={justCreated}
              onSaved={(updated) => {
                updateRecord(updated)
                setShowFallbackOnNew(false)
              }}
            />
          )}
        </section>

        {/* histórico */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-slate-800 dark:text-slate-200">
              Histórico
              {pagination.total > 0 && (
                <span className="ml-2 text-sm font-normal text-slate-400">({pagination.total})</span>
              )}
            </h2>
          </div>

          {pagination.isLoading ? (
            <div className="flex justify-center py-12">
              <Spinner size="md" className="text-primary-500" />
            </div>
          ) : pagination.error ? (
            <p className="text-sm text-red-500">{pagination.error}</p>
          ) : pagination.items.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 py-12 dark:border-slate-700">
              <p className="text-slate-400">Nenhum exame cadastrado</p>
              <p className="mt-1 text-xs text-slate-300">Envie seu primeiro laudo ao lado</p>
            </div>
          ) : (
            <>
              <ul className="space-y-4">
                {pagination.items.map((r) => (
                  <ClinicalCard
                    key={r.id}
                    record={r}
                    onUpdated={updateRecord}
                    onDelete={handleDelete}
                  />
                ))}
              </ul>
              {/* M-4: botão "Ver mais" */}
              {pagination.hasMore && (
                <div className="mt-4 flex justify-center">
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={pagination.isLoadingMore}
                    onClick={pagination.loadMore}
                  >
                    Ver mais ({pagination.total - pagination.items.length} restantes)
                  </Button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  )
}
