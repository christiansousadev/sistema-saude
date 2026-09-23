'use client'

import { useState } from 'react'
import { Flame, Target, Zap } from 'lucide-react'

interface MetabolicCardProps {
  weightKg: number | null
  heightCm: number | null
  birthDate: string | null
}

const ACTIVITY_LEVELS = [
  { value: 1.2, label: 'Sedentário — pouco ou nenhum exercício' },
  { value: 1.375, label: 'Levemente ativo — exercício leve 1 a 3 dias/semana' },
  { value: 1.55, label: 'Moderadamente ativo — exercício moderado 3 a 5 dias/semana' },
  { value: 1.725, label: 'Muito ativo — exercício intenso 6 a 7 dias/semana' },
  { value: 1.9, label: 'Extremamente ativo — atleta / trabalho braçal pesado' },
]

export default function MetabolicCard({
  weightKg,
  heightCm,
  birthDate,
}: MetabolicCardProps) {
  const [gender, setGender] = useState<'M' | 'F'>('M')
  const [activityLevel, setActivityLevel] = useState<number>(1.375) // levemente ativo padrão

  // calcula idade
  let age = 30
  if (birthDate) {
    const bDate = new Date(birthDate)
    const today = new Date()
    age = today.getFullYear() - bDate.getFullYear()
  }

  // tmb fórmula mifflin-st jeor:
  // homens: 10 * peso + 6.25 * altura - 5 * idade + 5
  // mulheres: 10 * peso + 6.25 * altura - 5 * idade - 161
  const tmb =
    weightKg && heightCm
      ? Math.round(
          10 * weightKg +
            6.25 * heightCm -
            5 * age +
            (gender === 'M' ? 5 : -161)
        )
      : null

  // tdee: gasto energético total
  const tdee = tmb ? Math.round(tmb * activityLevel) : null

  // metas calóricas recomendadas
  const deficitCal = tdee ? Math.round(tdee - 400) : null
  const surplusCal = tdee ? Math.round(tdee + 300) : null

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-slate-900/60 p-5 shadow-sm space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="flex items-center gap-2 font-semibold text-white">
            <Flame className="h-4 w-4 text-amber-400" strokeWidth={2} />
            Taxa metabólica & gasto calórico (TDEE)
          </h3>
          <p className="mt-0.5 text-xs text-slate-400">
            Estimativa de queima calórica diária com base na equação de Mifflin-St Jeor.
          </p>
        </div>

        {/* segmented control de sexo, indicador desliza entre as duas opções */}
        <div className="relative flex w-40 rounded-xl bg-white/5 p-1">
          <span
            className="absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-lg bg-gradient-to-br from-sky-500 to-emerald-500 transition-transform duration-200 ease-out"
            style={{ transform: gender === 'F' ? 'translateX(100%)' : 'translateX(0)' }}
          />
          <button
            type="button"
            onClick={() => setGender('M')}
            className={`relative z-10 flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              gender === 'M' ? 'text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Homem
          </button>
          <button
            type="button"
            onClick={() => setGender('F')}
            className={`relative z-10 flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              gender === 'F' ? 'text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Mulher
          </button>
        </div>
      </div>

      {/* seletor de atividade física */}
      <div>
        <label className="mb-1.5 block text-xs font-medium text-slate-400">
          Nível de atividade física diária
        </label>
        <select
          value={activityLevel}
          onChange={(e) => setActivityLevel(Number(e.target.value))}
          className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-slate-200 outline-none transition focus:border-sky-500/50 focus:ring-2 focus:ring-sky-500/20"
        >
          {ACTIVITY_LEVELS.map((level) => (
            <option key={level.value} value={level.value} className="bg-slate-900">
              {level.label}
            </option>
          ))}
        </select>
      </div>

      {/* resultados tmb e tdee */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3.5">
          <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            <Zap className="h-3 w-3" strokeWidth={2} />
            Metabolismo basal
          </span>
          <div className="mt-1.5 flex items-baseline gap-1">
            <span className="text-2xl font-bold tracking-tight text-white">
              {tmb ? tmb.toLocaleString('pt-BR') : '—'}
            </span>
            <span className="text-xs text-slate-500">kcal/dia</span>
          </div>
          <p className="mt-0.5 text-[10px] text-slate-500">Calorias gastas em repouso total</p>
        </div>

        <div className="rounded-xl border border-sky-500/20 bg-sky-500/[0.06] p-3.5">
          <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-sky-400">
            <Flame className="h-3 w-3" strokeWidth={2} />
            Gasto diário total
          </span>
          <div className="mt-1.5 flex items-baseline gap-1">
            <span className="text-2xl font-bold tracking-tight text-sky-300">
              {tdee ? tdee.toLocaleString('pt-BR') : '—'}
            </span>
            <span className="text-xs text-sky-400/80">kcal/dia</span>
          </div>
          <p className="mt-0.5 text-[10px] text-sky-400/70">Para manter o peso atual</p>
        </div>
      </div>

      {/* metas nutricionais sugeridas */}
      {tdee && (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5">
          <p className="mb-2.5 flex items-center gap-1.5 text-[11px] font-semibold text-slate-300">
            <Target className="h-3.5 w-3.5 text-slate-400" strokeWidth={2} />
            Metas calóricas de acordo com seu objetivo
          </p>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] p-2.5">
              <span className="block text-[11px] font-semibold text-emerald-300">
                Emagrecimento
              </span>
              <span className="text-sm font-bold text-white">{deficitCal}</span>
              <span className="block text-[10px] text-slate-500">kcal/dia</span>
            </div>

            <div className="rounded-lg border border-sky-500/20 bg-sky-500/[0.06] p-2.5">
              <span className="block text-[11px] font-semibold text-sky-300">
                Manutenção
              </span>
              <span className="text-sm font-bold text-white">{tdee}</span>
              <span className="block text-[10px] text-slate-500">kcal/dia</span>
            </div>

            <div className="rounded-lg border border-teal-500/20 bg-teal-500/[0.06] p-2.5">
              <span className="block text-[11px] font-semibold text-teal-300">
                Hipertrofia
              </span>
              <span className="text-sm font-bold text-white">{surplusCal}</span>
              <span className="block text-[10px] text-slate-500">kcal/dia</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
