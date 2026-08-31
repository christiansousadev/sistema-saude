'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Image from 'next/image'
import type { PhysicalResponse } from '@/types'
import { formatDateTime, getFileUrl, calcImc } from '@/lib/utils'
import Button from '@/components/ui/Button'

interface PhotoComparisonModalProps {
  isOpen: boolean
  onClose: () => void
  records: PhysicalResponse[]
  userHeightCm: number | null
}

export default function PhotoComparisonModal({
  isOpen,
  onClose,
  records,
  userHeightCm,
}: PhotoComparisonModalProps) {
  // Filtra apenas medições que contenham fotos válidas
  const photoRecords = records.filter((r) => Boolean(r.photo_path))

  // Seleciona a mais antiga como Antes e a mais recente como Depois por padrão
  const [beforeIndex, setBeforeIndex] = useState<number>(() =>
    photoRecords.length > 1 ? photoRecords.length - 1 : 0
  )
  const [afterIndex, setAfterIndex] = useState<number>(0)
  const [viewMode, setViewMode] = useState<'slider' | 'side-by-side'>('slider')
  const [sliderPos, setSliderPos] = useState<number>(50)
  const [isDragging, setIsDragging] = useState<boolean>(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (photoRecords.length > 1) {
      setBeforeIndex(photoRecords.length - 1)
      setAfterIndex(0)
    }
  }, [photoRecords.length])

  const handleMove = useCallback((clientX: number) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width))
    const pct = Math.max(0, Math.min(100, (x / rect.width) * 100))
    setSliderPos(pct)
  }, [])

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (isDragging) handleMove(e.clientX)
    }
    const onTouchMove = (e: TouchEvent) => {
      if (isDragging && e.touches[0]) handleMove(e.touches[0].clientX)
    }
    const onMouseUp = () => setIsDragging(false)
    const onTouchEnd = () => setIsDragging(false)

    if (isDragging) {
      window.addEventListener('mousemove', onMouseMove)
      window.addEventListener('mouseup', onMouseUp)
      window.addEventListener('touchmove', onTouchMove)
      window.addEventListener('touchend', onTouchEnd)
    }
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
    }
  }, [isDragging, handleMove])

  if (!isOpen) return null

  const beforeRec = photoRecords[beforeIndex]
  const afterRec = photoRecords[afterIndex]

  if (!beforeRec || !afterRec) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="w-full max-w-md rounded-2xl bg-[var(--surface)] p-6 shadow-xl text-center space-y-4">
          <p className="text-slate-600 dark:text-slate-300">
            Você precisa de pelo menos duas fotos registradas para comparar a evolução.
          </p>
          <Button onClick={onClose} variant="secondary">
            Fechar
          </Button>
        </div>
      </div>
    )
  }

  // Cálculos de métricas e deltas
  const beforeImc =
    beforeRec.weight_kg && userHeightCm ? calcImc(beforeRec.weight_kg, userHeightCm) : null
  const afterImc =
    afterRec.weight_kg && userHeightCm ? calcImc(afterRec.weight_kg, userHeightCm) : null

  const deltaWeight =
    beforeRec.weight_kg && afterRec.weight_kg
      ? (afterRec.weight_kg - beforeRec.weight_kg).toFixed(1)
      : null
  const deltaFat =
    beforeRec.body_fat_pct && afterRec.body_fat_pct
      ? (afterRec.body_fat_pct - beforeRec.body_fat_pct).toFixed(1)
      : null
  const deltaMuscle =
    beforeRec.muscle_mass_kg && afterRec.muscle_mass_kg
      ? (afterRec.muscle_mass_kg - beforeRec.muscle_mass_kg).toFixed(1)
      : null
  const deltaImc =
    beforeImc && afterImc ? (afterImc - beforeImc).toFixed(1) : null

  const daysBetween = Math.abs(
    Math.round(
      (new Date(afterRec.recorded_at).getTime() - new Date(beforeRec.recorded_at).getTime()) /
        (1000 * 60 * 60 * 24)
    )
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl space-y-6 my-auto max-h-[95vh] flex flex-col">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>📸</span> Comparador Visual de Evolução
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Compare visualmente as fotos de progresso e veja a variação das suas medidas.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 transition"
          >
            ✕
          </button>
        </div>

        {/* Controles de seleção e modo */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl">
          <div>
            <label className="block text-[11px] font-semibold uppercase text-slate-500 mb-1">
              Foto 1 (Antes):
            </label>
            <select
              value={beforeIndex}
              onChange={(e) => setBeforeIndex(Number(e.target.value))}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200"
            >
              {photoRecords.map((r, i) => (
                <option key={r.id} value={i}>
                  {formatDateTime(r.recorded_at)} {r.weight_kg ? `(${r.weight_kg}kg)` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase text-slate-500 mb-1">
              Foto 2 (Depois):
            </label>
            <select
              value={afterIndex}
              onChange={(e) => setAfterIndex(Number(e.target.value))}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200"
            >
              {photoRecords.map((r, i) => (
                <option key={r.id} value={i}>
                  {formatDateTime(r.recorded_at)} {r.weight_kg ? `(${r.weight_kg}kg)` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-1 pt-4 sm:pt-0">
            <button
              onClick={() => setViewMode('slider')}
              className={`rounded-xl px-3 py-2 text-xs font-medium transition ${
                viewMode === 'slider'
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'bg-[var(--surface)] text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              ↔️ Slider Interativo
            </button>
            <button
              onClick={() => setViewMode('side-by-side')}
              className={`rounded-xl px-3 py-2 text-xs font-medium transition ${
                viewMode === 'side-by-side'
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'bg-[var(--surface)] text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              🔲 Lado a Lado
            </button>
          </div>
        </div>

        {/* Visualização de Fotos */}
        <div className="flex-1 min-h-[300px] max-h-[440px] flex items-center justify-center">
          {viewMode === 'slider' ? (
            <div
              ref={containerRef}
              onMouseDown={() => setIsDragging(true)}
              onTouchStart={() => setIsDragging(true)}
              className="relative w-full h-[360px] sm:h-[400px] max-w-lg mx-auto overflow-hidden rounded-2xl border border-[var(--border)] select-none cursor-ew-resize bg-black"
            >
              {/* Imagem Depois (Fundo) */}
              <Image
                src={getFileUrl(afterRec.photo_path!)}
                alt="Depois"
                fill
                className="object-contain"
                sizes="500px"
              />
              <div className="absolute top-3 right-3 bg-black/60 text-white text-[11px] font-semibold px-2.5 py-1 rounded-full backdrop-blur-sm z-10">
                Depois: {formatDateTime(afterRec.recorded_at)}
              </div>

              {/* Imagem Antes (Clipada pelo Slider) */}
              <div
                className="absolute inset-0 overflow-hidden"
                style={{ width: `${sliderPos}%` }}
              >
                <div className="relative w-[512px] h-[400px] sm:w-[512px]">
                  <Image
                    src={getFileUrl(beforeRec.photo_path!)}
                    alt="Antes"
                    fill
                    className="object-contain"
                    sizes="500px"
                  />
                </div>
                <div className="absolute top-3 left-3 bg-black/60 text-white text-[11px] font-semibold px-2.5 py-1 rounded-full backdrop-blur-sm z-10">
                  Antes: {formatDateTime(beforeRec.recorded_at)}
                </div>
              </div>

              {/* Linha e Manopla do Slider */}
              <div
                className="absolute top-0 bottom-0 w-1 bg-white shadow-[0_0_10px_rgba(0,0,0,0.5)] cursor-ew-resize z-20 flex items-center justify-center"
                style={{ left: `${sliderPos}%` }}
              >
                <div className="w-8 h-8 rounded-full bg-white text-slate-800 shadow-lg flex items-center justify-center text-xs font-bold ring-2 ring-primary-500">
                  ↔
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 w-full h-[360px] sm:h-[400px]">
              <div className="relative h-full rounded-2xl overflow-hidden border border-[var(--border)] bg-black">
                <Image
                  src={getFileUrl(beforeRec.photo_path!)}
                  alt="Antes"
                  fill
                  className="object-contain"
                  sizes="400px"
                />
                <div className="absolute top-3 left-3 bg-black/60 text-white text-[11px] font-semibold px-2.5 py-1 rounded-full backdrop-blur-sm">
                  Antes: {formatDateTime(beforeRec.recorded_at)}
                </div>
              </div>
              <div className="relative h-full rounded-2xl overflow-hidden border border-[var(--border)] bg-black">
                <Image
                  src={getFileUrl(afterRec.photo_path!)}
                  alt="Depois"
                  fill
                  className="object-contain"
                  sizes="400px"
                />
                <div className="absolute top-3 right-3 bg-black/60 text-white text-[11px] font-semibold px-2.5 py-1 rounded-full backdrop-blur-sm">
                  Depois: {formatDateTime(afterRec.recorded_at)}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Quadro de Deltas e Variações */}
        <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-[var(--border)] p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Variação entre medições ({daysBetween} dias decorridos)
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <DeltaCard
              label="Peso"
              beforeVal={beforeRec.weight_kg ? `${beforeRec.weight_kg} kg` : '—'}
              afterVal={afterRec.weight_kg ? `${afterRec.weight_kg} kg` : '—'}
              delta={deltaWeight ? `${Number(deltaWeight) > 0 ? '+' : ''}${deltaWeight} kg` : '—'}
              isPositive={deltaWeight ? Number(deltaWeight) <= 0 : null}
            />
            <DeltaCard
              label="% Gordura"
              beforeVal={beforeRec.body_fat_pct ? `${beforeRec.body_fat_pct}%` : '—'}
              afterVal={afterRec.body_fat_pct ? `${afterRec.body_fat_pct}%` : '—'}
              delta={deltaFat ? `${Number(deltaFat) > 0 ? '+' : ''}${deltaFat}%` : '—'}
              isPositive={deltaFat ? Number(deltaFat) <= 0 : null}
            />
            <DeltaCard
              label="Massa Muscular"
              beforeVal={beforeRec.muscle_mass_kg ? `${beforeRec.muscle_mass_kg} kg` : '—'}
              afterVal={afterRec.muscle_mass_kg ? `${afterRec.muscle_mass_kg} kg` : '—'}
              delta={deltaMuscle ? `${Number(deltaMuscle) > 0 ? '+' : ''}${deltaMuscle} kg` : '—'}
              isPositive={deltaMuscle ? Number(deltaMuscle) >= 0 : null}
            />
            <DeltaCard
              label="IMC"
              beforeVal={beforeImc ? beforeImc.toFixed(1) : '—'}
              afterVal={afterImc ? afterImc.toFixed(1) : '—'}
              delta={deltaImc ? `${Number(deltaImc) > 0 ? '+' : ''}${deltaImc}` : '—'}
              isPositive={deltaImc ? Number(deltaImc) <= 0 : null}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function DeltaCard({
  label,
  beforeVal,
  afterVal,
  delta,
  isPositive,
}: {
  label: string
  beforeVal: string
  afterVal: string
  delta: string
  isPositive: boolean | null
}) {
  return (
    <div className="rounded-xl bg-[var(--surface)] p-3 border border-[var(--border)]">
      <p className="text-[10px] uppercase font-semibold text-slate-400">{label}</p>
      <div className="flex items-baseline justify-between mt-1">
        <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{afterVal}</span>
        <span
          className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
            isPositive === true
              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
              : isPositive === false
              ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
              : 'text-slate-500'
          }`}
        >
          {delta}
        </span>
      </div>
      <p className="text-[10px] text-slate-400 mt-1">Antes: {beforeVal}</p>
    </div>
  )
}
