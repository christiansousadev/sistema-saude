import api from '@/lib/api'
import type { ClinicalListResponse, ClinicalResponse } from '@/types'

export async function listClinical(skip = 0, limit = 20): Promise<ClinicalListResponse> {
  const { data } = await api.get<ClinicalListResponse>('/clinical/', {
    params: { skip, limit },
  })
  return data
}

export async function getClinical(id: number): Promise<ClinicalResponse> {
  const { data } = await api.get<ClinicalResponse>(`/clinical/${id}`)
  return data
}

export async function createClinical(formData: FormData): Promise<ClinicalResponse> {
  const { data } = await api.post<ClinicalResponse>('/clinical/', formData)
  return data
}

export async function patchClinicalData(
  id: number,
  extractedData: object,
  notes?: string,
): Promise<ClinicalResponse> {
  const { data } = await api.patch<ClinicalResponse>(`/clinical/${id}/data`, {
    extracted_data: extractedData,
    notes,
  })
  return data
}

export async function deleteClinical(id: number): Promise<void> {
  await api.delete(`/clinical/${id}`)
}
