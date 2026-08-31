'use client'

import { useState, useRef, useEffect, type FormEvent } from 'react'
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
    } catch (err: any) {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="relative flex flex-col w-full max-w-2xl h-[600px] max-h-[90vh] rounded-3xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl overflow-hidden">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4 bg-gradient-to-r from-primary-600 to-indigo-600 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm text-lg shadow-inner">
              🤖
            </div>
            <div>
              <h3 className="font-bold text-base flex items-center gap-2">
                Assistente de Saúde IA
                <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-normal">
                  Contexto Seguro
                </span>
              </h3>
              <p className="text-xs text-white/80">
                Análise e esclarecimentos sobre seu histórico clínico
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-white/80 hover:bg-white/20 transition"
          >
            ✕
          </button>
        </div>

        {/* Disclaimer Banner */}
        <div className="bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900/40 px-4 py-2 text-[11px] text-amber-800 dark:text-amber-300 flex items-center gap-2">
          <span>⚠️</span>
          <span>
            Orientação educacional: Esta IA não substitui consulta, diagnóstico ou conduta médica profissional.
          </span>
        </div>

        {/* Histórico de Mensagens */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-primary-600 text-white rounded-br-none shadow-md'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-bl-none border border-[var(--border)]'
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
              <div className="rounded-2xl rounded-bl-none bg-slate-100 dark:bg-slate-800 border border-[var(--border)] px-4 py-3 text-sm text-slate-500 flex items-center gap-2">
                <Spinner size="sm" className="text-primary-600" />
                <span className="text-xs italic">Consultando seu histórico e analisando dados...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Sugestões Rápidas de Perguntas */}
        <div className="px-4 py-2 border-t border-[var(--border)] bg-slate-50/50 dark:bg-slate-800/30 overflow-x-auto flex gap-2">
          {quickQuestions.map((q, idx) => (
            <button
              key={idx}
              disabled={loading}
              onClick={() => handleSend(q)}
              className="flex-shrink-0 text-[11px] font-medium bg-[var(--surface)] hover:bg-primary-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-[var(--border)] rounded-full px-3 py-1 transition disabled:opacity-50 truncate max-w-[280px]"
            >
              💬 {q}
            </button>
          ))}
        </div>

        {/* Input de envio */}
        <form
          onSubmit={handleSubmit}
          className="p-3 sm:p-4 border-t border-[var(--border)] bg-[var(--surface)] flex gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Faça uma pergunta sobre seus exames ou medidas..."
            className="flex-1 rounded-2xl border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="rounded-2xl bg-primary-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 transition disabled:opacity-50 flex items-center gap-1"
          >
            Enviar
          </button>
        </form>
      </div>
    </div>
  )
}
