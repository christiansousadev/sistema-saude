import api from '../api'
import type { ApiConfiguration, AdminUserResponse } from '@/types'

export async function listUsers(): Promise<AdminUserResponse[]> {
  const { data } = await api.get('/admin/users/')
  return data
}

export async function getUserConfig(userId: number): Promise<ApiConfiguration> {
  const { data } = await api.get(`/admin/users/${userId}/config`)
  return data
}

export async function updateUserConfig(
  userId: number,
  payload: {
    engine_mode: 'local' | 'llm'
    api_key?: string
    model_name: string
    base_url?: string
    clinical_system_prompt?: string
    physical_system_prompt?: string
  }
): Promise<ApiConfiguration> {
  const { data } = await api.post(`/admin/users/${userId}/config`, payload)
  return data
}
