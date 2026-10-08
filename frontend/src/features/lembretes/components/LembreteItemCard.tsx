import { useState } from 'react'
import type { Lembrete } from '@/shared/types/lembrete'
import {
  obterCategoriaConfig,
  formatarUrgenciaLembrete,
} from '../utils/lembretesConfig'
import { formatDateBr } from '@/shared/utils/date'
import {
  Check,
  Calendar,
  Clock,
  Edit2,
  Trash2,
  FastForward,
} from 'lucide-react'

type Props = {
  item: Lembrete
  onToggleStatus: (item: Lembrete) => Promise<void>
  onEditar: (item: Lembrete) => void
  onExcluir: (id: number) => void
  onAdiar?: (item: Lembrete, dias: number) => Promise<void>
}

export function LembreteItemCard({
  item,
  onToggleStatus,
  onEditar,
  onExcluir,
  onAdiar,
}: Props) {
  const [toggling, setToggling] = useState(false)

  const isConcluido = item.status === 'Concluído'
  const catConfig = obterCategoriaConfig(item.categoria)
  const CatIcon = catConfig.icon
  const urgenciaInfo = formatarUrgenciaLembrete(item.data_lembrete)

  const handleCheckboxClick = async () => {
    setToggling(true)
    try {
      await onToggleStatus(item)
    } finally {
      setToggling(false)
    }
  }

  const getPrioridadeBadge = () => {
    switch (item.prioridade) {
      case 'Alta':
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
            Alta
          </span>
        )
      case 'Média':
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            Média
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-muted)]">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
            Baixa
          </span>
        )
    }
  }

  return (
    <div
      className={`group relative flex flex-col justify-between gap-3 rounded-[var(--radius-md)] border bg-[var(--color-surface)] p-3.5 shadow-2xs transition hover:shadow-xs ${
        isConcluido
          ? 'border-[var(--color-border)]/60 bg-[var(--color-bg)]/30 opacity-75'
          : urgenciaInfo.urgencia === 'atrasado'
          ? 'border-rose-300/80 hover:border-rose-400 dark:border-rose-900/60'
          : urgenciaInfo.urgencia === 'hoje'
          ? 'border-amber-300/80 hover:border-amber-400 dark:border-amber-900/60'
          : 'border-[var(--color-border)] hover:border-[var(--color-border)]/90'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox Interativo Circular estilo Linear/Todoist */}
        <button
          type="button"
          disabled={toggling}
          onClick={handleCheckboxClick}
          aria-label={isConcluido ? 'Marcar como pendente' : 'Marcar como concluído'}
          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition duration-150 ${
            isConcluido
              ? 'border-emerald-500 bg-emerald-500 text-white'
              : 'border-[var(--color-border)] hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/20'
          } ${toggling ? 'opacity-50' : ''}`}
        >
          {isConcluido && <Check className="h-3 w-3 stroke-[3]" />}
        </button>

        {/* Informações Principais */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4
              className={`text-sm font-semibold leading-tight text-[var(--color-text)] transition ${
                isConcluido ? 'line-through text-[var(--color-muted)]' : ''
              }`}
            >
              {item.titulo}
            </h4>

            {/* Badges de Categoria & Prioridade */}
            <div className="flex items-center gap-1.5">
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                style={{
                  backgroundColor: catConfig.bgLight,
                  color: catConfig.textColor,
                  border: `1px solid ${catConfig.cor}30`,
                }}
              >
                <CatIcon className="h-3 w-3" />
                {item.categoria || 'Geral'}
              </span>

              {getPrioridadeBadge()}
            </div>
          </div>

          {/* Descrição */}
          {item.descricao && (
            <p
              className={`mt-1 line-clamp-2 text-xs text-[var(--color-muted)] ${
                isConcluido ? 'line-through' : ''
              }`}
            >
              {item.descricao}
            </p>
          )}

          {/* Data, Hora e Badge de Urgência */}
          <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs">
            {item.data_lembrete ? (
              <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-muted)]">
                <Calendar className="h-3.5 w-3.5 text-[var(--color-muted)]" />
                <span>{formatDateBr(item.data_lembrete)}</span>
                {item.hora_lembrete && (
                  <span className="flex items-center gap-0.5">
                    <Clock className="h-3 w-3" />
                    {item.hora_lembrete.slice(0, 5)}
                  </span>
                )}
              </div>
            ) : (
              <span className="text-[11px] text-[var(--color-muted)]">Sem data definida</span>
            )}

            {!isConcluido && (
              <span
                className={`rounded-full border px-2 py-0.5 text-[10px] ${urgenciaInfo.badgeClass}`}
              >
                {urgenciaInfo.texto}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Barra de Ações Rápidas (visível no hover ou menu mobile) */}
      <div className="flex items-center justify-end gap-1 border-t border-[var(--color-border)]/40 pt-2 opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition duration-150">
        {!isConcluido && onAdiar && (
          <>
            <button
              type="button"
              title="Adiar para amanhã (+1 dia)"
              onClick={() => onAdiar(item, 1)}
              className="flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-[var(--color-muted)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]"
            >
              <FastForward className="h-3 w-3" />
              +1 dia
            </button>
            <button
              type="button"
              title="Adiar para próxima semana (+7 dias)"
              onClick={() => onAdiar(item, 7)}
              className="flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-[var(--color-muted)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]"
            >
              +7 dias
            </button>
          </>
        )}

        <button
          type="button"
          title="Editar lembrete"
          onClick={() => onEditar(item)}
          className="rounded p-1 text-[var(--color-muted)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]"
        >
          <Edit2 className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          title="Excluir lembrete"
          onClick={() => onExcluir(item.id)}
          className="rounded p-1 text-[var(--color-muted)] hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
