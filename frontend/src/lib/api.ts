import axios, { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'

/**
 * S-1: O token JWT agora é transportado via cookie HttpOnly (ss_access_token).
 * O browser envia o cookie automaticamente em todas as requisições same-site.
 * withCredentials: true garante que cookies são enviados em requisições cross-origin
 * (necessário para dev local: localhost:3000 → localhost:8000).
 */
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1',
  timeout: 20_000,
  headers: { 'Content-Type': 'application/json' },
  // envia cookies em requisições cross-origin (dev: porta 3000 → 8000)
  withCredentials: true,
})

// AJUSTA CONTENT-TYPE PARA MULTIPART
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // deixa o browser definir o Content-Type com boundary para multipart
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type']
    }
    return config
  },
  (error: unknown) => Promise.reject(error),
)

// TRATA RESPOSTAS DE ERRO GLOBALMENTE
api.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      // sessão expirada ou inválida → redireciona para login
      // o cookie HttpOnly é removido pelo servidor no logout
      if (typeof window !== 'undefined') {
        window.location.replace('/login')
      }
    }
    return Promise.reject(error)
  },
)

// extrai a mensagem de erro do formato { detail: "..." } que o FastAPI retorna
export function extractErrorMessage(error: unknown, fallback = 'erro inesperado'): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { detail?: string | { msg: string }[] } | undefined
    if (typeof data?.detail === 'string') return data.detail
    if (Array.isArray(data?.detail)) return data.detail.map((d) => d.msg).join(', ')
    return error.message ?? fallback
  }
  if (error instanceof Error) return error.message
  return fallback
}

export default api
