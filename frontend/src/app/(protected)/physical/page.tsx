'use client'

import { type FormEvent, useEffect, useState } from 'react'
import Image from 'next/image'

import { useAuth } from '@/contexts/AuthContext'
import { extractErrorMessage } from '@/lib/api'
import { formatDateTime, getFileUrl } from '@/lib/utils'
import * as physicalService from '@/lib/services/physicalService'
import type { PhysicalResponse } from '@/types'
import { usePagination } from '@/lib/hooks/usePagination'
import AiAnalysisCard from '@/components/ui/AiAnalysisCard'
import PhotoComparisonModal from '@/components/ui/PhotoComparisonModal'
import Button from '@/components/ui/Button'
import FileUpload from '@/components/ui/FileUpload'
import Input from '@/components/ui/Input'
import Spinner from '@/components/ui/Spinner'
import Textarea from '@/components/ui/Textarea'

// ─── card de registro histórico ───────────────────────────────────────────────

function RecordCard({
  record,
  onDelete,
}: {
  record: PhysicalResponse
  onDelete: (id: number) => void
}) {
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const ai = record.ai_analysis as Record<string, unknown> | null

  async function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    setDeleting(true)
    setDeleteError(null)
    try {
      await physicalService.deletePhysical(record.id)
      onDelete(record.id)
    } catch (err) {
      // B-2: exibe erro ao usuário em vez de silenciar
      setDeleteError(extractErrorMessage(err))
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
      <div className="flex items-start gap-3">
        {/* thumbnail */}
        {record.photo_path ? (
          <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl">
            <Image
              src={getFileUrl(record.photo_path)}
              alt="foto"
              fill
              className="object-cover"
              sizes="64px"
            />
          </div>
        ) : (
          <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-7 w-7 text-slate-300">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
          </div>
        )}

        {/* métricas */}
        <div className="min-w-0 flex-1">
          <p className="text-xs text-slate-400">{formatDateTime(record.recorded_at)}</p>
          <div className="mt-1 flex flex-wrap gap-3">
            {record.weight_kg && (
              <Metric label="Peso" value={`${record.weight_kg.toFixed(1)} kg`} />
            )}
            {record.body_fat_pct && (
              <Metric label="Gordura" value={`${record.body_fat_pct.toFixed(1)}%`} />
            )}
            {record.muscle_mass_kg && (
              <Metric label="Músculo" value={`${record.muscle_mass_kg.toFixed(1)} kg`} />
            )}
          </div>
        </div>

        {/* botão de ações com confirmação inline — B-3 */}
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
              aria-label="Remover"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
              </svg>
            </button>
          )}
          {deleteError && (
            <p className="text-xs text-red-500 max-w-[120px] text-right">{deleteError}</p>
          )}
        </div>
      </div>

      {/* M-3: análise ia renderizada pelo AiAnalysisCard ao invés de JSON bruto */}
      {ai && <AiAnalysisCard data={ai} />}

      {record.notes && (
        <p className="mt-2 text-xs text-slate-400 italic">{record.notes}</p>
      )}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-slate-400">{label}</p>
      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{value}</p>
    </div>
  )
}

// ─── página ───────────────────────────────────────────────────────────────────

// B-1: NOW como função lazy no useState para evitar hydration mismatch

export default function PhysicalPage() {
  const { user } = useAuth()

  // M-4: paginação com hook usePagination — substitui estados manuais
  const pagination = usePagination<PhysicalResponse>({
    fetcher: (skip, limit) => physicalService.listPhysical(skip, limit),
    pageSize: 20,
  })

  // form state
  const [recordedAt, setRecordedAt] = useState(() => new Date().toISOString().slice(0, 16))
  const [weightKg, setWeightKg] = useState('')
  const [bodyFatPct, setBodyFatPct] = useState('')
  const [muscleMassKg, setMuscleMassKg] = useState('')
  const [notes, setNotes] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<PhysicalResponse | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    setLastResult(null)
    setSubmitting(true)

    const fd = new FormData()
    fd.append('recorded_at', new Date(recordedAt).toISOString())
    if (weightKg) fd.append('weight_kg', weightKg)
    if (bodyFatPct) fd.append('body_fat_pct', bodyFatPct)
    if (muscleMassKg) fd.append('muscle_mass_kg', muscleMassKg)
    if (notes) fd.append('notes', notes)
    if (photo) fd.append('photo', photo)

    try {
      const created = await physicalService.createPhysical(fd)
      setLastResult(created)
      // M-4: prependItem adiciona sem refetch
      pagination.prependItem(created)
      setWeightKg('')
      setBodyFatPct('')
      setMuscleMassKg('')
      setNotes('')
      setPhoto(null)
    } catch (err) {
      setFormError(extractErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  function handleDelete(id: number) {
    // M-4: removeItem do hook de paginação
    pagination.removeItem((r) => r.id === id)
  }

  const [isCompareOpen, setIsCompareOpen] = useState(false)
  const photoCount = pagination.items.filter((r) => Boolean(r.photo_path)).length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Evolução Física</h1>
        <p className="mt-1 text-sm text-slate-500">
          Registre suas medidas semanais{user?.height_cm ? ` · Altura: ${user.height_cm} cm` : ''}.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[380px_1fr]">
        {/* formulário */}
        <section className="space-y-4">
          <h2 className="font-semibold text-slate-800 dark:text-slate-200">Nova Medição</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <FileUpload
              label="Foto (opcional)"
              accept=".jpg,.jpeg,.png,.webp"
              maxMB={10}
              preview
              onChange={setPhoto}
            />

            <Input
              label="Data e hora"
              type="datetime-local"
              value={recordedAt}
              onChange={(e) => setRecordedAt(e.target.value)}
              required
            />

            <div className="grid grid-cols-3 gap-3">
              <Input
                label="Peso"
                type="number"
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                placeholder="78.5"
                min={20}
                max={500}
                step={0.1}
                helpText="kg"
              />
              <Input
                label="Gordura"
                type="number"
                value={bodyFatPct}
                onChange={(e) => setBodyFatPct(e.target.value)}
                placeholder="18.5"
                min={1}
                max={70}
                step={0.1}
                helpText="%"
              />
              <Input
                label="Músculo"
                type="number"
                value={muscleMassKg}
                onChange={(e) => setMuscleMassKg(e.target.value)}
                placeholder="35.0"
                min={5}
                max={200}
                step={0.1}
                helpText="kg"
              />
            </div>

            <Textarea
              label="Observações"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Como foi a semana? Treinos, alimentação..."
              rows={2}
            />

            {formError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
                {formError}
              </div>
            )}

            <Button type="submit" loading={submitting} className="w-full">
              Salvar medição
            </Button>
          </form>

          {/* resultado da ia após salvar — M-3: AiAnalysisCard ao invés de JSON bruto */}
          {lastResult?.ai_analysis && (
            <div className="rounded-2xl border border-primary-200 bg-primary-50 p-4 dark:border-primary-800/50 dark:bg-primary-900/20">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary-600 dark:text-primary-400">
                Resultado da Análise de IA
              </p>
              <AiAnalysisCard
                data={lastResult.ai_analysis as Record<string, unknown>}
                defaultExpanded
              />
            </div>
          )}
        </section>

        {/* histórico */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <span>Histórico</span>
              {pagination.total > 0 && (
                <span className="text-sm font-normal text-slate-400">({pagination.total})</span>
              )}
            </h2>

            {/* Botão de Comparação de Fotos */}
            {photoCount >= 2 && (
              <button
                onClick={() => setIsCompareOpen(true)}
                className="rounded-xl bg-gradient-to-r from-primary-600 to-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:from-primary-700 hover:to-indigo-700 transition flex items-center gap-1.5"
              >
                <span>📸</span> Comparar Fotos ({photoCount})
              </button>
            )}
          </div>

          {pagination.isLoading ? (
            <div className="flex justify-center py-12">
              <Spinner size="md" className="text-primary-500" />
            </div>
          ) : pagination.error ? (
            <p className="text-sm text-red-500">{pagination.error}</p>
          ) : pagination.items.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 py-12 dark:border-slate-700">
              <p className="text-slate-400">Nenhuma medição ainda</p>
              <p className="mt-1 text-xs text-slate-300">Use o formulário ao lado para começar</p>
            </div>
          ) : (
            <>
              <ul className="space-y-3">
                {pagination.items.map((r) => (
                  <RecordCard key={r.id} record={r} onDelete={handleDelete} />
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

      {/* Modal de Comparação de Fotos */}
      <PhotoComparisonModal
        isOpen={isCompareOpen}
        onClose={() => setIsCompareOpen(false)}
        records={pagination.items}
        userHeightCm={user?.height_cm ?? null}
      />
    </div>
  )
}
