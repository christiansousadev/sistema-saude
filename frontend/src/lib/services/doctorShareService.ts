import api from '@/lib/api'
import type {
  DoctorShareCheckResponse,
  DoctorShareCreate,
  DoctorShareListResponse,
  DoctorShareResponse,
  MedicalSummaryResponse,
} from '@/types'

// GERA NOVO LINK TEMPORARIO DE COMPARTILHAMENTO
export async function generateShareToken(
  payload: DoctorShareCreate = { expires_in_hours: 48 }
): Promise<DoctorShareResponse> {
  const { data } = await api.post<DoctorShareResponse>('/doctor-share/generate', payload)
  return data
}

// LISTA LINKS DE COMPARTILHAMENTO DO USUARIO
export async function listShareTokens(): Promise<DoctorShareListResponse> {
  const { data } = await api.get<DoctorShareListResponse>('/doctor-share/tokens')
  return data
}

// REVOGA LINK DE COMPARTILHAMENTO
export async function revokeShareToken(tokenId: number): Promise<DoctorShareResponse> {
  const { data } = await api.post<DoctorShareResponse>(
    `/doctor-share/tokens/${tokenId}/revoke`
  )
  return data
}

// VERIFICA SE O LINK DE COMPARTILHAMENTO EXIGE PIN ANTES DO ACESSO
export async function checkShareToken(token: string): Promise<DoctorShareCheckResponse> {
  const { data } = await api.get<DoctorShareCheckResponse>(`/public/reports/share/${token}/check`)
  return data
}

// OBTEM RELATORIO MEDICO COMPARTILHADO VIA TOKEN PUBLICO (COM PIN OPCIONAL)
export async function getPublicSharedReport(token: string, pin?: string): Promise<MedicalSummaryResponse> {
  const { data } = await api.get<MedicalSummaryResponse>(`/public/reports/share/${token}`, {
    params: pin ? { pin } : undefined,
  })
  return data
}
