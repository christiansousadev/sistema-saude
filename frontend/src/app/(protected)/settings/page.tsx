'use client'

import { FormEvent, useEffect, useState } from 'react'

import { extractErrorMessage } from '@/lib/api'
import * as configService from '@/lib/services/configService'
import type { ApiConfiguration, EngineMode } from '@/types'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Spinner from '@/components/ui/Spinner'

// ─── presets de provedores ────────────────────────────────────────────────────

interface Provider {
  label: string
  base_url: string | null
  models: string[]
}

const LLM_PROVIDERS: Provider[] = [
  {
    label: 'OpenAI',
    base_url: null,
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
  },
  {
    label: 'Google Gemini',
    base_url: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    models: ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'],
  },
  {
    label: 'Custom (OpenAI-compatível)',
    base_url: '',
    models: [],
  },
]

const LOCAL_PROVIDERS: Provider[] = [
  {
    label: 'Ollama (padrão)',
    base_url: 'http://localhost:11434/v1',
    models: ['llama3.2', 'mistral', 'llava'],
  },
  {
    label: 'LM Studio',
    base_url: 'http://localhost:1234/v1',
    models: [],
  },
  {
    label: 'Custom',
    base_url: '',
    models: [],
  },
]

// ─── página ───────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [current, setCurrent] = useState<ApiConfiguration | null>(null)
  const [loadingConfig, setLoadingConfig] = useState(true)

  const [engineMode, setEngineMode] = useState<EngineMode>('llm')
  const [provider, setProvider] = useState<Provider>(LLM_PROVIDERS[0])
  const [apiKey, setApiKey] = useState('')
  const [modelName, setModelName] = useState('')
  const [baseUrl, setBaseUrl] = useState('')

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  useEffect(() => {
    configService.getActiveConfig().then((cfg) => {
      if (cfg) {
        setCurrent(cfg)
        setEngineMode(cfg.engine_mode)
        setApiKey(cfg.api_key ?? '')
        setModelName(cfg.model_name)
        setBaseUrl(cfg.base_url ?? '')
        // identifica o provider pelo base_url
        const providers = cfg.engine_mode === 'llm' ? LLM_PROVIDERS : LOCAL_PROVIDERS
        const found = providers.find((p) => p.base_url === (cfg.base_url ?? null))
        if (found) setProvider(found)
      }
    }).finally(() => setLoadingConfig(false))
  }, [])

  function selectProvider(p: Provider) {
    setProvider(p)
    if (p.base_url !== '') setBaseUrl(p.base_url ?? '')
    if (p.models.length) setModelName(p.models[0])
  }

  function handleEngineChange(mode: EngineMode) {
    setEngineMode(mode)
    const providers = mode === 'llm' ? LLM_PROVIDERS : LOCAL_PROVIDERS
    setProvider(providers[0])
    setBaseUrl(providers[0].base_url ?? '')
    setModelName(providers[0].models[0] ?? '')
    if (mode === 'local') setApiKey('')
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaveError(null)
    setSaveSuccess(false)
    setSaving(true)

    try {
      const saved = await configService.saveConfig({
        engine_mode: engineMode,
        api_key: engineMode === 'llm' ? apiKey || null : null,
        model_name: modelName,
        base_url: baseUrl || null,
      })
      setCurrent(saved)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err) {
      setSaveError(extractErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const providers = engineMode === 'llm' ? LLM_PROVIDERS : LOCAL_PROVIDERS
  const isCustom = provider.base_url === ''

  if (loadingConfig) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner size="lg" className="text-primary-500" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Configurações de IA</h1>
        <p className="mt-1 text-sm text-slate-500">
          Escolha o motor de inteligência artificial para extração e análise dos seus dados.
        </p>
      </div>

      {/* status atual */}
      {current && (
        <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 dark:border-green-800/50 dark:bg-green-900/20">
          <span className="h-2 w-2 rounded-full bg-green-500" />
          <p className="text-sm text-green-700 dark:text-green-400">
            Motor ativo:{' '}
            <strong>
              {current.engine_mode === 'llm' ? '☁ LLM' : '💻 Local'} — {current.model_name}
            </strong>
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* seleção de motor */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
          <p className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
            Motor de IA
          </p>
          <div className="grid grid-cols-2 gap-3">
            {(
              [
                { value: 'llm', label: '☁ LLM (Nuvem)', desc: 'OpenAI, Gemini, etc.' },
                { value: 'local', label: '💻 Local', desc: 'Ollama, LM Studio' },
              ] as const
            ).map(({ value, label, desc }) => (
              <button
                key={value}
                type="button"
                onClick={() => handleEngineChange(value)}
                className={[
                  'flex flex-col rounded-xl border-2 p-4 text-left transition',
                  engineMode === value
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600',
                ].join(' ')}
              >
                <span className="font-medium text-slate-800 dark:text-slate-200">{label}</span>
                <span className="text-xs text-slate-400">{desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* provedor e modelo */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm space-y-4">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            {engineMode === 'llm' ? 'Provedor' : 'Servidor local'}
          </p>

          <div className="flex flex-wrap gap-2">
            {providers.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => selectProvider(p)}
                className={[
                  'rounded-lg border px-3 py-1.5 text-sm transition',
                  provider.label === p.label
                    ? 'border-primary-500 bg-primary-50 font-medium text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                    : 'border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-400',
                ].join(' ')}
              >
                {p.label}
              </button>
            ))}
          </div>

          {isCustom && (
            <Input
              label="URL base"
              type="url"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://meu-servidor.com/v1"
              helpText="Endpoint compatível com a API OpenAI"
            />
          )}

          {provider.models.length > 0 ? (
            <Select
              label="Modelo"
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              options={provider.models.map((m) => ({ value: m, label: m }))}
            />
          ) : (
            <Input
              label="Nome do modelo"
              type="text"
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              placeholder={engineMode === 'llm' ? 'gpt-4o-mini' : 'llama3.2'}
              required
            />
          )}

          {engineMode === 'llm' && (
            <Input
              label="Chave de API"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
              autoComplete="off"
              helpText="Sua chave é armazenada no banco de dados do servidor."
            />
          )}
        </div>

        {saveError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
            {saveError}
          </div>
        )}

        {saveSuccess && (
          <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400">
            Configuração salva com sucesso!
          </div>
        )}

        <Button type="submit" loading={saving} size="lg">
          Salvar configuração
        </Button>
      </form>
    </div>
  )
}
