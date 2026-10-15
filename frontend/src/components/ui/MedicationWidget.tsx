'use client'

import { useEffect, useState } from 'react'
import {
  Check,
  CheckCircle2,
  Clock,
  Pill,
  Plus,
  Power,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'

import * as medicationService from '@/lib/services/medicationService'
import type { MedicationCreate, MedicationResponse } from '@/types'
import { Skeleton } from '@/components/ui/Skeleton'

const CATEGORY_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  medicamento: {
    bg: 'bg-rose-500/10',
    text: 'text-rose-300',
    border: 'border-rose-500/20',
  },
  suplemento: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-300',
    border: 'border-emerald-500/20',
  },
  vitamina: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-300',
    border: 'border-amber-500/20',
  },
}

export default function MedicationWidget() {
  const [medications, setMedications] = useState<MedicationResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [filter, setFilter] = useState<'all' | 'active' | 'medicamento' | 'suplemento'>('active')

  // campos do formulario de cadastro
  const [form, setForm] = useState<MedicationCreate>({
    name: '',
    dosage: '',
    frequency: '',
    category: 'medicamento',
    instructions: '',
    is_active: true,
  })

  async function loadMedications() {
    try {
      const data = await medicationService.listMedications(false)
      setMedications(data.items)
    } catch {
      // falha silenciosa
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMedications()
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.dosage || !form.frequency) return

    setSubmitting(true)
    try {
      const created = await medicationService.createMedication(form)
      setMedications((prev) => [created, ...prev])
      setForm({
        name: '',
        dosage: '',
        frequency: '',
        category: 'medicamento',
        instructions: '',
        is_active: true,
      })
      setShowAddForm(false)
    } catch {
      // tratamento de erro
    } finally {
      setSubmitting(false)
    }
  }

  async function handleToggleActive(med: MedicationResponse) {
    try {
      const updated = await medicationService.updateMedication(med.id, {
        is_active: !med.is_active,
      })
      setMedications((prev) =>
        prev.map((item) => (item.id === med.id ? updated : item))
      )
    } catch {
      // reverter se falhar
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Deseja realmente remover este item do seu acompanhamento?')) return
    try {
      await medicationService.deleteMedication(id)
      setMedications((prev) => prev.filter((item) => item.id !== id))
    } catch {
      // erro ao excluir
    }
  }

  const filteredItems = medications.filter((m) => {
    if (filter === 'active') return m.is_active
    if (filter === 'medicamento') return m.category === 'medicamento'
    if (filter === 'suplemento') return m.category === 'suplemento' || m.category === 'vitamina'
    return true
  })

  return (
    <div className="rounded-3xl border border-white/[0.06] bg-slate-900/60 p-6 shadow-sm backdrop-blur-sm">
      {/* cabecalho do widget */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400 ring-1 ring-purple-500/20">
            <Pill className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200">
              Medicamentos & Suplementos
            </h2>
            <p className="text-xs text-slate-400">
              Acompanhamento contínuo de prescrições e dosagens
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-purple-500/30 bg-purple-500/10 px-3 py-1.5 text-xs font-semibold text-purple-300 transition hover:bg-purple-500/20"
        >
          {showAddForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          <span>{showAddForm ? 'Cancelar' : 'Adicionar Item'}</span>
        </button>
      </div>

      {/* formulario retratil de adicao */}
      {showAddForm && (
        <form
          onSubmit={handleCreate}
          className="mb-6 rounded-2xl border border-purple-500/20 bg-purple-950/20 p-5 space-y-4 animate-in fade-in slide-in-from-top duration-300"
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Nome do medicamento / suplemento *
              </label>
              <input
                type="text"
                placeholder="Ex: Ômega 3, Vitamina D3, Losartana"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-purple-400 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Dosagem *
              </label>
              <input
                type="text"
                placeholder="Ex: 50mg, 1000 UI, 2 cápsulas"
                value={form.dosage}
                onChange={(e) => setForm({ ...form, dosage: e.target.value })}
                required
                className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-purple-400 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Frequência / Horário *
              </label>
              <input
                type="text"
                placeholder="Ex: 1x ao dia pela manhã, 8h em 8h"
                value={form.frequency}
                onChange={(e) => setForm({ ...form, frequency: e.target.value })}
                required
                className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-purple-400 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Categoria
              </label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-xs text-white focus:border-purple-400 focus:outline-none"
              >
                <option value="medicamento">Medicamento Prescrito</option>
                <option value="suplemento">Suplemento Alimentar</option>
                <option value="vitamina">Vitamina / Mineral</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Instruções ou observações
              </label>
              <input
                type="text"
                placeholder="Ex: Tomar após o almoço com água"
                value={form.instructions || ''}
                onChange={(e) => setForm({ ...form, instructions: e.target.value })}
                className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-purple-400 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="rounded-xl px-4 py-2 text-xs font-medium text-slate-400 hover:text-white transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-purple-600 px-5 py-2 text-xs font-bold text-white shadow-md transition hover:bg-purple-500 disabled:opacity-50"
            >
              {submitting ? 'Salvando...' : 'Salvar no Prontuário'}
            </button>
          </div>
        </form>
      )}

      {/* abas de filtro */}
      <div className="flex gap-2 border-b border-white/[0.06] pb-3 mb-4 text-xs">
        <button
          onClick={() => setFilter('active')}
          className={`pb-1 font-semibold transition ${
            filter === 'active'
              ? 'border-b-2 border-purple-400 text-purple-300'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Em Uso ({medications.filter((m) => m.is_active).length})
        </button>
        <button
          onClick={() => setFilter('all')}
          className={`pb-1 font-semibold transition ${
            filter === 'all'
              ? 'border-b-2 border-purple-400 text-purple-300'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Histórico Completo ({medications.length})
        </button>
        <button
          onClick={() => setFilter('medicamento')}
          className={`pb-1 font-semibold transition ${
            filter === 'medicamento'
              ? 'border-b-2 border-purple-400 text-purple-300'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Medicamentos
        </button>
        <button
          onClick={() => setFilter('suplemento')}
          className={`pb-1 font-semibold transition ${
            filter === 'suplemento'
              ? 'border-b-2 border-purple-400 text-purple-300'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Suplementos & Vitaminas
        </button>
      </div>

      {/* lista de itens */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-2xl" />
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center text-slate-500 rounded-2xl border border-dashed border-white/10">
          <Pill className="h-7 w-7 mb-2 opacity-50" />
          <p className="text-xs">Nenhum item encontrado nesta categoria.</p>
          <button
            onClick={() => setShowAddForm(true)}
            className="mt-2 text-xs font-semibold text-purple-400 hover:text-purple-300 transition"
          >
            Cadastrar primeiro medicamento →
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredItems.map((med) => {
            const catStyle = CATEGORY_STYLES[med.category] || CATEGORY_STYLES.medicamento

            return (
              <div
                key={med.id}
                className={`flex flex-col justify-between rounded-2xl border p-4 transition ${
                  med.is_active
                    ? 'border-white/[0.06] bg-slate-900/50 hover:border-white/[0.12]'
                    : 'border-white/[0.02] bg-slate-950/40 opacity-60'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          med.is_active ? 'bg-emerald-400 ring-2 ring-emerald-400/20' : 'bg-slate-600'
                        }`}
                      />
                      <h3 className="text-sm font-bold text-white tracking-tight">{med.name}</h3>
                    </div>
                    <span
                      className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}
                    >
                      {med.category}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300 mt-1">
                    <span className="font-semibold text-white bg-white/[0.04] px-2 py-0.5 rounded-md">
                      {med.dosage}
                    </span>
                    <span className="flex items-center gap-1 text-slate-400">
                      <Clock className="h-3 w-3" />
                      {med.frequency}
                    </span>
                  </div>

                  {med.instructions && (
                    <p className="mt-2 text-[11px] text-slate-400 italic">
                      Obs: {med.instructions}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between border-t border-white/[0.04] pt-2.5 mt-3">
                  <button
                    onClick={() => handleToggleActive(med)}
                    title={med.is_active ? 'Pausar uso' : 'Reativar uso'}
                    className={`inline-flex items-center gap-1.5 text-xs font-medium transition ${
                      med.is_active
                        ? 'text-emerald-400 hover:text-emerald-300'
                        : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    <Power className="h-3 w-3" />
                    <span>{med.is_active ? 'Em uso' : 'Pausado'}</span>
                  </button>

                  <button
                    onClick={() => handleDelete(med.id)}
                    title="Excluir item"
                    className="text-slate-500 hover:text-rose-400 transition p-1"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
