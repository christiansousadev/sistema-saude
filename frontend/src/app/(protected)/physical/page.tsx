'use client'

import { type FormEvent, memo, useCallback, useState } from 'react'
import Image from 'next/image'
import { Camera, ImageOff, Scale, Trash2 } from 'lucide-react'

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

// ─── badge translúcida de métrica ─────────────────────────────────────────────

function MetricBadge({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent: 'sky' | 'emerald' | 'amber' | 'rose'
}) {
  const styles = {
    sky: 'border-sky-500/20 bg-sky-500/10 text-sky-300',
    emerald: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
    amber: 'border-amber-500/20 bg-amber-500/10 text-amber-300',
    rose: 'border-rose-500/20 bg-rose-500/10 text-rose-300',
  }
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${styles[accent]}`}>
      <span className="text-slate-400">{label}:&nbsp;</span>
      {value}
    </span>
  )
}

// ─── card de registro histórico ───────────────────────────────────────────────
// memo evita re-render de toda a lista a cada tecla digitada no formulário ao lado

const RecordCard = memo(function RecordCard({
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
    <div className="rounded-2xl border border-white/[0.06] bg-slate-900/60 p-4 shadow-sm">
      <div className="flex items-start gap-3">
        {/* thumbnail principal e adicionais */}
        <div className="flex gap-1.5 flex-shrink-0">
          {record.photo_path ? (
            <div className="relative h-16 w-16 overflow-hidden rounded-xl">
              <Image
                src={getFileUrl(record.photo_path)}
                alt="foto frontal"
                fill
                className="object-cover"
                sizes="64px"
              />
            </div>
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-white/[0.04]">
              <ImageOff className="h-6 w-6 text-slate-600" strokeWidth={1.5} />
            </div>
          )}
          {record.photo_back_path && (
            <div className="relative h-16 w-12 overflow-hidden rounded-xl border border-white/10 hidden sm:block" title="Costas">
              <Image
                src={getFileUrl(record.photo_back_path)}
                alt="foto costas"
                fill
                className="object-cover"
                sizes="48px"
              />
            </div>
          )}
          {record.photo_side_path && (
            <div className="relative h-16 w-12 overflow-hidden rounded-xl border border-white/10 hidden sm:block" title="Perfil">
              <Image
                src={getFileUrl(record.photo_side_path)}
                alt="foto perfil"
                fill
                className="object-cover"
                sizes="48px"
              />
            </div>
          )}
        </div>

        {/* métricas */}
        <div className="min-w-0 flex-1">
          <p className="text-xs text-slate-500">{formatDateTime(record.recorded_at)}</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {record.weight_kg && (
              <MetricBadge label="Peso" value={`${record.weight_kg.toFixed(1)} kg`} accent="sky" />
            )}
            {record.body_fat_pct && (
              <MetricBadge label="Gordura" value={`${record.body_fat_pct.toFixed(1)}%`} accent="amber" />
            )}
            {record.muscle_mass_kg && (
              <MetricBadge label="Músculo" value={`${record.muscle_mass_kg.toFixed(1)} kg`} accent="emerald" />
            )}
            {record.waist_cm && (
              <MetricBadge label="Cintura" value={`${record.waist_cm.toFixed(1)} cm`} accent="sky" />
            )}
            {record.hip_cm && (
              <MetricBadge label="Quadril" value={`${record.hip_cm.toFixed(1)} cm`} accent="sky" />
            )}
            {record.waist_to_hip_ratio && (
              <MetricBadge
                label="RCQ"
                value={`${record.waist_to_hip_ratio.toFixed(2)}`}
                accent={record.cardiovascular_risk === 'elevado' ? 'rose' : record.cardiovascular_risk === 'moderado' ? 'amber' : 'emerald'}
              />
            )}
            {record.waist_to_height_ratio && (
              <MetricBadge
                label="RCEst"
                value={`${record.waist_to_height_ratio.toFixed(2)}`}
                accent={record.cardiovascular_risk === 'elevado' ? 'rose' : record.cardiovascular_risk === 'moderado' ? 'amber' : 'emerald'}
              />
            )}
            {record.cardiovascular_risk && (
              <MetricBadge
                label="Risco"
                value={record.cardiovascular_risk}
                accent={record.cardiovascular_risk === 'elevado' ? 'rose' : record.cardiovascular_risk === 'moderado' ? 'amber' : 'emerald'}
              />
            )}
          </div>
        </div>

        {/* botão de exclusão minimalista com confirmação inline (B-3) */}
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
              aria-label="Remover medição"
            >
              <Trash2 className="h-4 w-4" strokeWidth={1.75} />
            </button>
          )}
          {deleteError && (
            <p className="text-xs text-rose-400 max-w-[120px] text-right">{deleteError}</p>
          )}
        </div>
      </div>

      {/* M-3: análise ia renderizada pelo AiAnalysisCard ao invés de JSON bruto */}
      {ai && <AiAnalysisCard data={ai} />}

      {record.notes && (
        <p className="mt-2 text-xs text-slate-500 italic">{record.notes}</p>
      )}
    </div>
  )
})

// ─── formulário de nova medição ────────────────────────────────────────────────
// isolado em componente próprio: o estado do formulário fica fora de PhysicalPage,
// então digitar aqui não re-renderiza a lista de histórico ao lado

function NewMeasurementForm({
  onCreated,
}: {
  onCreated: (record: PhysicalResponse) => void
}) {
  const [recordedAt, setRecordedAt] = useState(() => new Date().toISOString().slice(0, 16))
  const [weightKg, setWeightKg] = useState('')
  const [bodyFatPct, setBodyFatPct] = useState('')
  const [muscleMassKg, setMuscleMassKg] = useState('')
  const [waistCm, setWaistCm] = useState('')
  const [hipCm, setHipCm] = useState('')
  const [chestCm, setChestCm] = useState('')
  const [armCm, setArmCm] = useState('')
  const [thighCm, setThighCm] = useState('')
  const [neckCm, setNeckCm] = useState('')
  const [notes, setNotes] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoBack, setPhotoBack] = useState<File | null>(null)
  const [photoSide, setPhotoSide] = useState<File | null>(null)
  const [showCircumferences, setShowCircumferences] = useState(false)
  const [showExtraPhotos, setShowExtraPhotos] = useState(false)
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
    if (waistCm) fd.append('waist_cm', waistCm)
    if (hipCm) fd.append('hip_cm', hipCm)
    if (chestCm) fd.append('chest_cm', chestCm)
    if (armCm) fd.append('arm_cm', armCm)
    if (thighCm) fd.append('thigh_cm', thighCm)
    if (neckCm) fd.append('neck_cm', neckCm)
    if (notes) fd.append('notes', notes)
    if (photo) fd.append('photo', photo)
    if (photoBack) fd.append('photo_back', photoBack)
    if (photoSide) fd.append('photo_side', photoSide)

    try {
      const created = await physicalService.createPhysical(fd)
      setLastResult(created)
      onCreated(created)
      setWeightKg('')
      setBodyFatPct('')
      setMuscleMassKg('')
      setWaistCm('')
      setHipCm('')
      setChestCm('')
      setArmCm('')
      setThighCm('')
      setNeckCm('')
      setNotes('')
      setPhoto(null)
      setPhotoBack(null)
      setPhotoSide(null)
    } catch (err) {
      setFormError(extractErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-white/[0.06] bg-slate-900/60 p-5 shadow-sm">
      <h2 className="flex items-center gap-2 font-semibold text-white">
        <Scale className="h-4 w-4 text-sky-400" strokeWidth={2} />
        Nova medição
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <FileUpload
          label="Foto frontal (opcional)"
          accept=".jpg,.jpeg,.png,.webp"
          maxMB={10}
          preview
          onChange={setPhoto}
        />

        {/* fotos adicionais com toggle */}
        <div>
          <button
            type="button"
            onClick={() => setShowExtraPhotos(!showExtraPhotos)}
            className="text-xs font-medium text-sky-400 hover:text-sky-300 transition flex items-center gap-1"
          >
            {showExtraPhotos ? '− Ocultar fotos adicionais' : '+ Adicionar fotos (Costas e Perfil)'}
          </button>
          {showExtraPhotos && (
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl border border-white/[0.06] bg-white/[0.02]">
              <FileUpload
                label="Foto de Costas"
                accept=".jpg,.jpeg,.png,.webp"
                maxMB={10}
                preview
                onChange={setPhotoBack}
              />
              <FileUpload
                label="Foto de Perfil"
                accept=".jpg,.jpeg,.png,.webp"
                maxMB={10}
                preview
                onChange={setPhotoSide}
              />
            </div>
          )}
        </div>

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

        {/* secao expansivel de circunferencias */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Circunferências Corporais
            </span>
            <button
              type="button"
              onClick={() => setShowCircumferences(!showCircumferences)}
              className="text-xs font-medium text-sky-400 hover:text-sky-300"
            >
              {showCircumferences ? 'Ocultar' : 'Expandir (Cintura, Quadril...)'}
            </button>
          </div>

          {showCircumferences && (
            <div className="mt-3 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Cintura"
                  type="number"
                  value={waistCm}
                  onChange={(e) => setWaistCm(e.target.value)}
                  placeholder="82.0"
                  step={0.5}
                  helpText="cm"
                />
                <Input
                  label="Quadril"
                  type="number"
                  value={hipCm}
                  onChange={(e) => setHipCm(e.target.value)}
                  placeholder="98.0"
                  step={0.5}
                  helpText="cm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Tórax"
                  type="number"
                  value={chestCm}
                  onChange={(e) => setChestCm(e.target.value)}
                  placeholder="100.0"
                  step={0.5}
                  helpText="cm"
                />
                <Input
                  label="Braço"
                  type="number"
                  value={armCm}
                  onChange={(e) => setArmCm(e.target.value)}
                  placeholder="36.0"
                  step={0.5}
                  helpText="cm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Coxa"
                  type="number"
                  value={thighCm}
                  onChange={(e) => setThighCm(e.target.value)}
                  placeholder="58.0"
                  step={0.5}
                  helpText="cm"
                />
                <Input
                  label="Pescoço"
                  type="number"
                  value={neckCm}
                  onChange={(e) => setNeckCm(e.target.value)}
                  placeholder="38.0"
                  step={0.5}
                  helpText="cm"
                />
              </div>
            </div>
          )}
        </div>

        <Textarea
          label="Observações"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Como foi a semana? Treinos, alimentação..."
          rows={2}
        />

        {formError && (
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
            {formError}
          </div>
        )}

        <Button type="submit" loading={submitting} className="w-full">
          Salvar medição
        </Button>
      </form>

      {/* resultado da ia após salvar (M-3): AiAnalysisCard ao invés de JSON bruto */}
      {lastResult?.ai_analysis && (
        <div className="rounded-2xl border border-sky-500/20 bg-sky-500/[0.06] p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-sky-300">
            Resultado da análise de IA
          </p>
          <AiAnalysisCard
            data={lastResult.ai_analysis as Record<string, unknown>}
            defaultExpanded
          />
        </div>
      )}
    </section>
  )
}

// ─── stat de resumo no cabeçalho ───────────────────────────────────────────────

function HeaderStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-0.5 text-lg font-bold tracking-tight text-white">{value}</p>
    </div>
  )
}

// ─── página ───────────────────────────────────────────────────────────────────

// B-1: NOW como função lazy no useState para evitar hydration mismatch

export default function PhysicalPage() {
  const { user } = useAuth()

  // M-4: paginação com hook usePagination, substitui estados manuais
  const pagination = usePagination<PhysicalResponse>({
    fetcher: (skip, limit) => physicalService.listPhysical(skip, limit),
    pageSize: 20,
  })

  // identidade estável evita que RecordCard memoizado re-renderize à toa
  const handleCreated = useCallback(
    (created: PhysicalResponse) => pagination.prependItem(created),
    [pagination.prependItem],
  )
  const handleDelete = useCallback(
    (id: number) => pagination.removeItem((r) => r.id === id),
    [pagination.removeItem],
  )

  const [isCompareOpen, setIsCompareOpen] = useState(false)
  const photoCount = pagination.items.filter((r) => Boolean(r.photo_path)).length
  const latestWeight = pagination.items[0]?.weight_kg

  return (
    <div className="space-y-6 pb-6">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/10 text-sky-400">
            <Scale className="h-5 w-5" strokeWidth={2} />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Evolução física</h1>
            <p className="text-sm text-slate-400">
              Registre suas medidas semanais{user?.height_cm ? ` · altura ${user.height_cm} cm` : ''}
            </p>
          </div>
        </div>

        {/* estatísticas de resumo */}
        <div className="flex flex-wrap gap-3">
          <HeaderStat label="Registros" value={String(pagination.total)} />
          <HeaderStat label="Peso atual" value={latestWeight ? `${latestWeight.toFixed(1)} kg` : '—'} />
          <HeaderStat label="Fotos" value={String(photoCount)} />
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[380px_1fr]">
        <NewMeasurementForm onCreated={handleCreated} />

        {/* histórico */}
        <section>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold text-white flex items-center gap-2">
              <span>Histórico</span>
              {pagination.total > 0 && (
                <span className="text-sm font-normal text-slate-500">({pagination.total})</span>
              )}
            </h2>

            {/* botão de comparação de fotos */}
            {photoCount >= 2 && (
              <button
                onClick={() => setIsCompareOpen(true)}
                className="flex min-h-11 items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-sky-500/30 hover:bg-white/10"
              >
                <Camera className="h-3.5 w-3.5 text-sky-400" strokeWidth={2} />
                Comparar fotos ({photoCount})
              </button>
            )}
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
                <Scale className="h-4 w-4" strokeWidth={2} />
              </span>
              <p className="text-slate-400">Nenhuma medição ainda</p>
              <p className="text-xs text-slate-500">Use o formulário ao lado para começar</p>
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

      {/* modal de comparação de fotos */}
      <PhotoComparisonModal
        isOpen={isCompareOpen}
        onClose={() => setIsCompareOpen(false)}
        records={pagination.items}
        userHeightCm={user?.height_cm ?? null}
      />
    </div>
  )
}
