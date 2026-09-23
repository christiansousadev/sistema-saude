'use client'

import { type FormEvent, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

import { useAuth } from '@/contexts/AuthContext'
import { getUserConfig, updateUserConfig } from '@/lib/services/adminService'
import { LLM_PROVIDERS } from '@/lib/constants/llm-providers'
import type { ApiConfiguration } from '@/types'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Spinner from '@/components/ui/Spinner'
import Textarea from '@/components/ui/Textarea'
import { extractErrorMessage } from '@/lib/api'

const ENGINES = [
  { value: 'llm', label: 'LLM (Cloud/Local)' },
  { value: 'local', label: 'Local (OpenCV/RegEx)' },
]

// provedores rápidos exibidos como atalho — a lista completa vive em lib/constants/llm-providers
const QUICK_PROVIDER_KEYS = ['openai', 'gemini', 'claude', 'grok', 'deepseek']

export default function AdminUserPage() {
  const { user } = useAuth()
  const router = useRouter()
  const { id } = useParams()
  const userId = Number(id)

  const [config, setConfig] = useState<ApiConfiguration | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // form state
  const [engineMode, setEngineMode] = useState<'llm' | 'local'>('llm')
  const [activeProvider, setActiveProvider] = useState<string>('')
  const [apiKey, setApiKey] = useState('')
  const [modelName, setModelName] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [clinicalPrompt, setClinicalPrompt] = useState('')
  const [physicalPrompt, setPhysicalPrompt] = useState('')

  useEffect(() => {
    if (user && !user.is_superadmin) {
      router.replace('/dashboard')
      return
    }

    if (!userId) return

    getUserConfig(userId)
      .then((data) => {
        setConfig(data)
        setEngineMode(data.engine_mode)
        setModelName(data.model_name)
        setBaseUrl(data.base_url || '')
        setClinicalPrompt(data.clinical_system_prompt || '')
        setPhysicalPrompt(data.physical_system_prompt || '')
      })
      .catch((err) => setError(extractErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [userId, user, router])

  function handleQuickProvider(providerKey: string) {
    const provider = LLM_PROVIDERS.find((p) => p.key === providerKey)
    if (!provider) return

    setActiveProvider(providerKey)
    setModelName(provider.models[0]?.value ?? '')
    setBaseUrl(provider.base_url ?? '')
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    setSubmitting(true)

    try {
      const updated = await updateUserConfig(userId, {
        engine_mode: engineMode,
        api_key: apiKey || undefined, // envia somente se foi alterado
        model_name: modelName,
        base_url: baseUrl || undefined,
        clinical_system_prompt: clinicalPrompt || undefined,
        physical_system_prompt: physicalPrompt || undefined,
      })
      setConfig(updated)
      setApiKey('') // limpa o campo apos salvar
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="md" className="text-primary-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-2xl">
      <div className="flex items-center gap-4">
        <Link
          href="/admin"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 transition"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Configuração do Usuário
          </h1>
          <p className="text-sm text-slate-500">ID: {userId}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-600 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400">
              Configuração salva com sucesso.
            </div>
          )}

          <div className="space-y-3 pb-3 border-b border-[var(--border)]">
            <h3 className="text-sm font-medium text-slate-800 dark:text-slate-200">
              Provedor Rápido (Auto-fill)
            </h3>
            <div className="flex flex-wrap gap-2">
              {QUICK_PROVIDER_KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleQuickProvider(key)}
                  disabled={engineMode === 'local'}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition"
                >
                  {LLM_PROVIDERS.find((p) => p.key === key)?.label ?? key}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Select
              label="Motor de Extração"
              value={engineMode}
              onChange={(e) => setEngineMode(e.target.value as 'llm' | 'local')}
              options={ENGINES}
            />
            <Select
              label="Modelo LLM"
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              required={engineMode === 'llm'}
              disabled={engineMode === 'local'}
              options={
                activeProvider
                  ? LLM_PROVIDERS.find((p) => p.key === activeProvider)?.models ?? []
                  : [{ value: '', label: 'Selecione um provedor primeiro...' }]
              }
            />
          </div>

          <Input
            label="Chave da API (Nova)"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={config?.api_key ? '•••••••••••• (deixe em branco para manter)' : 'Insira a chave da API'}
            disabled={engineMode === 'local'}
          />

          <Input
            label="Base URL (Opcional)"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="Padrão do provedor se vazio"
            disabled={engineMode === 'local'}
          />

          <div className="space-y-5 border-t border-[var(--border)] pt-5">
            <h3 className="font-medium text-slate-800 dark:text-slate-200">System Prompts</h3>
            <p className="text-xs text-slate-500">
              Deixe em branco para usar o prompt padrão do sistema.
            </p>

            <Textarea
              label="Prompt Clínico"
              value={clinicalPrompt}
              onChange={(e) => setClinicalPrompt(e.target.value)}
              placeholder="Instruções para extração de exames de sangue..."
              rows={5}
              disabled={engineMode === 'local'}
            />

            <Textarea
              label="Prompt Físico"
              value={physicalPrompt}
              onChange={(e) => setPhysicalPrompt(e.target.value)}
              placeholder="Instruções para análise de composição corporal..."
              rows={5}
              disabled={engineMode === 'local'}
            />
          </div>

          <div className="pt-2">
            <Button type="submit" loading={submitting} className="w-full sm:w-auto">
              Salvar Alterações
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
