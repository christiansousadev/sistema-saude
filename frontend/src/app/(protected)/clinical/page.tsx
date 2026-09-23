'use client'

import { type FormEvent, memo, useCallback, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowDown,
  ArrowUp,
  CircleCheck,
  FlaskConical,
  Minus,
  Paperclip,
  Search,
  Trash2,
  TriangleAlert,
} from 'lucide-react'

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

type MarkerEntry = { name: string; value: string | number; unit: string; status: string | null }
type StatusFilter = 'todos' | 'alertas' | 'normais'

// ─── badge de validação ────────────────────────────────────────────────────────

function ValidationBadge({ validated }: { validated: boolean }) {
  if (validated) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-300">
        <CircleCheck className="h-3 w-3" strokeWidth={2} />
        Validado
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-300">
      <TriangleAlert className="h-3 w-3" strokeWidth={2} />
      Pendente
    </span>
  )
}

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
    <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.05] p-5">
      <div className="mb-4 flex items-start gap-3">
        <TriangleAlert className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-400" strokeWidth={1.75} />
        <div>
          <p className="font-medium text-amber-300">Extração automática incompleta</p>
          <p className="text-sm text-amber-300/70">
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

        {error && <p className="text-sm text-rose-400">{error}</p>}

        <Button type="submit" loading={saving} variant="secondary">
          Salvar dados manuais
        </Button>
      </form>
    </div>
  )
}

// ─── card de exame histórico ──────────────────────────────────────────────────
// memo evita re-render de toda a lista a cada tecla digitada no formulário ao lado

function MarkerStatusIcon({ status }: { status: string | null }) {
  if (status === 'normal') return <CircleCheck className="h-3 w-3 text-emerald-400" strokeWidth={2} />
  if (status === 'alto') return <ArrowUp className="h-3 w-3 text-rose-400" strokeWidth={2} />
  if (status === 'baixo') return <ArrowDown className="h-3 w-3 text-amber-400" strokeWidth={2} />
  return <Minus className="h-3 w-3 text-slate-500" strokeWidth={2} />
}

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

  const markers = record.extracted_data?.markers as MarkerEntry[] | undefined

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
    if (s === 'normal') return 'text-emerald-300'
    if (s === 'alto') return 'text-rose-300'
    if (s === 'baixo') return 'text-amber-300'
    return 'text-slate-400'
  }

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-slate-900/60 p-5 shadow-sm space-y-3">
      {/* cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium text-slate-100">{formatDateTime(record.recorded_at)}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {record.extraction_engine && (
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-slate-400">
                {record.extraction_engine}
              </span>
            )}
            <ValidationBadge validated={record.is_validated} />
            {!record.is_validated && (
              <Link
                href={`/clinical/manual-mapping?id=${record.id}`}
                className="text-xs font-medium text-sky-400 transition hover:text-sky-300"
              >
                Mapear agora
              </Link>
            )}
            {record.file_path && (
              <span className="flex items-center gap-1 text-xs text-slate-500">
                <Paperclip className="h-3 w-3" strokeWidth={2} />
                {record.file_path.split('/').pop()}
              </span>
            )}
          </div>
        </div>
        {/* botão deletar com confirmação inline (B-3) */}
        <div className="flex flex-col items-end gap-1">
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-rose-400">Confirmar?</span>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="rounded px-2 py-1 text-xs font-medium bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 transition"
              >
                {deleting ? '...' : 'Sim'}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="rounded px-2 py-1 text-xs font-medium bg-white/5 text-slate-300 hover:bg-white/10 transition"
              >
                Não
              </button>
            </div>
          ) : (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-rose-500/10 hover:text-rose-400"
              aria-label="Remover exame"
            >
              <Trash2 className="h-4 w-4" strokeWidth={1.75} />
            </button>
          )}
          {deleteError && (
            <p className="text-xs text-rose-400 max-w-[140px] text-right">{deleteError}</p>
          )}
        </div>
      </div>

      {/* marcadores */}
      {hasMarkers ? (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
          {markers.map((m) => (
            <div key={m.name} className="flex items-center justify-between gap-2 text-xs">
              <span className="truncate text-slate-500">{m.name}</span>
              <span className={`flex items-center gap-1 font-medium tabular-nums ${statusColor(m.status)}`}>
                <MarkerStatusIcon status={m.status} />
                {m.value} {m.unit}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">Nenhum dado extraído</p>
          {needsFallback && (
            <button
              type="button"
              onClick={() => setShowFallback((v) => !v)}
              className="text-xs font-medium text-amber-300 hover:underline"
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

      {record.notes && <p className="text-xs text-slate-500 italic">{record.notes}</p>}
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
      <h2 className="flex items-center gap-2 font-semibold text-white">
        <FlaskConical className="h-4 w-4 text-emerald-400" strokeWidth={2} />
        Novo exame
      </h2>

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
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
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

// ─── filtro rápido por biomarcador e status ────────────────────────────────────

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'alertas', label: 'Com alertas' },
  { value: 'normais', label: 'Normais' },
]

function examMatchesFilter(record: ClinicalResponse, query: string, statusFilter: StatusFilter): boolean {
  const markers = (record.extracted_data?.markers as MarkerEntry[] | undefined) ?? []

  const matchesQuery =
    !query.trim() || markers.some((m) => m.name.toLowerCase().includes(query.trim().toLowerCase()))

  if (!matchesQuery) return false
  if (statusFilter === 'todos') return true

  const hasAlert = markers.some((m) => m.status === 'alto' || m.status === 'baixo')
  if (statusFilter === 'alertas') return hasAlert
  // "normais": precisa ter ao menos um marcador e nenhum alterado
  return markers.length > 0 && !hasAlert
}

// ─── página ───────────────────────────────────────────────────────────────────

export default function ClinicalPage() {
  const [justCreated, setJustCreated] = useState<ClinicalResponse | null>(null)
  const [showFallbackOnNew, setShowFallbackOnNew] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todos')

  // M-4: paginação com hook usePagination
  const pagination = usePagination<ClinicalResponse>({
    fetcher: (skip, limit) => clinicalService.listClinical(skip, limit),
    pageSize: 20,
  })

  // identidades estáveis evitam que ClinicalCard memoizado re-renderize à toa
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

  // filtro aplicado apenas sobre os exames já carregados na página atual
  const filteredItems = useMemo(
    () => pagination.items.filter((r) => examMatchesFilter(r, searchQuery, statusFilter)),
    [pagination.items, searchQuery, statusFilter],
  )
  const isFiltering = searchQuery.trim() !== '' || statusFilter !== 'todos'

  return (
    <div className="space-y-6 pb-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Exames clínicos</h1>
        <p className="mt-1 text-sm text-slate-400">
          Envie seu PDF ou foto do laudo. A IA tentará extrair os marcadores automaticamente.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[380px_1fr]">
        {/* formulário de envio */}
        <section className="space-y-4 rounded-2xl border border-white/[0.06] bg-slate-900/60 p-5 shadow-sm">
          <NewExamForm onCreated={handleCreated} />

          {/* resultado após envio */}
          {justCreated && !showFallbackOnNew && (() => {
            const markers = justCreated.extracted_data?.markers as MarkerEntry[] | undefined
            return markers?.length ? (
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] p-4">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-300">
                  <CircleCheck className="h-3.5 w-3.5" strokeWidth={2} />
                  {markers.length} marcador(es) extraído(s)
                </p>
                <div className="space-y-1">
                  {markers.map((m) => (
                    <div key={m.name} className="flex justify-between text-xs">
                      <span className="text-slate-400">{m.name}</span>
                      <span className="font-medium text-slate-200">
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
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold text-white">
              Histórico
              {pagination.total > 0 && (
                <span className="ml-2 text-sm font-normal text-slate-500">({pagination.total})</span>
              )}
            </h2>
          </div>

          {/* filtros rápidos */}
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" strokeWidth={2} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por biomarcador (ex: colesterol, glicemia...)"
                className="min-h-11 w-full rounded-xl border border-white/10 bg-white/[0.03] py-2 pl-9 pr-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-sky-500/50 focus:ring-2 focus:ring-sky-500/20"
              />
            </div>
            <div className="flex gap-1.5">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setStatusFilter(f.value)}
                  className={`min-h-11 rounded-xl px-3 text-xs font-medium transition ${
                    statusFilter === f.value
                      ? 'bg-sky-500 text-white shadow-sm'
                      : 'border border-white/10 bg-white/[0.03] text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {pagination.isLoading ? (
            <div className="flex justify-center py-12">
              <Spinner size="md" className="text-sky-400" />
            </div>
          ) : pagination.error ? (
            <p className="text-sm text-rose-400">{pagination.error}</p>
          ) : pagination.items.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2.5 rounded-2xl border border-dashed border-white/10 py-12">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.04] text-slate-500">
                <FlaskConical className="h-4 w-4" strokeWidth={2} />
              </span>
              <p className="text-slate-400">Nenhum exame cadastrado</p>
              <p className="text-xs text-slate-500">Envie seu primeiro laudo ao lado</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/10 py-12">
              <p className="text-slate-400">Nenhum exame corresponde ao filtro</p>
              <button
                onClick={() => { setSearchQuery(''); setStatusFilter('todos') }}
                className="text-xs font-medium text-sky-400 hover:text-sky-300"
              >
                Limpar filtros
              </button>
            </div>
          ) : (
            <>
              <ul className="space-y-4">
                {filteredItems.map((r) => (
                  <ClinicalCard
                    key={r.id}
                    record={r}
                    onUpdated={updateRecord}
                    onDelete={handleDelete}
                  />
                ))}
              </ul>
              {/* M-4: botão "Ver mais", oculto durante filtragem, que atua só sobre a página carregada */}
              {pagination.hasMore && !isFiltering && (
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
