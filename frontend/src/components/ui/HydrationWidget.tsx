'use client'

import { useEffect, useState } from 'react'
import { Bell, Droplets, Plus, RotateCcw, TrendingUp } from 'lucide-react'
import * as habitsService from '@/lib/services/habitsService'
import * as notificationService from '@/lib/services/notificationService'
import type { DailyHabitResponse } from '@/types'

const GOAL_ML = 2500
const STEP_ML = 250
const STORAGE_KEY = 'ss_hydration'

function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

// RASTREADOR DE HIDRATACAO DIARIA COM PERSISTENCIA NO BACKEND E MINI HISTORICO
export default function HydrationWidget() {
  const [amountMl, setAmountMl] = useState(0)
  const [goalMl, setGoalMl] = useState(GOAL_ML)
  const [history, setHistory] = useState<DailyHabitResponse[]>([])
  const [ready, setReady] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)

  // carrega dados de hoje do backend com fallback para localstorage
  useEffect(() => {
    let isMounted = true

    async function loadData() {
      // fallback inicial rapido do storage local
      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (raw) {
          const parsed = JSON.parse(raw) as { date: string; amount_ml: number }
          if (parsed.date === todayKey() && isMounted) {
            setAmountMl(parsed.amount_ml)
          }
        }
      } catch {
        // storage indisponivel, segue sem erro
      }

      // busca dados sincronizados do backend
      try {
        const [todayHabit, historyData] = await Promise.all([
          habitsService.getTodayHabit(),
          habitsService.getWaterHistory(7),
        ])
        if (isMounted) {
          setAmountMl(todayHabit.water_ml)
          setGoalMl(todayHabit.water_goal_ml || GOAL_ML)
          setHistory(historyData.items || [])
          localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({ date: todayKey(), amount_ml: todayHabit.water_ml })
          )
        }
      } catch {
        // segue com dados locais caso offline
      } finally {
        if (isMounted) setReady(true)
      }
    }

    loadData()
    return () => {
      isMounted = false
    }
  }, [])

  async function addWater() {
    if (isUpdating) return
    const nextAmount = amountMl + STEP_ML
    // atualizacao otimista imediata
    setAmountMl(nextAmount)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: todayKey(), amount_ml: nextAmount }))
    } catch {
      // ignora erro de storage local
    }

    setIsUpdating(true)
    try {
      const updated = await habitsService.incrementWater(STEP_ML)
      setAmountMl(updated.water_ml)
      setGoalMl(updated.water_goal_ml || GOAL_ML)
      // atualiza o dia de hoje no mini historico
      setHistory((prev) =>
        prev.map((item) =>
          item.date === todayKey()
            ? { ...item, water_ml: updated.water_ml, pct: updated.pct }
            : item
        )
      )
    } catch {
      // mantem valor local
    } finally {
      setIsUpdating(false)
    }
  }

  async function reset() {
    if (isUpdating) return
    setAmountMl(0)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: todayKey(), amount_ml: 0 }))
    } catch {
      // ignora erro
    }

    setIsUpdating(true)
    try {
      await habitsService.resetWater()
      setHistory((prev) =>
        prev.map((item) =>
          item.date === todayKey() ? { ...item, water_ml: 0, pct: 0 } : item
        )
      )
    } catch {
      // mantem valor local
    } finally {
      setIsUpdating(false)
    }
  }

  const pct = Math.min(100, Math.round((amountMl / goalMl) * 100))

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-slate-900/60 p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-semibold text-white">
          <Droplets className="h-4 w-4 text-sky-400" strokeWidth={2} />
          Hidratação diária
        </h3>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={async () => {
              await notificationService.sendLocalNotification('Lembrete de Hidratação', {
                body: `Você registrou ${amountMl}ml de ${goalMl}ml hoje. Mantenha-se hidratado!`,
              })
            }}
            title="Lembrete de hidratação no dispositivo"
            aria-label="Lembrete de hidratação"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-white/5 hover:text-sky-300"
          >
            <Bell className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={reset}
            disabled={isUpdating}
            aria-label="Reiniciar hidratação do dia"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-white/5 hover:text-slate-300 disabled:opacity-50"
          >
            <RotateCcw className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        </div>
      </div>

      <div className="mt-4 flex items-baseline gap-1">
        <span className="text-2xl font-bold tracking-tight text-white">
          {ready ? amountMl.toLocaleString('pt-BR') : '—'}
        </span>
        <span className="text-sm text-slate-500">/ {goalMl.toLocaleString('pt-BR')} ml</span>
      </div>

      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/5">
        <div
          className="h-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-400 transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>

      <button
        onClick={addWater}
        disabled={isUpdating}
        className="mt-4 flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-sky-500/20 bg-sky-500/10 text-sm font-semibold text-sky-300 transition hover:bg-sky-500/20 active:scale-[0.99] disabled:opacity-60"
      >
        <Plus className="h-4 w-4" strokeWidth={2} />
        {STEP_ML} ml
      </button>

      {history.length > 0 && (
        <div className="mt-5 border-t border-white/[0.06] pt-3">
          <div className="flex items-center justify-between text-[11px] font-medium text-slate-400">
            <span className="flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-sky-400" /> Últimos 7 dias
            </span>
            <span>Meta: {goalMl}ml</span>
          </div>
          <div className="mt-2 flex items-end justify-between gap-1.5 h-10 px-1">
            {history.map((day) => {
              const dayPct = Math.min(100, Math.round((day.water_ml / (day.water_goal_ml || goalMl)) * 100))
              const isToday = day.date === todayKey()
              const weekday = new Date(day.date + 'T12:00:00Z').toLocaleDateString('pt-BR', { weekday: 'narrow' })
              return (
                <div key={day.date} className="flex-1 flex flex-col items-center gap-1 group">
                  <div className="w-full bg-white/5 rounded-t-sm h-8 relative flex items-end overflow-hidden">
                    <div
                      className={`w-full transition-all duration-300 ${
                        dayPct >= 100
                          ? 'bg-emerald-400'
                          : dayPct > 0
                          ? 'bg-sky-400'
                          : 'bg-transparent'
                      }`}
                      style={{ height: `${dayPct}%` }}
                    />
                  </div>
                  <span
                    className={`text-[9px] uppercase ${
                      isToday ? 'font-bold text-sky-400' : 'text-slate-500'
                    }`}
                  >
                    {weekday}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
