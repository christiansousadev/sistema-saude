'use client'

import { useState } from 'react'

interface MetabolicCardProps {
  weightKg: number | null
  heightCm: number | null
  birthDate: string | null
}

export default function MetabolicCard({
  weightKg,
  heightCm,
  birthDate,
}: MetabolicCardProps) {
  const [gender, setGender] = useState<'M' | 'F'>('M')
  const [activityLevel, setActivityLevel] = useState<number>(1.375) // Levemente ativo padrão

  // Calcula idade
  let age = 30
  if (birthDate) {
    const bDate = new Date(birthDate)
    const today = new Date()
    age = today.getFullYear() - bDate.getFullYear()
  }

  // TMB Fórmula Mifflin-St Jeor:
  // Homens: 10 * peso + 6.25 * altura - 5 * idade + 5
  // Mulheres: 10 * peso + 6.25 * altura - 5 * idade - 161
  const tmb =
    weightKg && heightCm
      ? Math.round(
          10 * weightKg +
            6.25 * heightCm -
            5 * age +
            (gender === 'M' ? 5 : -161)
        )
      : null

  // TDEE: Gasto Energético Total
  const tdee = tmb ? Math.round(tmb * activityLevel) : null

  // Metas calóricas recomendadas
  const deficitCal = tdee ? Math.round(tdee - 400) : null
  const surplusCal = tdee ? Math.round(tdee + 300) : null

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <span>🔥</span> Taxa Metabólica & Gasto Calórico (TDEE)
          </h3>
          <p className="text-xs text-slate-500">
            Estimativa de queima calórica diária com base na equação de Mifflin-St Jeor.
          </p>
        </div>

        {/* Seletor de Sexo */}
        <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
          <button
            onClick={() => setGender('M')}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
              gender === 'M'
                ? 'bg-primary-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Homem
          </button>
          <button
            onClick={() => setGender('F')}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
              gender === 'F'
                ? 'bg-pink-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Mulher
          </button>
        </div>
      </div>

      {/* Seletor de Atividade Física */}
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">
          Nível de Atividade Física Diária:
        </label>
        <select
          value={activityLevel}
          onChange={(e) => setActivityLevel(Number(e.target.value))}
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200"
        >
          <option value={1.2}>Sedentário (Pouco ou nenhum exercício)</option>
          <option value={1.375}>Levemente Ativo (Exercício leve 1 a 3 dias/semana)</option>
          <option value={1.55}>Moderadamente Ativo (Exercício moderado 3 a 5 dias/semana)</option>
          <option value={1.725}>Muito Ativo (Exercício intenso 6 a 7 dias/semana)</option>
          <option value={1.9}>Extremamente Ativo (Atleta / Trabalho braçal pesado)</option>
        </select>
      </div>

      {/* Resultados TMB e TDEE */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/40 p-3 border border-[var(--border)]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Metabolismo Basal (TMB)
          </span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-2xl font-black text-slate-800 dark:text-slate-100">
              {tmb ? tmb.toLocaleString('pt-BR') : '—'}
            </span>
            <span className="text-xs text-slate-500">kcal/dia</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">Calorias gastas em repouso total</p>
        </div>

        <div className="rounded-xl bg-primary-50/50 dark:bg-primary-900/20 p-3 border border-primary-100 dark:border-primary-800/30">
          <span className="text-[10px] font-bold uppercase tracking-wider text-primary-600 dark:text-primary-400">
            Gasto Diário Total (TDEE)
          </span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-2xl font-black text-primary-700 dark:text-primary-300">
              {tdee ? tdee.toLocaleString('pt-BR') : '—'}
            </span>
            <span className="text-xs text-primary-600/80 dark:text-primary-400">kcal/dia</span>
          </div>
          <p className="text-[10px] text-primary-600/70 dark:text-primary-400/70 mt-0.5">Para manter o peso atual</p>
        </div>
      </div>

      {/* Metas Nutricionais Sugeridas */}
      {tdee && (
        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/20 p-3 border border-[var(--border)]">
          <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-2">
            🎯 Metas Calóricas de Acordo com Seu Objetivo:
          </p>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-lg bg-[var(--surface)] p-2 border border-[var(--border)]">
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold block text-[11px]">
                Emagrecimento
              </span>
              <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
                {deficitCal}
              </span>
              <span className="text-[10px] text-slate-400 block">kcal/dia</span>
            </div>

            <div className="rounded-lg bg-[var(--surface)] p-2 border border-[var(--border)]">
              <span className="text-blue-600 dark:text-blue-400 font-semibold block text-[11px]">
                Manutenção
              </span>
              <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
                {tdee}
              </span>
              <span className="text-[10px] text-slate-400 block">kcal/dia</span>
            </div>

            <div className="rounded-lg bg-[var(--surface)] p-2 border border-[var(--border)]">
              <span className="text-purple-600 dark:text-purple-400 font-semibold block text-[11px]">
                Hipertrofia
              </span>
              <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
                {surplusCal}
              </span>
              <span className="text-[10px] text-slate-400 block">kcal/dia</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
