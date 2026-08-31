'use client'

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { formatDate } from '@/lib/utils'
import type { ClinicalMarker, ClinicalResponse } from '@/types'

// ─── tipos internos ───────────────────────────────────────────────────────────

interface DataPoint {
  dateLabel: string
  total: number | null
  hdl: number | null
  ldl: number | null
  trig: number | null
}

export interface CholesterolChartProps {
  records: ClinicalResponse[]
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

// ─── normaliza nome do marcador para match flexível ───────────────────────────

const MARKER_KEYS: Record<string, keyof Omit<DataPoint, 'dateLabel'>> = {
  'colesterol total': 'total',
  colesterol: 'total',
  hdl: 'hdl',
  ldl: 'ldl',
  triglicerideos: 'trig',
  triglicérides: 'trig',
}

function resolveKey(name: string): keyof Omit<DataPoint, 'dateLabel'> | null {
  const normalized = name.toLowerCase().trim()
  for (const [pattern, key] of Object.entries(MARKER_KEYS)) {
    if (normalized.includes(pattern)) return key
  }
  return null
}

function parseValue(v: string | number): number | null {
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'))
  return isNaN(n) ? null : n
}

// ─── PREPARA PONTOS DE DADOS ──────────────────────────────────────────────────

function buildPoints(records: ClinicalResponse[]): DataPoint[] {
  return [...records]
    .filter((r) => r.extracted_data?.markers?.length)
    .sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime())
    .map((r) => {
      const point: DataPoint = { dateLabel: formatDate(r.recorded_at), total: null, hdl: null, ldl: null, trig: null }
      const markers = r.extracted_data?.markers as ClinicalMarker[] | undefined
      markers?.forEach((m) => {
        const key = resolveKey(m.name)
        if (key) point[key] = parseValue(m.value)
      })
      return point
    })
    .filter((p) => p.total !== null || p.hdl !== null || p.ldl !== null || p.trig !== null)
}

// ─── tooltip personalizado ────────────────────────────────────────────────────

const LINE_META: Record<string, { label: string; color: string; unit: string }> = {
  total: { label: 'Total', color: '#64748b', unit: 'mg/dL' },
  hdl: { label: 'HDL', color: '#22c55e', unit: 'mg/dL' },
  ldl: { label: 'LDL', color: '#ef4444', unit: 'mg/dL' },
  trig: { label: 'Triglicerídeos', color: '#f59e0b', unit: 'mg/dL' },
}

function ChartTooltip({ active, payload, label }: TooltipPayload) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-white/20 bg-white/70 px-4 py-3 shadow-xl backdrop-blur-md dark:border-slate-700/50 dark:bg-slate-900/80">
      <p className="mb-2 text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</p>
      <div className="space-y-1.5">
        {payload.map((entry) => {
          const meta = LINE_META[entry.dataKey]
          return (
            <div key={entry.dataKey} className="flex items-center justify-between gap-4 text-sm">
              <div className="flex items-center gap-2">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full shadow-sm"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="font-medium text-slate-600 dark:text-slate-300">{meta?.label ?? entry.dataKey}</span>
              </div>
              <span className="font-bold text-slate-900 dark:text-white">
                {entry.value != null ? Number(entry.value).toFixed(0) : '—'}
                <span className="ml-0.5 text-xs font-normal text-slate-400">{meta?.unit ?? ''}</span>
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────

export default function CholesterolChart({ records, className = '' }: CholesterolChartProps) {
  const data = buildPoints(records)

  if (!data.length) {
    return (
      <div className={`flex items-center justify-center py-10 ${className}`}>
        <p className="text-sm text-slate-400">Nenhum dado lipídico encontrado nos exames</p>
      </div>
    )
  }

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" strokeOpacity={0.5} vertical={false} />
          
          <defs>
            <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
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

          <YAxis
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${v}`}
            width={40}
          />

          <Tooltip content={<ChartTooltip />} />

          <Legend
            wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
            formatter={(value) => (
              <span className="text-slate-600 dark:text-slate-400">
                {LINE_META[value]?.label ?? value}
              </span>
            )}
          />

          {/* linhas de referência dos limites desejáveis */}
          <ReferenceLine
            y={200}
            stroke="#64748b"
            strokeDasharray="4 3"
            label={{ value: 'Total 200', position: 'insideTopRight', fontSize: 10, fill: '#94a3b8' }}
          />
          <ReferenceLine
            y={150}
            stroke="#f59e0b"
            strokeDasharray="4 3"
            label={{ value: 'Trig 150', position: 'insideTopRight', fontSize: 10, fill: '#94a3b8' }}
          />
          <ReferenceLine
            y={130}
            stroke="#ef4444"
            strokeDasharray="4 3"
            label={{ value: 'LDL 130', position: 'insideTopRight', fontSize: 10, fill: '#94a3b8' }}
          />

          <Line
            type="monotone"
            dataKey="total"
            name="total"
            stroke={LINE_META.total.color}
            strokeWidth={3}
            dot={{ r: 4, fill: '#fff', stroke: LINE_META.total.color, strokeWidth: 2 }}
            activeDot={{ r: 6, strokeWidth: 0 }}
            connectNulls
            filter="url(#shadow)"
          />
          <Line
            type="monotone"
            dataKey="hdl"
            name="hdl"
            stroke={LINE_META.hdl.color}
            strokeWidth={3}
            dot={{ r: 4, fill: '#fff', stroke: LINE_META.hdl.color, strokeWidth: 2 }}
            activeDot={{ r: 6, strokeWidth: 0 }}
            connectNulls
            filter="url(#shadow)"
          />
          <Line
            type="monotone"
            dataKey="ldl"
            name="ldl"
            stroke={LINE_META.ldl.color}
            strokeWidth={3}
            dot={{ r: 4, fill: '#fff', stroke: LINE_META.ldl.color, strokeWidth: 2 }}
            activeDot={{ r: 6, strokeWidth: 0 }}
            connectNulls
            filter="url(#shadow)"
          />
          <Line
            type="monotone"
            dataKey="trig"
            name="trig"
            stroke={LINE_META.trig.color}
            strokeWidth={3}
            dot={{ r: 4, fill: '#fff', stroke: LINE_META.trig.color, strokeWidth: 2 }}
            activeDot={{ r: 6, strokeWidth: 0 }}
            connectNulls
            filter="url(#shadow)"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
