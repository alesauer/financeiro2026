import { useState } from 'react'
import type { Lembrete } from '@/shared/types/lembrete'
import {
  agruparLembretes,
  TEMPLATES_FINANCEIROS,
} from '../utils/lembretesConfig'
import { LembreteItemCard } from './LembreteItemCard'
import {
  AlertCircle,
  Clock,
  Calendar,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Plus,
} from 'lucide-react'

type Props = {
  items: Lembrete[]
  loading?: boolean
  onToggleStatus: (item: Lembrete) => Promise<void>
  onEditar: (item: Lembrete) => void
  onExcluir: (id: number) => void
  onAdiar?: (item: Lembrete, dias: number) => Promise<void>
  onUsarTemplate?: (template: (typeof TEMPLATES_FINANCEIROS)[0]) => void
}

export function LembretesListGrouped({
  items,
  loading,
  onToggleStatus,
  onEditar,
  onExcluir,
  onAdiar,
  onUsarTemplate,
}: Props) {
  const [concluidosOpen, setConcluidosOpen] = useState(false)

  if (loading && items.length === 0) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)]"
          />
        ))}
      </div>
    )
  }

  const grupos = agruparLembretes(items)

  if (items.length === 0) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center shadow-xs">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
          <CheckCircle2 className="h-7 w-7" />
        </div>

        <h3 className="mt-4 text-base font-bold text-[var(--color-text)]">
          Tudo em dia! Nenhum lembrete pendente
        </h3>
        <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-[var(--color-muted)]">
          Você não possui compromissos financeiros atrasados ou tarefas pendentes no momento.
        </p>

        {/* Sugestões de Templates Rápidos */}
        {onUsarTemplate && (
          <div className="mt-8 border-t border-[var(--color-border)] pt-6">
            <p className="flex items-center justify-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              Ou crie um lembrete com 1 clique usando um modelo comum:
            </p>

            <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {TEMPLATES_FINANCEIROS.map((tpl) => (
                <button
                  key={tpl.titulo}
                  type="button"
                  onClick={() => onUsarTemplate(tpl)}
                  className="group flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)]/60 p-3 text-left transition hover:border-[var(--color-primary)] hover:bg-[var(--color-surface)] hover:shadow-xs"
                >
                  <div>
                    <span className="block text-xs font-semibold text-[var(--color-text)] group-hover:text-[var(--color-primary)]">
                      {tpl.titulo}
                    </span>
                    <span className="mt-0.5 block text-[10px] text-[var(--color-muted)]">
                      {tpl.categoria} · {tpl.prioridade}
                    </span>
                  </div>
                  <Plus className="h-4 w-4 text-[var(--color-muted)] group-hover:text-[var(--color-primary)] shrink-0 ml-2" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 1. ATRASADOS */}
      {grupos.atrasados.length > 0 && (
        <section className="space-y-2.5">
          <div className="flex items-center gap-2">
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400">
              <AlertCircle className="h-3.5 w-3.5" />
            </div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">
              Atrasados ({grupos.atrasados.length})
            </h3>
          </div>
          <div className="space-y-2">
            {grupos.atrasados.map((item) => (
              <LembreteItemCard
                key={item.id}
                item={item}
                onToggleStatus={onToggleStatus}
                onEditar={onEditar}
                onExcluir={onExcluir}
                onAdiar={onAdiar}
              />
            ))}
          </div>
        </section>
      )}

      {/* 2. HOJE */}
      {grupos.hoje.length > 0 && (
        <section className="space-y-2.5">
          <div className="flex items-center gap-2">
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400">
              <Clock className="h-3.5 w-3.5" />
            </div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
              Hoje ({grupos.hoje.length})
            </h3>
          </div>
          <div className="space-y-2">
            {grupos.hoje.map((item) => (
              <LembreteItemCard
                key={item.id}
                item={item}
                onToggleStatus={onToggleStatus}
                onEditar={onEditar}
                onExcluir={onExcluir}
                onAdiar={onAdiar}
              />
            ))}
          </div>
        </section>
      )}

      {/* 3. AMANHÃ */}
      {grupos.amanha.length > 0 && (
        <section className="space-y-2.5">
          <div className="flex items-center gap-2">
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
              <Calendar className="h-3.5 w-3.5" />
            </div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Amanhã ({grupos.amanha.length})
            </h3>
          </div>
          <div className="space-y-2">
            {grupos.amanha.map((item) => (
              <LembreteItemCard
                key={item.id}
                item={item}
                onToggleStatus={onToggleStatus}
                onEditar={onEditar}
                onExcluir={onExcluir}
                onAdiar={onAdiar}
              />
            ))}
          </div>
        </section>
      )}

      {/* 4. PRÓXIMOS 7 DIAS */}
      {grupos.proximos7d.length > 0 && (
        <section className="space-y-2.5">
          <div className="flex items-center gap-2">
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-400">
              <CalendarDays className="h-3.5 w-3.5" />
            </div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text)]">
              Próximos 7 Dias ({grupos.proximos7d.length})
            </h3>
          </div>
          <div className="space-y-2">
            {grupos.proximos7d.map((item) => (
              <LembreteItemCard
                key={item.id}
                item={item}
                onToggleStatus={onToggleStatus}
                onEditar={onEditar}
                onExcluir={onExcluir}
                onAdiar={onAdiar}
              />
            ))}
          </div>
        </section>
      )}

      {/* 5. MAIS ADIANTE */}
      {grupos.maisAdiante.length > 0 && (
        <section className="space-y-2.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-muted)]">
            Mais Adiante ({grupos.maisAdiante.length})
          </h3>
          <div className="space-y-2">
            {grupos.maisAdiante.map((item) => (
              <LembreteItemCard
                key={item.id}
                item={item}
                onToggleStatus={onToggleStatus}
                onEditar={onEditar}
                onExcluir={onExcluir}
                onAdiar={onAdiar}
              />
            ))}
          </div>
        </section>
      )}

      {/* 6. SEM DATA */}
      {grupos.semData.length > 0 && (
        <section className="space-y-2.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-muted)]">
            Sem Data Definida ({grupos.semData.length})
          </h3>
          <div className="space-y-2">
            {grupos.semData.map((item) => (
              <LembreteItemCard
                key={item.id}
                item={item}
                onToggleStatus={onToggleStatus}
                onEditar={onEditar}
                onExcluir={onExcluir}
                onAdiar={onAdiar}
              />
            ))}
          </div>
        </section>
      )}

      {/* 7. CONCLUÍDOS RECENTES (Colapsável) */}
      {grupos.concluidos.length > 0 && (
        <section className="border-t border-[var(--color-border)] pt-4">
          <button
            type="button"
            onClick={() => setConcluidosOpen((prev) => !prev)}
            className="flex items-center gap-2 text-xs font-semibold text-[var(--color-muted)] hover:text-[var(--color-text)] transition"
          >
            {concluidosOpen ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            <span>Concluídos ({grupos.concluidos.length})</span>
          </button>

          {concluidosOpen && (
            <div className="mt-3 space-y-2 animate-in fade-in duration-150">
              {grupos.concluidos.map((item) => (
                <LembreteItemCard
                  key={item.id}
                  item={item}
                  onToggleStatus={onToggleStatus}
                  onEditar={onEditar}
                  onExcluir={onExcluir}
                />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
