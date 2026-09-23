import type { ClinicalResponse, PhysicalResponse } from '@/types'

export type HealthScoreLevel = 'excelente' | 'estavel' | 'atencao'

export interface HealthScoreResult {
  score: number
  level: HealthScoreLevel
  label: string
}

// pondera estabilidade de peso, alterações em exames e regularidade de medições
// em um índice único de 0 a 100, puramente client-side, sobre os dados já carregados
export function calculateHealthScore(
  physicals: PhysicalResponse[],
  clinicals: ClinicalResponse[],
): HealthScoreResult {
  let score = 0

  // estabilidade de peso (até 40 pontos)
  const weighted = physicals.filter((p) => p.weight_kg != null)
  if (weighted.length >= 2) {
    const newest = weighted[0].weight_kg as number
    const oldest = weighted[weighted.length - 1].weight_kg as number
    const pctChange = Math.abs((newest - oldest) / oldest) * 100
    if (pctChange <= 5) score += 40
    else if (pctChange <= 10) score += 25
    else score += 10
  } else {
    score += 20 // dados insuficientes para avaliar, nota neutra
  }

  // exames sem alterações críticas (até 35 pontos)
  const latestExam = clinicals[0]
  const markers = latestExam?.extracted_data?.markers as Array<{ status: string | null }> | undefined
  if (!latestExam) {
    score += 15 // sem exame ainda, nota neutra
  } else if (!markers?.length) {
    score += 15 // exame sem marcadores extraídos, nota neutra
  } else {
    const abnormal = markers.filter((m) => m.status === 'alto' || m.status === 'baixo').length
    if (abnormal === 0) score += 35
    else if (abnormal <= 2) score += 20
    else score += 5
  }

  // regularidade de medições (até 25 pontos), baseada na recência do último registro
  const latestPhysical = physicals[0]
  if (!latestPhysical) {
    score += 0
  } else {
    const daysSince = Math.floor(
      (Date.now() - new Date(latestPhysical.recorded_at).getTime()) / (1000 * 60 * 60 * 24),
    )
    if (daysSince <= 7) score += 25
    else if (daysSince <= 14) score += 18
    else if (daysSince <= 30) score += 10
    else score += 5
  }

  const clamped = Math.max(0, Math.min(100, Math.round(score)))

  let level: HealthScoreLevel = 'atencao'
  let label = 'Atenção'
  if (clamped >= 80) {
    level = 'excelente'
    label = 'Excelente'
  } else if (clamped >= 60) {
    level = 'estavel'
    label = 'Estável'
  }

  return { score: clamped, level, label }
}
