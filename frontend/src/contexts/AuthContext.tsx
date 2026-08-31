'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useRouter } from 'next/navigation'

import api, { extractErrorMessage } from '@/lib/api'
import { clearSessionCookie, isSessionLikelyValid } from '@/lib/auth'
import type { UserResponse } from '@/types'

export interface RegisterPayload {
  name: string
  email: string
  password: string
  height_cm: number | null
  birth_date: string | null
}

interface AuthContextValue {
  user: UserResponse | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (data: RegisterPayload) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

// M-5a: intervalo de renovação automática do access token
// Renova 2 minutos antes do access token de 15 min expirar
const REFRESH_INTERVAL_MS = 13 * 60 * 1000 // 13 minutos

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  /** M-5a: chama POST /auth/refresh silenciosamente para renovar o access token */
  const silentRefresh = useCallback(async () => {
    try {
      await api.post('/auth/refresh')
      // o servidor seta o novo access token e refresh token via cookies
    } catch {
      // refresh falhou — usuário precisa fazer login novamente
      clearSessionCookie()
      setUser(null)
      if (refreshTimer.current) clearInterval(refreshTimer.current)
      router.push('/login')
    }
  }, [router])

  /** Inicia o timer de renovação automática */
  const startRefreshTimer = useCallback(() => {
    if (refreshTimer.current) clearInterval(refreshTimer.current)
    refreshTimer.current = setInterval(silentRefresh, REFRESH_INTERVAL_MS)
  }, [silentRefresh])

  /** Para o timer de renovação */
  const stopRefreshTimer = useCallback(() => {
    if (refreshTimer.current) {
      clearInterval(refreshTimer.current)
      refreshTimer.current = null
    }
  }, [])

  // RESTAURA SESSAO DO COOKIE AO INICIAR
  useEffect(() => {
    const restore = async () => {
      // S-1: verifica o cookie legível ss_session_exp antes de chamar /auth/me
      // se o cookie não existir ou já expirou, tenta usar o refresh token antes de desistir
      if (!isSessionLikelyValid()) {
        // M-5a: access token expirado — tenta refresh silencioso
        try {
          await api.post('/auth/refresh')
          // refresh funcionou — busca dados do usuário
          const { data } = await api.get<UserResponse>('/auth/me')
          setUser(data)
          startRefreshTimer()
        } catch {
          // refresh também falhou — usuário não está logado
          setIsLoading(false)
        }
        return
      }

      try {
        // o cookie HttpOnly ss_access_token é enviado automaticamente (withCredentials)
        const { data } = await api.get<UserResponse>('/auth/me')
        setUser(data)
        // M-5a: inicia renovação automática
        startRefreshTimer()
      } catch {
        // sessão inválida no servidor — limpa cookie de expiração no cliente
        clearSessionCookie()
      } finally {
        setIsLoading(false)
      }
    }
    restore()

    return () => stopRefreshTimer()
  }, [startRefreshTimer, stopRefreshTimer])

  const login = useCallback(
    async (email: string, password: string) => {
      // S-1: o servidor define o cookie HttpOnly ss_access_token na resposta
      // não precisamos extrair nem armazenar o token — o browser cuida disso
      await api.post('/auth/login', { email, password })
      // busca os dados do usuário usando o cookie recém-definido
      const { data: me } = await api.get<UserResponse>('/auth/me')
      setUser(me)
      // M-5a: inicia renovação automática após login
      startRefreshTimer()
      router.push('/dashboard')
    },
    [router, startRefreshTimer],
  )

  const register = useCallback(
    async (payload: RegisterPayload) => {
      await api.post<UserResponse>('/auth/register', payload)
      await login(payload.email, payload.password)
    },
    [login],
  )

  const logout = useCallback(async () => {
    stopRefreshTimer()
    try {
      // S-1: chama o endpoint de logout para que o servidor remova o cookie HttpOnly
      // M-5a: o backend também revoga o refresh token do banco
      await api.post('/auth/logout')
    } catch {
      // mesmo em erro, limpa o estado local
    } finally {
      clearSessionCookie()
      setUser(null)
      router.push('/login')
    }
  }, [router, stopRefreshTimer])

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth precisa estar dentro de AuthProvider')
  return ctx
}
