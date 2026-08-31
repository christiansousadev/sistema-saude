'use client'

import { useState } from 'react'

/**
 * M-3: Renderiza a análise de IA de forma legível ao invés de JSON bruto.
 *
 * Suporta os formatos retornados pelos serviços de IA do sistema:
 * - Análise física: campos summary, body_fat_pct, muscle_mass_kg, recommendations[], etc.
 * - Análise clínica: campos summary, markers[], risk_level, etc.
 * - Fallback: renderiza pares chave/valor para qualquer campo desconhecido.
 */

interface AiAnalysisCardProps {
  data: Record<string, unknown>
  defaultExpanded?: boolean
}

// campos que aparecem como seção de texto longa (renderizados em parágrafo)
const TEXT_FIELDS = ['summary', 'observation', 'analysis', 'interpretation', 'conclusion']

// campos que são listas de strings (renderizados como bullets)
const LIST_FIELDS = ['recommendations', 'warnings', 'alerts', 'improvements']

// campos de status/risco com badge colorido
const STATUS_COLORS: Record<string, string> = {
  low:       'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  normal:    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  moderate:  'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  high:      'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  critical:  'bg-red-200 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  unknown:   'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
}

function StatusBadge({ value }: { value: string }) {
  const normalized = value.toLowerCase()
  const colorClass = STATUS_COLORS[normalized] ?? STATUS_COLORS.unknown
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${colorClass}`}>
      {value}
    </span>
  )
}

function MarkerRow({ marker }: {
  marker: { name: string; value: string | number; unit?: string; status?: string | null; reference_range?: string }
}) {
  const statusColor =
    marker.status === 'high' || marker.status === 'critical' ? 'text-red-500' :
    marker.status === 'low' ? 'text-yellow-500' :
    marker.status === 'normal' ? 'text-green-600' : 'text-slate-500'

  return (
    <div className="flex items-center justify-between gap-2 py-1 text-xs border-b border-[var(--border)] last:border-0">
      <span className="text-slate-700 dark:text-slate-300 font-medium">{marker.name}</span>
      <div className="flex items-center gap-2">
        {marker.reference_range && (
          <span className="text-slate-400">ref: {marker.reference_range}</span>
        )}
        <span className={`font-semibold ${statusColor}`}>
          {marker.value}{marker.unit ? ` ${marker.unit}` : ''}
        </span>
      </div>
    </div>
  )
}

export default function AiAnalysisCard({ data, defaultExpanded = false }: AiAnalysisCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  // campos de texto longo
  const textEntries = TEXT_FIELDS.filter(k => typeof data[k] === 'string' && data[k])
  // campos de lista
  const listEntries = LIST_FIELDS.filter(k => Array.isArray(data[k]) && (data[k] as unknown[]).length > 0)
  // marcadores clínicos
  const markers = Array.isArray(data.markers)
    ? data['.markers'] as Array<{ name: string; value: string | number; unit?: string; status?: string | null; reference_range?: string }>
    : null
  const aiMarkers = Array.isArray(data.markers)
    ? data.markers as Array<{ name: string; value: string | number; unit?: string; status?: string | null; reference_range?: string }>
    : null
  // campos de status/risco
  const riskLevel = data.risk_level as string | undefined
  const confidenceScore = data.confidence_score as number | undefined
  // campos numéricos de métricas
  const numericEntries = Object.entries(data).filter(([k, v]) =>
    typeof v === 'number' &&
    !TEXT_FIELDS.includes(k) &&
    !LIST_FIELDS.includes(k) &&
    k !== 'confidence_score'
  )
  // campos desconhecidos (fallback)
  const knownFields = new Set([...TEXT_FIELDS, ...LIST_FIELDS, 'markers', 'risk_level', 'confidence_score', ...numericEntries.map(([k]) => k)])
  const unknownEntries = Object.entries(data).filter(([k, v]) =>
    !knownFields.has(k) && typeof v !== 'object' && v !== null && v !== undefined
  )

  return (
    <div className="mt-3 border-t border-[var(--border)] pt-3">
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="flex items-center gap-1.5 text-xs font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 transition"
      >
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          className={`h-3 w-3 transition-transform ${expanded ? 'rotate-90' : ''}`}
        >
          <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
        </svg>
        Análise de IA
        {riskLevel && (
          <StatusBadge value={riskLevel} />
        )}
        {confidenceScore !== undefined && (
          <span className="text-slate-400 font-normal">
            {Math.round(confidenceScore * 100)}% confiança
          </span>
        )}
      </button>

      {expanded && (
        <div className="mt-3 space-y-3">
          {/* textos de resumo / observação */}
          {textEntries.map(k => (
            <div key={k}>
              <p className="text-[10px] uppercase tracking-wide text-slate-400 mb-1">
                {k === 'summary' ? 'Resumo' : k === 'observation' ? 'Observação' : k}
              </p>
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                {data[k] as string}
              </p>
            </div>
          ))}

          {/* métricas numéricas */}
          {numericEntries.length > 0 && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {numericEntries.map(([k, v]) => (
                <div key={k} className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-2">
                  <p className="text-[10px] uppercase tracking-wide text-slate-400">{k.replace(/_/g, ' ')}</p>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {typeof v === 'number' ? v.toFixed(1) : String(v)}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* marcadores clínicos */}
          {aiMarkers && aiMarkers.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wide text-slate-400 mb-1">Marcadores</p>
              <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 px-3 py-1">
                {aiMarkers.map((m, i) => (
                  <MarkerRow key={`${m.name}-${i}`} marker={m} />
                ))}
              </div>
            </div>
          )}

          {/* listas de recomendações / alertas */}
          {listEntries.map(k => (
            <div key={k}>
              <p className="text-[10px] uppercase tracking-wide text-slate-400 mb-1">
                {k === 'recommendations' ? 'Recomendações' :
                 k === 'warnings' ? 'Alertas' :
                 k === 'improvements' ? 'Melhorias' : k}
              </p>
              <ul className="space-y-1">
                {(data[k] as string[]).map((item, i) => (
                  <li key={i} className="flex gap-2 text-xs text-slate-600 dark:text-slate-300">
                    <span className="mt-0.5 h-3 w-3 shrink-0 text-primary-500">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* campos desconhecidos — fallback legível */}
          {unknownEntries.length > 0 && (
            <div className="space-y-1">
              {unknownEntries.map(([k, v]) => (
                <div key={k} className="flex gap-2 text-xs">
                  <span className="text-slate-400">{k.replace(/_/g, ' ')}:</span>
                  <span className="text-slate-700 dark:text-slate-300">{String(v)}</span>
                </div>
              ))}
            </div>
          )}

          {/* sem dados reconhecíveis — mostra JSON minificado como último recurso */}
          {textEntries.length === 0 && numericEntries.length === 0 && !aiMarkers && listEntries.length === 0 && unknownEntries.length === 0 && (
            <pre className="overflow-x-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-600 dark:bg-slate-900 dark:text-slate-400">
              {JSON.stringify(data, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}
