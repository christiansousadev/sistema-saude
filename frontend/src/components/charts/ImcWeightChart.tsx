'use client'

import {
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { calcImc, formatDate } from '@/lib/utils'
import type { PhysicalResponse } from '@/types'

// ─── tipos internos ───────────────────────────────────────────────────────────

interface DataPoint {
  date: string
  dateLabel: string
  peso: number | null
  imc: number | null
}

export interface ImcWeightChartProps {
  records: PhysicalResponse[]
  heightCm: number | null
  className?: string
}

interface TooltipEntry {
  dataKey: string
  name: string
  value: number | null
  color: string
}

interface TooltipPayload {
  active?: boolean
  payload?: TooltipEntry[]
  label?: string
}

// ─── tooltip personalizado ────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: TooltipPayload) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-white/20 bg-white/70 px-4 py-3 shadow-xl backdrop-blur-md dark:border-slate-700/50 dark:bg-slate-900/80">
      <p className="mb-2 text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</p>
      <div className="space-y-1.5">
        {payload.map((entry) => (
          <div key={entry.dataKey} className="flex items-center justify-between gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full shadow-sm"
                style={{ backgroundColor: entry.color }}
              />
              <span className="font-medium text-slate-600 dark:text-slate-300">{entry.name}</span>
            </div>
            <span className="font-bold text-slate-900 dark:text-white">
              {entry.value != null ? Number(entry.value).toFixed(1) : '—'}
              <span className="ml-0.5 text-xs font-normal text-slate-400">
                {entry.dataKey === 'peso' ? 'kg' : ''}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── PREPARA PONTOS DE DADOS ──────────────────────────────────────────────────

function buildPoints(records: PhysicalResponse[], heightCm: number | null): DataPoint[] {
  return [...records]
    .sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime())
    .map((r) => ({
      date: r.recorded_at,
      dateLabel: formatDate(r.recorded_at),
      peso: r.weight_kg ?? null,
      imc:
        r.weight_kg && heightCm ? Number(calcImc(r.weight_kg, heightCm).toFixed(1)) : null,
    }))
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────

export default function ImcWeightChart({ records, heightCm, className = '' }: ImcWeightChartProps) {
  const data = buildPoints(records, heightCm)
  const hasData = data.some((d) => d.peso !== null)

  if (!hasData) {
    return (
      <div className={`flex items-center justify-center py-10 ${className}`}>
        <p className="text-sm text-slate-400">Nenhuma medição registrada ainda</p>
      </div>
    )
  }

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={data} margin={{ top: 8, right: 24, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" strokeOpacity={0.5} vertical={false} />
          <defs>
            <filter id="shadow-imc" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#000" floodOpacity="0.05"/>
            </filter>
          </defs>

          <XAxis
            dataKey="dateLabel"
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />

          {/* eixo esquerdo: peso */}
          <YAxis
            yAxisId="peso"
            orientation="left"
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${v} kg`}
            width={56}
          />

          {/* eixo direito: imc */}
          <YAxis
            yAxisId="imc"
            orientation="right"
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            tickLine={false}
            axisLine={false}
            domain={[14, 42]}
            width={36}
          />

          <Tooltip content={<ChartTooltip />} />

          <Legend
            wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
            formatter={(value) => (
              <span className="text-slate-600 dark:text-slate-400">{value}</span>
            )}
          />

          {/* faixas de referência de imc */}
          {heightCm && (
            <>
              <ReferenceLine
                yAxisId="imc"
                y={18.5}
                stroke="#93c5fd"
                strokeDasharray="4 3"
                label={{ value: '18.5', position: 'right', fontSize: 10, fill: '#93c5fd' }}
              />
              <ReferenceLine
                yAxisId="imc"
                y={25}
                stroke="#86efac"
                strokeDasharray="4 3"
                label={{ value: '25', position: 'right', fontSize: 10, fill: '#86efac' }}
              />
              <ReferenceLine
                yAxisId="imc"
                y={30}
                stroke="#fde68a"
                strokeDasharray="4 3"
                label={{ value: '30', position: 'right', fontSize: 10, fill: '#fde68a' }}
              />
            </>
          )}

          <Line
            yAxisId="peso"
            type="monotone"
            dataKey="peso"
            name="Peso"
            stroke="#3b82f6"
            strokeWidth={3}
            dot={{ r: 4, fill: '#fff', stroke: '#3b82f6', strokeWidth: 2 }}
            activeDot={{ r: 6, strokeWidth: 0 }}
            connectNulls
            filter="url(#shadow-imc)"
          />

          {heightCm && (
            <Line
              yAxisId="imc"
              type="monotone"
              dataKey="imc"
              name="IMC"
              stroke="#8b5cf6"
              strokeWidth={3}
              dot={{ r: 4, fill: '#fff', stroke: '#8b5cf6', strokeWidth: 2 }}
              activeDot={{ r: 6, strokeWidth: 0 }}
              connectNulls
              filter="url(#shadow-imc)"
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
