import api from '@/lib/api'
import type { ApiConfiguration, EngineMode } from '@/types'

export interface ConfigPayload {
  engine_mode: EngineMode
  api_key: string | null
  model_name: string
  base_url: string | null
}

export async function getActiveConfig(): Promise<ApiConfiguration | null> {
  try {
    const { data } = await api.get<ApiConfiguration | null>('/config/active')
    return data
  } catch {
    return null
  }
}

export async function saveConfig(payload: ConfigPayload): Promise<ApiConfiguration> {
  const { data } = await api.post<ApiConfiguration>('/config/', payload)
  return data
}

export async function deleteConfig(id: number): Promise<void> {
  await api.delete(`/config/${id}`)
}
