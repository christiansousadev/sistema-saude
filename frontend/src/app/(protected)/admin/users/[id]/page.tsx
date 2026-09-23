'use client'

import { type FormEvent, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Cpu, FileText } from 'lucide-react'

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

// provedores rápidos exibidos como atalho, a lista completa vive em lib/constants/llm-providers
const QUICK_PROVIDER_KEYS = ['openai', 'gemini', 'claude', 'grok', 'deepseek']

type Tab = 'engine' | 'prompts'

const TABS: { value: Tab; label: string; icon: typeof Cpu }[] = [
  { value: 'engine', label: 'Motor & modelo', icon: Cpu },
  { value: 'prompts', label: 'System prompts', icon: FileText },
]

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
  const [activeTab, setActiveTab] = useState<Tab>('engine')

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
        <Spinner size="md" className="text-sky-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-6 animate-in fade-in duration-500 max-w-2xl">
      <div className="flex items-center gap-4">
        <Link
          href="/admin"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-400 transition hover:bg-white/10 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Configuração do usuário</h1>
          <p className="text-sm text-slate-500">ID: {userId}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-white/[0.06] bg-slate-900/60 shadow-sm">
        {/* abas */}
        <div className="flex border-b border-white/[0.06] px-2">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setActiveTab(tab.value)}
              className={`flex min-h-11 items-center gap-1.5 border-b-2 px-4 text-sm font-medium transition ${
                activeTab === tab.value
                  ? 'border-sky-500 text-white'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              <tab.icon className="h-3.5 w-3.5" strokeWidth={2} />
              {tab.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-6">
          {error && (
            <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
              Configuração salva com sucesso.
            </div>
          )}

          {activeTab === 'engine' && (
            <div className="space-y-5">
              <div className="space-y-3 border-b border-white/[0.06] pb-5">
                <h3 className="text-sm font-medium text-slate-300">Provedor rápido (auto-fill)</h3>
                <div className="flex flex-wrap gap-2">
                  {QUICK_PROVIDER_KEYS.map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleQuickProvider(key)}
                      disabled={engineMode === 'local'}
                      className="min-h-9 rounded-full border border-white/10 bg-white/[0.03] px-3 text-xs font-medium text-slate-300 transition hover:bg-white/10 disabled:opacity-50"
                    >
                      {LLM_PROVIDERS.find((p) => p.key === key)?.label ?? key}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <Select
                  label="Motor de extração"
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
                label="Chave da API (nova)"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={config?.api_key ? '•••••••••••• (deixe em branco para manter)' : 'Insira a chave da API'}
                disabled={engineMode === 'local'}
              />

              <Input
                label="Base URL (opcional)"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="Padrão do provedor se vazio"
                disabled={engineMode === 'local'}
              />
            </div>
          )}

          {activeTab === 'prompts' && (
            <div className="space-y-5">
              <p className="text-xs text-slate-500">
                Deixe em branco para usar o prompt padrão do sistema.
              </p>

              <Textarea
                label="Prompt clínico"
                value={clinicalPrompt}
                onChange={(e) => setClinicalPrompt(e.target.value)}
                placeholder="Instruções para extração de exames de sangue..."
                rows={6}
                disabled={engineMode === 'local'}
              />

              <Textarea
                label="Prompt físico"
                value={physicalPrompt}
                onChange={(e) => setPhysicalPrompt(e.target.value)}
                placeholder="Instruções para análise de composição corporal..."
                rows={6}
                disabled={engineMode === 'local'}
              />
            </div>
          )}

          <div className="pt-2">
            <Button type="submit" loading={submitting} className="w-full sm:w-auto">
              Salvar alterações
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
