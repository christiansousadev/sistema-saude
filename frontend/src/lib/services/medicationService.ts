import api from '@/lib/api'
import type {
  MedicationCreate,
  MedicationListResponse,
  MedicationResponse,
  MedicationUpdate,
} from '@/types'

// LISTA MEDICAMENTOS E SUPLEMENTOS
export async function listMedications(activeOnly = false): Promise<MedicationListResponse> {
  const { data } = await api.get<MedicationListResponse>('/medications', {
    params: { active_only: activeOnly },
  })
  return data
}

// CADASTRA NOVO MEDICAMENTO OU SUPLEMENTO
export async function createMedication(payload: MedicationCreate): Promise<MedicationResponse> {
  const { data } = await api.post<MedicationResponse>('/medications', payload)
  return data
}

// ATUALIZA MEDICAMENTO EXISTENTE
export async function updateMedication(
  id: number,
  payload: MedicationUpdate
): Promise<MedicationResponse> {
  const { data } = await api.put<MedicationResponse>(`/medications/${id}`, payload)
  return data
}

// EXCLUI MEDICAMENTO
export async function deleteMedication(id: number): Promise<void> {
  await api.delete(`/medications/${id}`)
}
