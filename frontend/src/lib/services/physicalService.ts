import api from '@/lib/api'
import type { PhysicalListResponse, PhysicalResponse } from '@/types'

export async function listPhysical(skip = 0, limit = 20): Promise<PhysicalListResponse> {
  const { data } = await api.get<PhysicalListResponse>('/physical/', {
    params: { skip, limit },
  })
  return data
}

export async function createPhysical(formData: FormData): Promise<PhysicalResponse> {
  const { data } = await api.post<PhysicalResponse>('/physical/', formData)
  return data
}

export async function deletePhysical(id: number): Promise<void> {
  await api.delete(`/physical/${id}`)
}
