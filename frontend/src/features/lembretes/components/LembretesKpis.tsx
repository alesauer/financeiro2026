import type { LembreteDashboard } from '@/shared/types/lembrete'
import { AlertCircle, Clock, CalendarDays, CheckCircle2 } from 'lucide-react'

type Props = {
  dashboard: LembreteDashboard | null
  qtdAtrasados?: number
  loading?: boolean
}

export function LembretesKpis({ dashboard, qtdAtrasados = 0, loading }: Props) {
  if (loading && !dashboard) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)]"
          />
        ))}
      </div>
    )
  }

  const total = dashboard?.total ?? 0
  const pendentes = dashboard?.pendentes ?? 0
  const concluidos = dashboard?.concluidos ?? 0
  const hoje = dashboard?.hoje ?? 0
  const taxaConclusao = total > 0 ? Math.round((concluidos / total) * 100) : 0

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* 1. Atrasados */}
      <div
        className={`relative overflow-hidden rounded-[var(--radius-md)] border p-4 shadow-xs transition hover:shadow-md ${
          qtdAtrasados > 0
            ? 'border-rose-300 bg-rose-50/50 dark:border-rose-900/60 dark:bg-rose-950/20'
            : 'border-[var(--color-border)] bg-[var(--color-surface)]'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Atrasados
          </span>
          <div
            className={`flex h-9 w-9 items-center justify-center rounded-lg ${
              qtdAtrasados > 0
                ? 'bg-rose-500/15 text-rose-700 dark:bg-rose-400/20 dark:text-rose-300'
                : 'bg-[var(--color-bg)] text-[var(--color-muted)]'
            }`}
          >
            <AlertCircle className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-2">
          <p
            className={`text-2xl font-bold tracking-tight ${
              qtdAtrasados > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-[var(--color-text)]'
            }`}
          >
            {qtdAtrasados}
          </p>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            {qtdAtrasados > 0
              ? 'Exigem atenção imediata'
              : 'Nenhum compromisso atrasado'}
          </p>
        </div>
      </div>

      {/* 2. Para Hoje */}
      <div
        className={`relative overflow-hidden rounded-[var(--radius-md)] border p-4 shadow-xs transition hover:shadow-md ${
          hoje > 0
            ? 'border-amber-300 bg-amber-50/50 dark:border-amber-900/60 dark:bg-amber-950/20'
            : 'border-[var(--color-border)] bg-[var(--color-surface)]'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Vencendo Hoje
          </span>
          <div
            className={`flex h-9 w-9 items-center justify-center rounded-lg ${
              hoje > 0
                ? 'bg-amber-500/15 text-amber-700 dark:bg-amber-400/20 dark:text-amber-300'
                : 'bg-[var(--color-bg)] text-[var(--color-muted)]'
            }`}
          >
            <Clock className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-2">
          <p
            className={`text-2xl font-bold tracking-tight ${
              hoje > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-[var(--color-text)]'
            }`}
          >
            {hoje}
          </p>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            {hoje > 0 ? 'Programados para hoje' : 'Nada para hoje'}
          </p>
        </div>
      </div>

      {/* 3. Total Pendentes */}
      <div className="relative overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-xs transition hover:shadow-md">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Total Pendentes
          </span>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-500/15 text-sky-700 dark:bg-sky-400/20 dark:text-sky-300">
            <CalendarDays className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-2">
          <p className="text-2xl font-bold tracking-tight text-[var(--color-text)]">
            {pendentes}
          </p>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            {total} compromissos registrados no total
          </p>
        </div>
      </div>

      {/* 4. Concluídos & Taxa */}
      <div className="relative overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-xs transition hover:shadow-md">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Taxa de Conclusão
          </span>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-700 dark:bg-emerald-400/20 dark:text-emerald-300">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-2">
          <div className="flex items-baseline justify-between">
            <p className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
              {taxaConclusao}%
            </p>
            <span className="text-xs font-semibold text-[var(--color-muted)]">
              {concluidos} / {total}
            </span>
          </div>

          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-bg)]">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${Math.min(100, taxaConclusao)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
