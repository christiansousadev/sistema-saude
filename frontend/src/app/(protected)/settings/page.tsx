'use client'

import { FormEvent, useEffect, useState } from 'react'
import {
  Bell,
  BellRing,
  Check,
  CheckCircle2,
  Cloud,
  Copy,
  Download,
  FileArchive,
  KeyRound,
  Lock,
  Server,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Wifi,
} from 'lucide-react'

import api, { extractErrorMessage } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import * as configService from '@/lib/services/configService'
import * as auth2faService from '@/lib/services/auth2faService'
import * as notificationService from '@/lib/services/notificationService'
import { LLM_PROVIDERS, LOCAL_PROVIDERS, type LlmProvider } from '@/lib/constants/llm-providers'
import type { ApiConfiguration, EngineMode, User2FASetupResponse } from '@/types'
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
  const { user, refreshUser } = useAuth()
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

  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [exportSuccess, setExportSuccess] = useState(false)

  // estado de 2fa / totp
  const [setupData, setSetupData] = useState<User2FASetupResponse | null>(null)
  const [totpInputCode, setTotpInputCode] = useState('')
  const [loading2fa, setLoading2fa] = useState(false)
  const [error2fa, setError2fa] = useState<string | null>(null)
  const [success2fa, setSuccess2fa] = useState<string | null>(null)
  const [showDisablePrompt, setShowDisablePrompt] = useState(false)
  const [copiedSecret, setCopiedSecret] = useState(false)

  // estado de notificacoes pwa
  const [notifPerm, setNotifPerm] = useState<NotificationPermission | 'unsupported'>('default')
  const [notifSuccess, setNotifSuccess] = useState<string | null>(null)

  useEffect(() => {
    setNotifPerm(notificationService.getNotificationPermission())
  }, [])

  async function handleStart2faSetup() {
    setError2fa(null)
    setSuccess2fa(null)
    setLoading2fa(true)
    try {
      const data = await auth2faService.setup2FA()
      setSetupData(data)
    } catch (err) {
      setError2fa(extractErrorMessage(err, 'Erro ao iniciar configuração do 2FA.'))
    } finally {
      setLoading2fa(false)
    }
  }

  async function handleVerifyAndEnable2fa() {
    if (!totpInputCode || totpInputCode.length < 6) {
      setError2fa('Digite o código de 6 dígitos gerado no app.')
      return
    }
    setError2fa(null)
    setLoading2fa(true)
    try {
      await auth2faService.verify2FA(totpInputCode)
      await refreshUser()
      setSetupData(null)
      setTotpInputCode('')
      setSuccess2fa('Autenticação em Duas Etapas ativada com sucesso!')
      setTimeout(() => setSuccess2fa(null), 5000)
    } catch (err) {
      setError2fa(extractErrorMessage(err, 'Código inválido. Verifique o horário do dispositivo e tente novamente.'))
    } finally {
      setLoading2fa(false)
    }
  }

  async function handleDisable2fa() {
    if (!totpInputCode || totpInputCode.length < 6) {
      setError2fa('Digite o código de 6 dígitos para confirmar a desativação.')
      return
    }
    setError2fa(null)
    setLoading2fa(true)
    try {
      await auth2faService.disable2FA(totpInputCode)
      await refreshUser()
      setShowDisablePrompt(false)
      setTotpInputCode('')
      setSuccess2fa('2FA desativado com sucesso.')
      setTimeout(() => setSuccess2fa(null), 5000)
    } catch (err) {
      setError2fa(extractErrorMessage(err, 'Código incorreto para desativação.'))
    } finally {
      setLoading2fa(false)
    }
  }

  function handleCopySecret() {
    if (setupData?.secret) {
      navigator.clipboard.writeText(setupData.secret)
      setCopiedSecret(true)
      setTimeout(() => setCopiedSecret(false), 2500)
    }
  }

  async function handleRequestNotif() {
    const perm = await notificationService.requestNotificationPermission()
    setNotifPerm(perm)
    if (perm === 'granted') {
      await notificationService.sendLocalNotification('Sistema Saúde Ativo', {
        body: 'Notificações habilitadas com sucesso! Você receberá lembretes de hidratação e medicação.',
      })
      setNotifSuccess('Notificações ativadas com sucesso!')
      setTimeout(() => setNotifSuccess(null), 4000)
    }
  }

  async function handleTestNotif() {
    const sent = await notificationService.sendLocalNotification('Lembrete de Hidratação', {
      body: 'Hora de beber 250ml de água para manter seu ritmo de saúde!',
    })
    if (sent) {
      setNotifSuccess('Notificação de teste enviada para o dispositivo.')
      setTimeout(() => setNotifSuccess(null), 3500)
    }
  }

  async function handleExportLgpd() {
    setExportError(null)
    setExportSuccess(false)
    setExporting(true)
    try {
      const res = await api.get('/export/patient-data', {
        responseType: 'blob',
      })
      const blob = new Blob([res.data], { type: 'application/zip' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `dados_saude_lgpd_${new Date().toISOString().slice(0, 10)}.zip`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      setExportSuccess(true)
      setTimeout(() => setExportSuccess(false), 4000)
    } catch (err) {
      setExportError(extractErrorMessage(err, 'Erro ao exportar arquivo de dados.'))
    } finally {
      setExporting(false)
    }
  }

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

      {/* portabilidade de dados e LGPD */}
      <div className="rounded-3xl border border-white/[0.06] bg-slate-900/60 p-6 sm:p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-400 ring-1 ring-sky-500/20">
            <FileArchive className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">
              Portabilidade de Dados Pessoais (LGPD)
            </h2>
            <p className="text-xs text-slate-400">
              Direito à portabilidade assegurado pelo Artigo 18, inciso V da Lei Federal 13.709/2018
            </p>
          </div>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed mb-5">
          Baixe um pacote completo compactado (<span className="text-sky-300 font-semibold">.ZIP</span>) contendo todos os seus dados cadastrais em JSON, histórico antropométrico detalhado em CSV, biomarcadores laboratoriais com séries temporais em CSV, registro diário de hidratação/hábitos em CSV e medicamentos.
        </p>

        {exportError && (
          <div className="mb-4 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
            {exportError}
          </div>
        )}

        {exportSuccess && (
          <div className="mb-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
            Exportação concluída! O download do arquivo .ZIP foi iniciado no seu navegador.
          </div>
        )}

        <Button
          type="button"
          onClick={handleExportLgpd}
          loading={exporting}
          variant="secondary"
          className="border-sky-500/30 text-sky-300 hover:bg-sky-500/10 flex items-center gap-2"
        >
          <Download className="h-4 w-4" />
          {exporting ? 'Gerando arquivo consolidado...' : 'Exportar todos os meus dados (.ZIP)'}
        </Button>
      </div>

      {/* seguranca da conta e autenticacao em duas etapas (2fa / totp) */}
      <div className="rounded-3xl border border-white/[0.06] bg-slate-900/60 p-6 sm:p-8 shadow-sm">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <span className={`flex h-10 w-10 items-center justify-center rounded-2xl ${
              user?.is_totp_enabled
                ? 'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20'
                : 'bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20'
            }`}>
              {user?.is_totp_enabled ? <ShieldCheck className="h-5 w-5" /> : <Shield className="h-5 w-5" />}
            </span>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Autenticação em Duas Etapas (2FA)
              </h2>
              <p className="text-xs text-slate-400">
                Segurança biométrica e códigos temporários TOTP (Google Authenticator, Authy, etc.)
              </p>
            </div>
          </div>
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
            user?.is_totp_enabled
              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
              : 'bg-slate-800 text-slate-400 border border-white/10'
          }`}>
            {user?.is_totp_enabled ? 'Ativo' : 'Desativado'}
          </span>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed mb-5">
          {user?.is_totp_enabled
            ? 'Sua conta está protegida por verificação em duas etapas. Todo login exigirá seu código temporário gerado no aplicativo do seu celular.'
            : 'Adicione uma barreira intransponível contra invasões. Ao ativar o 2FA, cada novo login precisará da sua senha e do código gerado no smartphone.'}
        </p>

        {error2fa && (
          <div className="mb-4 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
            {error2fa}
          </div>
        )}

        {success2fa && (
          <div className="mb-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
            {success2fa}
          </div>
        )}

        {/* fluxo de 2fa ativo */}
        {user?.is_totp_enabled ? (
          <div>
            {!showDisablePrompt ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowDisablePrompt(true)}
                className="text-xs border-rose-500/30 text-rose-300 hover:bg-rose-500/10"
              >
                Desativar autenticação 2FA
              </Button>
            ) : (
              <div className="space-y-4 rounded-2xl border border-rose-500/20 bg-rose-500/[0.04] p-5">
                <p className="text-xs font-semibold text-rose-300">
                  Confirmar desativação do 2FA
                </p>
                <p className="text-xs text-slate-400">
                  Digite o código atual de 6 dígitos do seu autenticador para confirmar a desativação:
                </p>
                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <Input
                    label=""
                    type="text"
                    value={totpInputCode}
                    onChange={(e) => setTotpInputCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    className="text-center font-mono text-base tracking-widest max-w-[180px]"
                    autoFocus
                  />
                  <div className="flex gap-2 w-full sm:w-auto">
                    <Button
                      type="button"
                      loading={loading2fa}
                      onClick={handleDisable2fa}
                      className="bg-rose-600 hover:bg-rose-500 text-white text-xs px-4"
                    >
                      Confirmar
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        setShowDisablePrompt(false)
                        setTotpInputCode('')
                        setError2fa(null)
                      }}
                      className="text-xs px-4"
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* fluxo de configuracao 2fa */
          <div>
            {!setupData ? (
              <Button
                type="button"
                onClick={handleStart2faSetup}
                loading={loading2fa}
                className="text-xs flex items-center gap-2"
              >
                <Lock className="h-4 w-4" />
                Configurar 2FA agora
              </Button>
            ) : (
              <div className="space-y-5 rounded-2xl border border-sky-500/20 bg-sky-500/[0.04] p-5">
                <div>
                  <h3 className="text-sm font-semibold text-white">Configurar Aplicativo Autenticador</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    1. Abra o Google Authenticator, Microsoft Authenticator ou similar e escaneie o código abaixo:
                  </p>
                </div>

                {/* qr code gerado */}
                <div className="flex flex-col items-center justify-center p-3 rounded-2xl bg-slate-950/80 border border-white/10 w-fit mx-auto shadow-xl">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(setupData.otpauth_url)}`}
                    alt="QR Code de Configuração 2FA"
                    className="h-44 w-44 rounded-xl bg-white p-2"
                  />
                  <span className="text-[11px] text-slate-400 mt-2">Escaneie com a câmera do app</span>
                </div>

                {/* chave manual */}
                <div className="space-y-1.5">
                  <p className="text-xs text-slate-400">
                    2. Ou insira a chave secreta manualmente no seu aplicativo:
                  </p>
                  <div className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-950/60 px-4 py-2.5">
                    <span className="font-mono text-xs tracking-wider text-sky-300 select-all">
                      {setupData.secret}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopySecret}
                      className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1.5 ml-2"
                    >
                      {copiedSecret ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                      {copiedSecret ? 'Copiado!' : 'Copiar'}
                    </button>
                  </div>
                </div>

                {/* validacao do codigo */}
                <div className="space-y-3 pt-2">
                  <p className="text-xs text-slate-300 font-medium">
                    3. Digite o código de 6 dígitos que apareceu no aplicativo para validar:
                  </p>
                  <div className="flex flex-col sm:flex-row items-center gap-3">
                    <Input
                      label=""
                      type="text"
                      value={totpInputCode}
                      onChange={(e) => setTotpInputCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000"
                      className="text-center font-mono text-base tracking-widest max-w-[180px]"
                      autoFocus
                    />
                    <div className="flex gap-2 w-full sm:w-auto">
                      <Button
                        type="button"
                        onClick={handleVerifyAndEnable2fa}
                        loading={loading2fa}
                        className="text-xs px-4"
                      >
                        Verificar e Ativar
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                          setSetupData(null)
                          setTotpInputCode('')
                          setError2fa(null)
                        }}
                        className="text-xs px-4"
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* lembretes e aplicativo pwa */}
      <div className="rounded-3xl border border-white/[0.06] bg-slate-900/60 p-6 sm:p-8 shadow-sm">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-400 ring-1 ring-sky-500/20">
              <Bell className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Lembretes & Aplicativo PWA
              </h2>
              <p className="text-xs text-slate-400">
                Notificações de hidratação, horários de medicamentos e suporte offline
              </p>
            </div>
          </div>
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
            notifPerm === 'granted'
              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
              : notifPerm === 'denied'
              ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
              : 'bg-slate-800 text-slate-400 border border-white/10'
          }`}>
            {notifPerm === 'granted'
              ? 'Notificações Ativas'
              : notifPerm === 'denied'
              ? 'Bloqueado no Navegador'
              : 'Padrão'}
          </span>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed mb-5">
          Receba lembretes automáticos no navegador ou smartphone para beber água e tomar suas medicações pontualmente. O sistema conta ainda com suporte a Progressive Web App (PWA) e cache offline via Service Worker.
        </p>

        {notifSuccess && (
          <div className="mb-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
            {notifSuccess}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          {notifPerm !== 'granted' ? (
            <Button
              type="button"
              onClick={handleRequestNotif}
              className="text-xs flex items-center gap-2"
            >
              <BellRing className="h-4 w-4" />
              Ativar Notificações no Navegador
            </Button>
          ) : (
            <Button
              type="button"
              variant="secondary"
              onClick={handleTestNotif}
              className="border-sky-500/30 text-sky-300 hover:bg-sky-500/10 text-xs flex items-center gap-2"
            >
              <BellRing className="h-4 w-4" />
              Enviar Notificação de Teste
            </Button>
          )}

          <div className="flex items-center gap-2 text-xs text-slate-400 bg-white/[0.02] border border-white/10 rounded-xl px-3 py-2">
            <Wifi className="h-3.5 w-3.5 text-emerald-400" />
            <span>PWA & Service Worker Ativo</span>
          </div>
        </div>
      </div>
    </div>
  )
}
