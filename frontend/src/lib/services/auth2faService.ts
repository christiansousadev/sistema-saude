import api from '@/lib/api'
import type { User2FASetupResponse, User2FAStatusResponse } from '@/types'

// INICIA O PROCESSO DE CONFIGURACAO 2FA GERANDO SEGREDO BASE32 E URI OTPAUTH
export async function setup2FA(): Promise<User2FASetupResponse> {
  const { data } = await api.post<User2FASetupResponse>('/auth/2fa/setup')
  return data
}

// VALIDA O CODIGO DE 6 DIGITOS E ATIVA DEFINITIVAMENTE O 2FA NA CONTA
export async function verify2FA(code: string): Promise<User2FAStatusResponse> {
  const { data } = await api.post<User2FAStatusResponse>('/auth/2fa/verify', { code })
  return data
}

// DESATIVA O 2FA DA CONTA MEDIANTE CONFIRMACAO COM CODIGO ATUAL
export async function disable2FA(code: string): Promise<User2FAStatusResponse> {
  const { data } = await api.post<User2FAStatusResponse>('/auth/2fa/disable', { code })
  return data
}
