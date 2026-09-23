'use client'

import { FormEvent, useEffect, useState } from 'react'
import { Cloud, KeyRound, Server, ShieldCheck } from 'lucide-react'

import { extractErrorMessage } from '@/lib/api'
import * as configService from '@/lib/services/configService'
import { LLM_PROVIDERS, LOCAL_PROVIDERS, type LlmProvider } from '@/lib/constants/llm-providers'
import type { ApiConfiguration, EngineMode } from '@/types'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Spinner from '@/components/ui/Spinner'

const ENGINE_OPTIONS = [
  { value: 'llm' as const, label: 'LLM (nuvem)', desc: 'OpenAI, Gemini, etc.', icon: Cloud },
  { value: 'local' as const, label: 'Local', desc: 'Ollama, LM Studio', icon: Server },
]

// ─── página ───────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [current, setCurrent] = useState<ApiConfiguration | null>(null)
  const [loadingConfig, setLoadingConfig] = useState(true)

  const [engineMode, setEngineMode] = useState<EngineMode>('llm')
  const [provider, setProvider] = useState<LlmProvider>(LLM_PROVIDERS[0])
  // nunca é pré-preenchido com a chave vinda do backend: só o placeholder indica que já existe uma
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
        setModelName(cfg.model_name)
        setBaseUrl(cfg.base_url ?? '')
        // identifica o provider pelo base_url
        const providers = cfg.engine_mode === 'llm' ? LLM_PROVIDERS : LOCAL_PROVIDERS
        const found = providers.find((p) => p.base_url === (cfg.base_url ?? null))
        if (found) setProvider(found)
      }
    }).finally(() => setLoadingConfig(false))
  }, [])

  function selectProvider(p: LlmProvider) {
    setProvider(p)
    if (p.base_url !== '') setBaseUrl(p.base_url ?? '')
    if (p.models.length) setModelName(p.models[0].value)
  }

  function handleEngineChange(mode: EngineMode) {
    setEngineMode(mode)
    const providers = mode === 'llm' ? LLM_PROVIDERS : LOCAL_PROVIDERS
    setProvider(providers[0])
    setBaseUrl(providers[0].base_url ?? '')
    setModelName(providers[0].models[0]?.value ?? '')
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
        <Spinner size="lg" className="text-sky-400" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 pb-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Configurações de IA</h1>
        <p className="mt-1 text-sm text-slate-400">
          Escolha o motor de inteligência artificial para extração e análise dos seus dados.
        </p>
      </div>

      {/* status atual */}
      {current && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          <p className="text-sm text-emerald-300">
            Motor ativo:{' '}
            <strong className="text-emerald-200">
              {current.engine_mode === 'llm' ? 'LLM' : 'Local'} — {current.model_name}
            </strong>
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* seleção de motor */}
        <div className="rounded-2xl border border-white/[0.06] bg-slate-900/60 p-6 shadow-sm">
          <p className="mb-4 text-sm font-semibold text-slate-300">Motor de IA</p>
          <div className="grid grid-cols-2 gap-3">
            {ENGINE_OPTIONS.map(({ value, label, desc, icon: Icon }) => {
              const active = engineMode === value
              return (
                <div
                  key={value}
                  className={active ? 'rounded-xl bg-gradient-to-br from-emerald-400 to-sky-500 p-[1.5px]' : ''}
                >
                  <button
                    type="button"
                    onClick={() => handleEngineChange(value)}
                    className={`flex w-full flex-col gap-2 rounded-[11px] p-4 text-left transition ${
                      active
                        ? 'bg-slate-900'
                        : 'border border-white/10 bg-white/[0.02] hover:border-white/20'
                    }`}
                  >
                    <Icon className={`h-4 w-4 ${active ? 'text-sky-400' : 'text-slate-500'}`} strokeWidth={2} />
                    <span className="font-medium text-slate-100">{label}</span>
                    <span className="text-xs text-slate-500">{desc}</span>
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        {/* provedor e modelo */}
        <div className="space-y-4 rounded-2xl border border-white/[0.06] bg-slate-900/60 p-6 shadow-sm">
          <p className="text-sm font-semibold text-slate-300">
            {engineMode === 'llm' ? 'Provedor' : 'Servidor local'}
          </p>

          <div className="flex flex-wrap gap-2">
            {providers.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => selectProvider(p)}
                className={`min-h-11 rounded-lg border px-3 text-sm transition ${
                  provider.label === p.label
                    ? 'border-sky-500/40 bg-sky-500/10 font-medium text-sky-300'
                    : 'border-white/10 text-slate-400 hover:border-white/20 hover:text-slate-200'
                }`}
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
              options={provider.models}
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
              placeholder={current?.model_name ? '•••••••••••• (deixe em branco para manter)' : 'sk-...'}
              autoComplete="off"
              suffix={<KeyRound className="h-4 w-4 text-slate-500" strokeWidth={2} />}
            />
          )}

          {/* banner informativo sobre privacidade */}
          <div className="flex items-start gap-2.5 rounded-xl border border-sky-500/20 bg-sky-500/[0.06] px-4 py-3">
            <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-sky-400" strokeWidth={2} />
            <p className="text-xs text-sky-200/80">
              Sua chave é criptografada em repouso e nunca é reexibida no navegador. Com o motor LLM,
              suas fotos e laudos são enviados apenas ao provedor configurado acima para a extração.
            </p>
          </div>
        </div>

        {saveError && (
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
            {saveError}
          </div>
        )}

        {saveSuccess && (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
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
