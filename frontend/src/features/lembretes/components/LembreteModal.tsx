import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import type {
  Lembrete,
  LembretePayload,
  LembretePrioridade,
  LembreteStatus,
} from '@/shared/types/lembrete'
import {
  CATEGORIAS_FINANCEIRAS,
  TEMPLATES_FINANCEIROS,
  type LembreteTemplate,
} from '../utils/lembretesConfig'
import { X, Bell, Sparkles } from 'lucide-react'

type Props = {
  isOpen: boolean
  editingItem: Lembrete | null
  initialTemplate?: LembreteTemplate | null
  onClose: () => void
  onSave: (payload: LembretePayload, id?: number) => Promise<void>
}

const PRIORIDADES: LembretePrioridade[] = ['Baixa', 'Média', 'Alta']
const STATUS: LembreteStatus[] = ['Pendente', 'Concluído']

export function LembreteModal({
  isOpen,
  editingItem,
  initialTemplate,
  onClose,
  onSave,
}: Props) {
  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [categoria, setCategoria] = useState('Cartões & Faturas')
  const [dataLembrete, setDataLembrete] = useState('')
  const [horaLembrete, setHoraLembrete] = useState('')
  const [prioridade, setPrioridade] = useState<LembretePrioridade>('Média')
  const [status, setStatus] = useState<LembreteStatus>('Pendente')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (editingItem) {
      setTitulo(editingItem.titulo)
      setDescricao(editingItem.descricao || '')
      setCategoria(editingItem.categoria || 'Cartões & Faturas')
      setDataLembrete(editingItem.data_lembrete || '')
      setHoraLembrete(editingItem.hora_lembrete ? editingItem.hora_lembrete.slice(0, 5) : '')
      setPrioridade(editingItem.prioridade)
      setStatus(editingItem.status)
    } else if (initialTemplate) {
      setTitulo(initialTemplate.titulo)
      setDescricao('')
      setCategoria(initialTemplate.categoria)
      setPrioridade(initialTemplate.prioridade)
      setStatus('Pendente')

      const d = new Date()
      if (initialTemplate.diasOffset) {
        d.setDate(d.getDate() + initialTemplate.diasOffset)
      }
      setDataLembrete(d.toISOString().slice(0, 10))
      setHoraLembrete('10:00')
    } else {
      setTitulo('')
      setDescricao('')
      setCategoria('Cartões & Faturas')
      setDataLembrete(new Date().toISOString().slice(0, 10))
      setHoraLembrete('09:00')
      setPrioridade('Média')
      setStatus('Pendente')
    }
    setErro(null)
  }, [editingItem, initialTemplate, isOpen])

  if (!isOpen) return null

  const handleApplyTemplate = (tpl: LembreteTemplate) => {
    setTitulo(tpl.titulo)
    setCategoria(tpl.categoria)
    setPrioridade(tpl.prioridade)
    const d = new Date()
    if (tpl.diasOffset) {
      d.setDate(d.getDate() + tpl.diasOffset)
    }
    setDataLembrete(d.toISOString().slice(0, 10))
  }

  const handleSetQuickDate = (dias: number) => {
    const d = new Date()
    d.setDate(d.getDate() + dias)
    setDataLembrete(d.toISOString().slice(0, 10))
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!titulo.trim()) {
      setErro('Informe o título do lembrete.')
      return
    }

    setSalvando(true)
    setErro(null)

    try {
      const payload: LembretePayload = {
        titulo: titulo.trim(),
        descricao: descricao.trim() || null,
        categoria: categoria || null,
        data_lembrete: dataLembrete || null,
        hora_lembrete: horaLembrete ? `${horaLembrete}:00` : null,
        prioridade,
        status,
      }

      await onSave(payload, editingItem?.id)
      onClose()
    } catch (err: any) {
      setErro(err?.message || 'Não foi possível salvar o lembrete.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
              <Bell className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[var(--color-text)]">
                {editingItem ? 'Editar Lembrete' : 'Novo Lembrete Financeiro'}
              </h3>
              <p className="text-xs text-[var(--color-muted)]">
                Organize compromissos, contas e prazos financeiros importantes.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-[var(--color-muted)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Templates Rápidos (Apenas ao criar) */}
        {!editingItem && (
          <div className="mt-3.5 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)]/50 p-2.5">
            <span className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-1.5">
              <Sparkles className="h-3 w-3 text-amber-500" />
              Preencher com modelo rápido:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {TEMPLATES_FINANCEIROS.slice(0, 4).map((tpl) => (
                <button
                  key={tpl.titulo}
                  type="button"
                  onClick={() => handleApplyTemplate(tpl)}
                  className="rounded bg-[var(--color-surface)] border border-[var(--color-border)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-text)] shadow-2xs hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition"
                >
                  {tpl.titulo}
                </button>
              ))}
            </div>
          </div>
        )}

        {erro && (
          <div className="mt-3 rounded bg-rose-50 p-2.5 text-xs font-medium text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
            {erro}
          </div>
        )}

        {/* Formulário Principal */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Título */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-1">
              Título do Lembrete *
            </label>
            <input
              type="text"
              required
              placeholder="Ex: Pagar Fatura Nubank / Declaração IRPF"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm font-medium text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-hidden"
            />
          </div>

          {/* Categoria & Prioridade */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-1">
                Categoria
              </label>
              <select
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-xs font-medium text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-hidden"
              >
                {Object.keys(CATEGORIAS_FINANCEIRAS).map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-1">
                Prioridade
              </label>
              <div className="flex rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] p-0.5 text-xs">
                {PRIORIDADES.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPrioridade(p)}
                    className={`flex-1 rounded py-1 font-semibold transition ${
                      prioridade === p
                        ? p === 'Alta'
                          ? 'bg-rose-500 text-white'
                          : p === 'Média'
                          ? 'bg-amber-500 text-white'
                          : 'bg-slate-500 text-white'
                        : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Data & Hora com Atalhos */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                Data & Horário
              </label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleSetQuickDate(0)}
                  className="rounded bg-[var(--color-bg)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-muted)] hover:text-[var(--color-text)]"
                >
                  Hoje
                </button>
                <button
                  type="button"
                  onClick={() => handleSetQuickDate(1)}
                  className="rounded bg-[var(--color-bg)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-muted)] hover:text-[var(--color-text)]"
                >
                  Amanhã
                </button>
                <button
                  type="button"
                  onClick={() => handleSetQuickDate(7)}
                  className="rounded bg-[var(--color-bg)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-muted)] hover:text-[var(--color-text)]"
                >
                  +7 dias
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="relative">
                <input
                  type="date"
                  value={dataLembrete}
                  onChange={(e) => setDataLembrete(e.target.value)}
                  className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-xs text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-hidden"
                />
              </div>

              <div className="relative">
                <input
                  type="time"
                  value={horaLembrete}
                  onChange={(e) => setHoraLembrete(e.target.value)}
                  className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-xs text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* Status (Apenas quando editando ou explicitamente alterando) */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-1">
              Status do Lembrete
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as LembreteStatus)}
              className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-xs font-medium text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-hidden"
            >
              {STATUS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Descrição / Anotações */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-1">
              Observações / Detalhes <span className="font-normal lowercase">(opcional)</span>
            </label>
            <textarea
              rows={3}
              placeholder="Ex: Código de barras, chave PIX, valor da fatura ou instruções..."
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              className="w-full resize-y rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-xs text-[var(--color-text)] placeholder:text-[var(--color-muted)] focus:border-[var(--color-primary)] focus:outline-hidden"
            />
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-2 border-t border-[var(--color-border)] pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-4 py-2 text-xs font-semibold text-[var(--color-muted)] hover:text-[var(--color-text)]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvando}
              className="rounded-[var(--radius-sm)] bg-[var(--color-primary)] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:opacity-90 disabled:opacity-50"
            >
              {salvando ? 'Salvando...' : editingItem ? 'Salvar Alterações' : 'Criar Lembrete'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
