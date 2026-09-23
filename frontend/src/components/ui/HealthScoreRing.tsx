import type { HealthScoreLevel } from '@/lib/healthScore'

interface HealthScoreRingProps {
  score: number
  level: HealthScoreLevel
  label: string
}

const LEVEL_COLORS: Record<HealthScoreLevel, string> = {
  excelente: '#34d399', // emerald-400
  estavel: '#38bdf8', // sky-400
  atencao: '#fbbf24', // amber-400
}

// RENDERIZA O ANEL DE PROGRESSO SVG DO INDICE DE VITALIDADE
export default function HealthScoreRing({ score, level, label }: HealthScoreRingProps) {
  const radius = 52
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference
  const color = LEVEL_COLORS[level]

  return (
    <div className="flex items-center gap-5">
      <svg width="124" height="124" viewBox="0 0 124 124" className="flex-shrink-0 -rotate-90">
        <circle cx="62" cy="62" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
        <circle
          cx="62"
          cy="62"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
        <text
          x="62"
          y="62"
          textAnchor="middle"
          dominantBaseline="central"
          transform="rotate(90 62 62)"
          className="fill-white text-3xl font-bold"
        >
          {score}
        </text>
      </svg>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Índice de vitalidade
        </p>
        <p className="mt-1 text-xl font-bold tracking-tight" style={{ color }}>
          {label}
        </p>
        <p className="mt-1 max-w-[220px] text-xs text-slate-500">
          Combina estabilidade de peso, exames recentes e regularidade de registros.
        </p>
      </div>
    </div>
  )
}
