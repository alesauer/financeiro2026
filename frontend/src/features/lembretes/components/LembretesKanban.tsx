import type { Lembrete } from '@/shared/types/lembrete'
import { LembreteItemCard } from './LembreteItemCard'
import { AlertCircle, Clock, CheckCircle2 } from 'lucide-react'

type Props = {
  items: Lembrete[]
  onToggleStatus: (item: Lembrete) => Promise<void>
  onEditar: (item: Lembrete) => void
  onExcluir: (id: number) => void
  onAdiar?: (item: Lembrete, dias: number) => Promise<void>
}

export function LembretesKanban({
  items,
  onToggleStatus,
  onEditar,
  onExcluir,
  onAdiar,
}: Props) {
  const agora = new Date().toISOString().slice(0, 10)

  // Separar em 3 colunas ágeis
  const colunaUrgente = items.filter(
    (i) => i.status === 'Pendente' && ((i.data_lembrete && i.data_lembrete < agora) || i.prioridade === 'Alta')
  )

  const colunaPlanejado = items.filter(
    (i) =>
      i.status === 'Pendente' &&
      !((i.data_lembrete && i.data_lembrete < agora) || i.prioridade === 'Alta')
  )

  const colunaConcluido = items.filter((i) => i.status === 'Concluído')

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {/* Coluna 1: Urgente / Atrasado / Alta */}
      <div className="flex flex-col rounded-[var(--radius-md)] border border-rose-200 bg-rose-50/30 p-3 dark:border-rose-900/40 dark:bg-rose-950/10">
        <div className="mb-3 flex items-center justify-between border-b border-rose-200/60 pb-2 dark:border-rose-900/40">
          <div className="flex items-center gap-1.5 font-bold text-xs text-rose-700 dark:text-rose-400">
            <AlertCircle className="h-4 w-4" />
            Urgente / Alta Prioridade
          </div>
          <span className="rounded-full bg-rose-200/60 px-2 py-0.5 text-[10px] font-bold text-rose-800 dark:bg-rose-900/60 dark:text-rose-300">
            {colunaUrgente.length}
          </span>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto">
          {colunaUrgente.length === 0 ? (
            <div className="rounded border border-dashed border-rose-200 p-6 text-center text-xs text-[var(--color-muted)] dark:border-rose-900/40">
              Nenhuma tarefa urgente pendente 🎉
            </div>
          ) : (
            colunaUrgente.map((item) => (
              <LembreteItemCard
                key={item.id}
                item={item}
                onToggleStatus={onToggleStatus}
                onEditar={onEditar}
                onExcluir={onExcluir}
                onAdiar={onAdiar}
              />
            ))
          )}
        </div>
      </div>

      {/* Coluna 2: Em Andamento / Planejado */}
      <div className="flex flex-col rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)]/40 p-3">
        <div className="mb-3 flex items-center justify-between border-b border-[var(--color-border)]/60 pb-2">
          <div className="flex items-center gap-1.5 font-bold text-xs text-[var(--color-text)]">
            <Clock className="h-4 w-4 text-amber-500" />
            Planejados & Em Andamento
          </div>
          <span className="rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] px-2 py-0.5 text-[10px] font-bold text-[var(--color-text)] shadow-2xs">
            {colunaPlanejado.length}
          </span>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto">
          {colunaPlanejado.length === 0 ? (
            <div className="rounded border border-dashed border-[var(--color-border)] p-6 text-center text-xs text-[var(--color-muted)]">
              Nenhum lembrete planejado
            </div>
          ) : (
            colunaPlanejado.map((item) => (
              <LembreteItemCard
                key={item.id}
                item={item}
                onToggleStatus={onToggleStatus}
                onEditar={onEditar}
                onExcluir={onExcluir}
                onAdiar={onAdiar}
              />
            ))
          )}
        </div>
      </div>

      {/* Coluna 3: Concluídos */}
      <div className="flex flex-col rounded-[var(--radius-md)] border border-emerald-200 bg-emerald-50/30 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/10">
        <div className="mb-3 flex items-center justify-between border-b border-emerald-200/60 pb-2 dark:border-emerald-900/40">
          <div className="flex items-center gap-1.5 font-bold text-xs text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4" />
            Concluídos
          </div>
          <span className="rounded-full bg-emerald-200/60 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300">
            {colunaConcluido.length}
          </span>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto">
          {colunaConcluido.length === 0 ? (
            <div className="rounded border border-dashed border-emerald-200 p-6 text-center text-xs text-[var(--color-muted)] dark:border-emerald-900/40">
              Nenhum item concluído ainda
            </div>
          ) : (
            colunaConcluido.map((item) => (
              <LembreteItemCard
                key={item.id}
                item={item}
                onToggleStatus={onToggleStatus}
                onEditar={onEditar}
                onExcluir={onExcluir}
                onAdiar={onAdiar}
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}
