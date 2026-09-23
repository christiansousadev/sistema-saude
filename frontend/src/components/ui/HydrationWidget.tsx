'use client'

import { useEffect, useState } from 'react'
import { Droplets, Plus, RotateCcw } from 'lucide-react'

const GOAL_ML = 2500
const STEP_ML = 250
const STORAGE_KEY = 'ss_hydration'

function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

// RASTREADOR DE HIDRATACAO DIARIA, PERSISTIDO NO NAVEGADOR, ZERA A CADA NOVO DIA
export default function HydrationWidget() {
  const [amountMl, setAmountMl] = useState(0)
  const [ready, setReady] = useState(false)

  // carrega do localStorage só depois de montar no cliente, evita divergência de hidratação
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as { date: string; amount_ml: number }
        if (parsed.date === todayKey()) setAmountMl(parsed.amount_ml)
      }
    } catch {
      // storage indisponível (aba anônima, cookies bloqueados etc.), segue com 0
    } finally {
      setReady(true)
    }
  }, [])

  function persist(next: number) {
    setAmountMl(next)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: todayKey(), amount_ml: next }))
    } catch {
      // ignora falha de storage, widget continua funcional em memória para esta sessão
    }
  }

  function addWater() {
    persist(amountMl + STEP_ML)
  }

  function reset() {
    persist(0)
  }

  const pct = Math.min(100, Math.round((amountMl / GOAL_ML) * 100))

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-slate-900/60 p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-semibold text-white">
          <Droplets className="h-4 w-4 text-sky-400" strokeWidth={2} />
          Hidratação diária
        </h3>
        <button
          onClick={reset}
          aria-label="Reiniciar hidratação do dia"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-white/5 hover:text-slate-300"
        >
          <RotateCcw className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
      </div>

      <div className="mt-4 flex items-baseline gap-1">
        <span className="text-2xl font-bold tracking-tight text-white">
          {ready ? amountMl.toLocaleString('pt-BR') : '—'}
        </span>
        <span className="text-sm text-slate-500">/ {GOAL_ML.toLocaleString('pt-BR')} ml</span>
      </div>

      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/5">
        <div
          className="h-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-400 transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>

      <button
        onClick={addWater}
        className="mt-4 flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-sky-500/20 bg-sky-500/10 text-sm font-semibold text-sky-300 transition hover:bg-sky-500/20"
      >
        <Plus className="h-4 w-4" strokeWidth={2} />
        {STEP_ML} ml
      </button>
    </div>
  )
}
