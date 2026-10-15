import api from '@/lib/api'
import type { DailyHabitResponse, WaterHistoryResponse } from '@/types'

// OBTEM DADOS DE HABITO E AGUA DO DIA
export async function getTodayHabit(): Promise<DailyHabitResponse> {
  const { data } = await api.get<DailyHabitResponse>('/habits/daily/today')
  return data
}

// INCREMENTA AGUA DO DIA
export async function incrementWater(increment_ml = 250, date?: string): Promise<DailyHabitResponse> {
  const { data } = await api.post<DailyHabitResponse>('/habits/water/increment', {
    increment_ml,
    date,
  })
  return data
}

// DEFINE VALOR EXATO DE AGUA
export async function setWater(amount_ml: number, goal_ml?: number, date?: string): Promise<DailyHabitResponse> {
  const { data } = await api.post<DailyHabitResponse>('/habits/water/set', {
    amount_ml,
    goal_ml,
    date,
  })
  return data
}

// ZERA AGUA DO DIA
export async function resetWater(date?: string): Promise<DailyHabitResponse> {
  const { data } = await api.post<DailyHabitResponse>('/habits/water/reset', null, {
    params: date ? { target_date: date } : undefined,
  })
  return data
}

// OBTEM HISTORICO DE AGUA
export async function getWaterHistory(days = 7): Promise<WaterHistoryResponse> {
  const { data } = await api.get<WaterHistoryResponse>('/habits/water/history', {
    params: { days },
  })
  return data
}

// ATUALIZA HABITOS DIARIOS (SONO, ENERGIA, TREINO, NOTAS)
export async function updateDailyHabits(payload: {
  date?: string
  water_ml?: number
  water_goal_ml?: number
  sleep_hours?: number
  sleep_quality?: number
  energy_level?: number
  workout_done?: boolean
  notes?: string
}): Promise<DailyHabitResponse> {
  const { data } = await api.put<DailyHabitResponse>('/habits/daily', payload)
  return data
}
