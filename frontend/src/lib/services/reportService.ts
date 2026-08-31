import api from '@/lib/api'
import type { MedicalSummaryResponse } from '@/types'

export async function getMedicalSummary(): Promise<MedicalSummaryResponse> {
  const { data } = await api.get<MedicalSummaryResponse>('/reports/summary')
  return data
}
