import type { MilhasResumoResponse } from '@/shared/types/milha'
import { obterMetaPrograma } from '../utils/programasConfig'
import { formatDateBr } from '@/shared/utils/date'
import { AlertTriangle, Clock, Calendar, ShieldCheck, ArrowRightLeft } from 'lucide-react'

type Props = {
  resumo: MilhasResumoResponse | null
  onTransferir: (programa: string) => void
}

export function ExpiracoesView({ resumo, onTransferir }: Props) {
  if (!resumo) return null

  const { proximos_30d, proximos_90d, proximos_180d, proximos_365d, todos } = resumo.expiracoes
  const totalGeralExpirando =
    proximos_30d.total + proximos_90d.total + proximos_180d.total + proximos_365d.total

  if (totalGeralExpirando === 0) {
    return (
      <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-12 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
          <ShieldCheck className="h-8 w-8" />
        </div>
        <h3 className="mt-4 text-base font-semibold text-[var(--color-text)]">
          Nenhuma milha prestes a expirar!
        </h3>
        <p className="mt-1 text-xs text-[var(--color-muted)] max-w-md mx-auto">
          Todos os seus pontos estão seguros ou em programas que não possuem expiração programada nos próximos 12 meses.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Resumo por Janela de Tempo */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* 30 dias */}
        <div
          className={`rounded-[var(--radius-md)] border p-4 shadow-sm transition ${
            proximos_30d.total > 0
              ? 'border-rose-300 bg-rose-50/50 dark:border-rose-900/60 dark:bg-rose-950/20'
              : 'border-[var(--color-border)] bg-[var(--color-surface)]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              Em até 30 dias
            </span>
            <AlertTriangle
              className={`h-4 w-4 ${
                proximos_30d.total > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-[var(--color-muted)]'
              }`}
            />
          </div>
          <p
            className={`mt-2 text-2xl font-bold ${
              proximos_30d.total > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-[var(--color-text)]'
            }`}
          >
            {proximos_30d.total.toLocaleString('pt-BR')} <span className="text-xs font-normal">pts</span>
          </p>
          <span className="mt-1 block text-xs text-[var(--color-muted)]">
            {proximos_30d.lotes.length} lote(s) crítico(s)
          </span>
        </div>

        {/* 90 dias */}
        <div
          className={`rounded-[var(--radius-md)] border p-4 shadow-sm transition ${
            proximos_90d.total > 0
              ? 'border-amber-300 bg-amber-50/50 dark:border-amber-900/60 dark:bg-amber-950/20'
              : 'border-[var(--color-border)] bg-[var(--color-surface)]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              31 a 90 dias
            </span>
            <Clock
              className={`h-4 w-4 ${
                proximos_90d.total > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-[var(--color-muted)]'
              }`}
            />
          </div>
          <p
            className={`mt-2 text-2xl font-bold ${
              proximos_90d.total > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-[var(--color-text)]'
            }`}
          >
            {proximos_90d.total.toLocaleString('pt-BR')} <span className="text-xs font-normal">pts</span>
          </p>
          <span className="mt-1 block text-xs text-[var(--color-muted)]">
            {proximos_90d.lotes.length} lote(s) em atenção
          </span>
        </div>

        {/* 180 dias */}
        <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              91 a 180 dias
            </span>
            <Calendar className="h-4 w-4 text-[var(--color-muted)]" />
          </div>
          <p className="mt-2 text-2xl font-bold text-[var(--color-text)]">
            {proximos_180d.total.toLocaleString('pt-BR')} <span className="text-xs font-normal">pts</span>
          </p>
          <span className="mt-1 block text-xs text-[var(--color-muted)]">
            {proximos_180d.lotes.length} lote(s)
          </span>
        </div>

        {/* 365 dias */}
        <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              181 a 365 dias
            </span>
            <Calendar className="h-4 w-4 text-[var(--color-muted)]" />
          </div>
          <p className="mt-2 text-2xl font-bold text-[var(--color-text)]">
            {proximos_365d.total.toLocaleString('pt-BR')} <span className="text-xs font-normal">pts</span>
          </p>
          <span className="mt-1 block text-xs text-[var(--color-muted)]">
            {proximos_365d.lotes.length} lote(s)
          </span>
        </div>
      </div>

      {/* Lista Detalhada de Lotes */}
      <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          Próximos Lotes a Expirar
        </h3>

        <div className="divide-y divide-[var(--color-border)]/60">
          {todos.map((lote) => {
            const meta = obterMetaPrograma(lote.programa)
            return (
              <div
                key={lote.id}
                className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-lg font-bold text-xs"
                    style={{
                      backgroundColor: meta.bgLight,
                      color: meta.textColor,
                    }}
                  >
                    {meta.sigla}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-[var(--color-text)]">
                        {lote.programa}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          lote.urgencia === 'critica'
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
                            : lote.urgencia === 'alerta'
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
                            : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        Expira em {lote.dias_restantes} dia(s)
                      </span>
                    </div>
                    <span className="text-[11px] text-[var(--color-muted)]">
                      Vencimento programado para {formatDateBr(lote.data_expiracao)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3">
                  <span className="font-bold text-sm text-[var(--color-text)]">
                    {lote.quantidade.toLocaleString('pt-BR')} pts
                  </span>
                  <button
                    type="button"
                    onClick={() => onTransferir(lote.programa)}
                    className="flex items-center gap-1 rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2.5 py-1 text-xs font-medium text-[var(--color-text)] hover:bg-[var(--color-primary)] hover:text-white"
                  >
                    <ArrowRightLeft className="h-3.5 w-3.5" />
                    Transferir
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
