import { useState } from 'react'
import type { FormEvent } from 'react'
import type { LembretePayload, LembretePrioridade } from '@/shared/types/lembrete'
import { CATEGORIAS_FINANCEIRAS } from '../utils/lembretesConfig'
import { Plus, Calendar, Flag, Tag } from 'lucide-react'

type Props = {
  onCriar: (payload: LembretePayload) => Promise<void>
}

export function LembreteQuickAdd({ onCriar }: Props) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [titulo, setTitulo] = useState('')
  const [categoria, setCategoria] = useState('Cartões & Faturas')
  const [prioridade, setPrioridade] = useState<LembretePrioridade>('Média')
  const [dataLembrete, setDataLembrete] = useState<string>('')
  const [salvando, setSalvando] = useState(false)

  const handleSetQuickDate = (dias: number) => {
    const d = new Date()
    d.setDate(d.getDate() + dias)
    setDataLembrete(d.toISOString().slice(0, 10))
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!titulo.trim()) return

    setSalvando(true)
    try {
      const payload: LembretePayload = {
        titulo: titulo.trim(),
        descricao: null,
        categoria: categoria || null,
        data_lembrete: dataLembrete || null,
        hora_lembrete: null,
        status: 'Pendente',
        prioridade,
      }
      await onCriar(payload)
      setTitulo('')
      setDataLembrete('')
      setIsExpanded(false)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-xs transition focus-within:border-[var(--color-primary)]">
      <form onSubmit={handleSubmit} className="space-y-2.5">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
            <Plus className="h-4 w-4" />
          </div>
          <input
            type="text"
            placeholder="Adicionar lembrete rápido... (ex: Pagar boleto internet dia 10)"
            value={titulo}
            onFocus={() => setIsExpanded(true)}
            onChange={(e) => setTitulo(e.target.value)}
            className="w-full bg-transparent text-xs sm:text-sm font-medium text-[var(--color-text)] placeholder:text-[var(--color-muted)] focus:outline-hidden"
          />
          <button
            type="submit"
            disabled={!titulo.trim() || salvando}
            className="shrink-0 rounded-[var(--radius-sm)] bg-[var(--color-primary)] px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:opacity-90 disabled:opacity-40"
          >
            {salvando ? 'Salvando...' : 'Adicionar'}
          </button>
        </div>

        {/* Toolbar de Opções Rápidas quando focado / expandido */}
        {isExpanded && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--color-border)]/60 pt-2.5 text-xs animate-in fade-in duration-150">
            {/* Datas Rápidas */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="flex items-center gap-1 text-[11px] font-semibold text-[var(--color-muted)]">
                <Calendar className="h-3 w-3" /> Data:
              </span>
              <button
                type="button"
                onClick={() => handleSetQuickDate(0)}
                className={`rounded px-2 py-0.5 text-[11px] font-medium transition ${
                  dataLembrete === new Date().toISOString().slice(0, 10)
                    ? 'bg-amber-500 text-white font-bold'
                    : 'bg-[var(--color-bg)] text-[var(--color-muted)] hover:text-[var(--color-text)]'
                }`}
              >
                Hoje
              </button>
              <button
                type="button"
                onClick={() => handleSetQuickDate(1)}
                className="rounded bg-[var(--color-bg)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-muted)] hover:text-[var(--color-text)]"
              >
                Amanhã
              </button>
              <button
                type="button"
                onClick={() => handleSetQuickDate(7)}
                className="rounded bg-[var(--color-bg)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-muted)] hover:text-[var(--color-text)]"
              >
                +7 dias
              </button>
              <input
                type="date"
                value={dataLembrete}
                onChange={(e) => setDataLembrete(e.target.value)}
                className="rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-1.5 py-0.5 text-[11px] text-[var(--color-text)]"
              />
            </div>

            {/* Categoria & Prioridade */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1">
                <Tag className="h-3 w-3 text-[var(--color-muted)]" />
                <select
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value)}
                  className="rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-text)] focus:outline-hidden"
                >
                  {Object.keys(CATEGORIAS_FINANCEIRAS).map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1">
                <Flag className="h-3 w-3 text-[var(--color-muted)]" />
                <select
                  value={prioridade}
                  onChange={(e) => setPrioridade(e.target.value as LembretePrioridade)}
                  className="rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-text)] focus:outline-hidden"
                >
                  <option value="Alta">Alta</option>
                  <option value="Média">Média</option>
                  <option value="Baixa">Baixa</option>
                </select>
              </div>

              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                className="text-[11px] text-[var(--color-muted)] hover:text-[var(--color-text)] ml-1"
              >
                Fechar
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  )
}
