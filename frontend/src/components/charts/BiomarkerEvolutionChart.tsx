'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Activity, AlertTriangle, CheckCircle, ChevronDown, Sparkles } from 'lucide-react'

import { getBiomarkerTimeline } from '@/lib/services/clinicalService'
import type { BiomarkerTimelineItem } from '@/types'
import { Skeleton } from '@/components/ui/Skeleton'

// PARSEIA RANGE DE REFERENCIA COMO [MIN, MAX] OU MAX ISOLADO
function parseRefRange(refStr: string | null): { min?: number; max?: number } {
  if (!refStr) return {}
  const clean = refStr.replace(/\./g, '').replace(/,/g, '.')
  
  // match "70 - 99" ou "70 – 99"
  const rangeMatch = clean.match(/(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)/)
  if (rangeMatch) {
    return { min: parseFloat(rangeMatch[1]), max: parseFloat(rangeMatch[2]) }
  }
  
  // match "< 130" ou "<= 130"
  const maxMatch = clean.match(/[<≤]\s*(\d+(?:\.\d+)?)/)
  if (maxMatch) {
    return { max: parseFloat(maxMatch[1]) }
  }
  
  // match "> 50" ou ">= 50"
  const minMatch = clean.match(/[>≥]\s*(\d+(?:\.\d+)?)/)
  if (minMatch) {
    return { min: parseFloat(minMatch[1]) }
  }

  return {}
}

export default function BiomarkerEvolutionChart() {
  const [items, setItems] = useState<BiomarkerTimelineItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedName, setSelectedName] = useState<string>('')

  useEffect(() => {
    let isMounted = true
    async function load() {
      try {
        const res = await getBiomarkerTimeline()
        if (isMounted) {
          setItems(res.biomarkers)
          if (res.biomarkers.length > 0) {
            // prioriza glicemia ou primeiro biomarker com mais pontos
            const preferred =
              res.biomarkers.find((b) => b.name.toLowerCase().includes('glicem')) ||
              res.biomarkers.reduce((prev, curr) =>
                curr.data_points.length > prev.data_points.length ? curr : prev
              )
            setSelectedName(preferred.name)
          }
        }
      } catch {
        // falha silenciosa, tela exibira estado vazio
      } finally {
        if (isMounted) setLoading(false)
      }
    }
    load()
    return () => {
      isMounted = false
    }
  }, [])

  const selectedBiomarker = useMemo(() => {
    return items.find((b) => b.name === selectedName) || null
  }, [items, selectedName])

  const chartData = useMemo(() => {
    if (!selectedBiomarker) return []
    return selectedBiomarker.data_points.map((dp) => ({
      date: dp.date.split('-').reverse().slice(0, 2).join('/'),
      fullDate: dp.date,
      value: dp.value,
      status: dp.status,
      unit: dp.unit || selectedBiomarker.unit,
      reference: dp.reference_range || selectedBiomarker.reference_range,
    }))
  }, [selectedBiomarker])

  const refBounds = useMemo(() => {
    return parseRefRange(selectedBiomarker?.reference_range || null)
  }, [selectedBiomarker])

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/[0.06] bg-slate-900/60 p-6 shadow-sm">
        <Skeleton className="h-6 w-48 mb-4 rounded-lg" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-white/[0.06] bg-slate-900/60 p-8 text-center shadow-sm">
        <Activity className="mx-auto h-10 w-10 text-slate-600 mb-3" />
        <h3 className="font-semibold text-white">Nenhum biomarcador com histórico</h3>
        <p className="mt-1 text-sm text-slate-400">
          Envie seus exames laboratoriais na aba clínica para visualizar curvas longitudinais de glicemia, colesterol, vitaminas e mais.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-slate-900/60 p-6 shadow-sm backdrop-blur-sm">
      {/* cabecalho com seletor e metricas */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-white/[0.06]">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500/10 text-sky-400">
              <Activity className="h-4 w-4" />
            </span>
            <h3 className="text-base font-bold text-white">Evolução por Biomarcador</h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Acompanhe o comportamento temporal com as faixas de referência laboratoriais.
          </p>
        </div>

        {/* seletor de analito */}
        <div className="relative min-w-[220px]">
          <select
            value={selectedName}
            onChange={(e) => setSelectedName(e.target.value)}
            className="w-full appearance-none rounded-xl border border-white/10 bg-slate-800/80 px-3.5 py-2 pr-9 text-sm font-medium text-white shadow-sm transition hover:border-white/20 focus:border-sky-500 focus:outline-none"
          >
            {items.map((b) => (
              <option key={b.name} value={b.name} className="bg-slate-900 text-white">
                {b.name} ({b.data_points.length} {b.data_points.length === 1 ? 'reg.' : 'regs.'})
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        </div>
      </div>

      {/* cards de status do marcador selecionado */}
      {selectedBiomarker && (
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-3">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Último Valor</span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-xl font-bold text-white">{selectedBiomarker.latest_value}</span>
              <span className="text-xs text-slate-400">{selectedBiomarker.unit}</span>
            </div>
          </div>

          <div className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-3">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Referência</span>
            <div className="mt-1 text-sm font-medium text-slate-300 truncate" title={selectedBiomarker.reference_range || 'Não informada'}>
              {selectedBiomarker.reference_range || 'Padrão'}
            </div>
          </div>

          <div className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-3">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Status Atual</span>
            <div className="mt-1 flex items-center gap-1.5">
              {selectedBiomarker.latest_status === 'normal' ? (
                <>
                  <CheckCircle className="h-4 w-4 text-emerald-400" />
                  <span className="text-xs font-semibold text-emerald-400">Normal</span>
                </>
              ) : selectedBiomarker.latest_status ? (
                <>
                  <AlertTriangle className="h-4 w-4 text-amber-400" />
                  <span className="text-xs font-semibold text-amber-400 capitalize">
                    {selectedBiomarker.latest_status}
                  </span>
                </>
              ) : (
                <span className="text-xs text-slate-400">Sem status</span>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-3">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Categoria</span>
            <div className="mt-1 text-xs font-semibold text-sky-400">
              {selectedBiomarker.category || 'Geral'}
            </div>
          </div>
        </div>
      )}

      {/* grafico recharts */}
      <div className="mt-6 h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 15, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis
              dataKey="date"
              stroke="#64748b"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
            />
            <YAxis
              stroke="#64748b"
              fontSize={11}
              tickLine={false}
              domain={['auto', 'auto']}
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const d = payload[0].payload
                return (
                  <div className="rounded-xl border border-white/10 bg-slate-900/90 p-3 shadow-xl backdrop-blur-md text-xs">
                    <p className="font-semibold text-slate-300">{d.fullDate}</p>
                    <p className="mt-1 text-sm font-bold text-sky-400">
                      {d.value} {d.unit}
                    </p>
                    {d.reference && (
                      <p className="mt-1 text-[11px] text-slate-400">Ref: {d.reference}</p>
                    )}
                    {d.status && (
                      <span
                        className={`mt-1.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          d.status === 'normal'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-amber-500/20 text-amber-300'
                        }`}
                      >
                        {d.status}
                      </span>
                    )}
                  </div>
                )
              }}
            />

            {/* area verde de referencia ideal caso haja min e max */}
            {refBounds.min !== undefined && refBounds.max !== undefined && (
              <ReferenceArea
                y1={refBounds.min}
                y2={refBounds.max}
                fill="#10b981"
                fillOpacity={0.07}
              />
            )}

            {/* linha de limite superior se for referencia tipo < 130 */}
            {refBounds.max !== undefined && refBounds.min === undefined && (
              <ReferenceLine
                y={refBounds.max}
                stroke="#10b981"
                strokeDasharray="4 4"
                label={{ value: `Teto: ${refBounds.max}`, fill: '#10b981', fontSize: 10, position: 'right' }}
              />
            )}

            <Line
              type="monotone"
              dataKey="value"
              stroke="#38bdf8"
              strokeWidth={3}
              dot={{ r: 5, fill: '#0284c7', stroke: '#38bdf8', strokeWidth: 2 }}
              activeDot={{ r: 7, fill: '#38bdf8', stroke: '#ffffff', strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
