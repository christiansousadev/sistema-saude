'use client'

import { useState, useRef, useEffect, type FormEvent } from 'react'
import { Send, ShieldAlert, Sparkles, X } from 'lucide-react'
import { sendAssistantMessage } from '@/lib/services/assistantService'
import type { ChatMessage } from '@/types'
import Spinner from '@/components/ui/Spinner'

interface HealthAssistantModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function HealthAssistantModal({ isOpen, onClose }: HealthAssistantModalProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content:
        'Olá! Sou sua Assistente de Saúde com IA. Tenho acesso ao seu histórico recente de medições corporais e exames laboratoriais cadastrados.\n\nComo posso ajudar você hoje?',
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const quickQuestions = [
    'Como está meu perfil lipídico e colesterol?',
    'Faça um resumo geral da minha evolução física',
    'Quais marcadores dos meus exames merecem atenção?',
    'Qual a importância de manter meu peso e IMC estáveis?',
  ]

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function handleSend(textToSend?: string) {
    const text = textToSend || input
    if (!text.trim() || loading) return

    const userMsg: ChatMessage = { role: 'user', content: text.trim() }
    const newHistory = [...messages, userMsg]
    setMessages(newHistory)
    setInput('')
    setLoading(true)

    try {
      const res = await sendAssistantMessage({
        message: userMsg.content,
        conversation_history: messages.slice(-6),
      })
      setMessages([...newHistory, { role: 'assistant', content: res.reply }])
    } catch {
      setMessages([
        ...newHistory,
        {
          role: 'assistant',
          content:
            'Desculpe, ocorreu uma instabilidade ao processar sua pergunta. Por favor, tente novamente.',
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    handleSend()
  }

  if (!isOpen) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Assistente de saúde IA"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4"
    >
      <div className="relative flex flex-col w-full max-w-2xl h-[600px] max-h-[90vh] rounded-3xl border border-white/10 bg-slate-950 shadow-2xl overflow-hidden">
        {/* cabeçalho */}
        <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400">
              <Sparkles className="h-5 w-5" strokeWidth={2} />
            </div>
            <div>
              <h3 className="flex items-center gap-2 text-base font-bold text-white">
                Assistente de saúde IA
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-normal text-slate-400">
                  Contexto seguro
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Análise e esclarecimentos sobre seu histórico clínico
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar assistente"
            className="rounded-full p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>

        {/* histórico de mensagens */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-sky-500/90 text-white rounded-br-md shadow-md'
                    : 'bg-white/[0.04] text-slate-200 rounded-bl-md border border-white/[0.06]'
                }`}
              >
                <div className="whitespace-pre-wrap font-sans">
                  {m.content}
                </div>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-md border border-white/[0.06] bg-white/[0.04] px-4 py-3 text-sm text-slate-400 flex items-center gap-2">
                <Spinner size="sm" className="text-emerald-400" />
                <span className="text-xs italic">Consultando seu histórico e analisando dados...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* sugestões rápidas de perguntas */}
        <div className="px-4 py-2 border-t border-white/[0.06] overflow-x-auto flex gap-2">
          {quickQuestions.map((q, idx) => (
            <button
              key={idx}
              disabled={loading}
              onClick={() => handleSend(q)}
              className="flex-shrink-0 truncate max-w-[280px] rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] font-medium text-slate-300 transition hover:border-white/20 hover:bg-white/[0.07] disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>

        {/* disclaimer médico */}
        <div className="flex items-center gap-2 border-t border-amber-500/10 bg-amber-500/[0.05] px-4 py-2 text-[11px] text-amber-300/90">
          <ShieldAlert className="h-3.5 w-3.5 flex-shrink-0" strokeWidth={2} />
          <span>
            Orientação educacional: esta IA não substitui consulta, diagnóstico ou conduta médica profissional.
          </span>
        </div>

        {/* input de envio */}
        <form
          onSubmit={handleSubmit}
          className="p-3 sm:p-4 border-t border-white/[0.06] flex gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Faça uma pergunta sobre seus exames ou medidas..."
            className="flex-1 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none transition focus:border-sky-500/50 focus:ring-2 focus:ring-sky-500/20"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            aria-label="Enviar mensagem"
            className="flex items-center gap-1.5 rounded-2xl bg-sky-500 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-400 disabled:opacity-50"
          >
            <Send className="h-4 w-4" strokeWidth={2} />
            <span className="hidden sm:inline">Enviar</span>
          </button>
        </form>
      </div>
    </div>
  )
}
