import type { MilhasResumoResponse } from '@/shared/types/milha'
import { formatCurrency } from '@/shared/utils/date'
import { Award, AlertTriangle, TrendingUp, DollarSign } from 'lucide-react'

type Props = {
  resumo: MilhasResumoResponse | null
  loading?: boolean
}

export function MilhasKpis({ resumo, loading }: Props) {
  if (loading && !resumo) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-28 animate-pulse rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)]"
          />
        ))}
      </div>
    )
  }

  const saldoTotal = resumo?.saldo_total_milhas ?? 0
  const valorTotal = resumo?.valor_estimado_total ?? 0
  const exp30d = resumo?.expiracoes.proximos_30d.total ?? 0
  const exp90d = resumo?.expiracoes.proximos_90d.total ?? 0
  const totalEntradas = resumo?.total_entradas ?? 0
  const totalSaidas = resumo?.total_saidas ?? 0
  const totalExpirando = exp30d + exp90d

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* 1. Saldo Total */}
      <div className="relative overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-xs transition hover:shadow-md">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Saldo Total
          </span>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/15 text-amber-700 dark:bg-amber-400/20 dark:text-amber-300">
            <Award className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-2">
          <p className="text-2xl font-bold tracking-tight text-[var(--color-text)]">
            {saldoTotal.toLocaleString('pt-BR')} <span className="text-sm font-normal text-[var(--color-muted)]">pts</span>
          </p>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            Distribuídos em {resumo?.programas.length ?? 0} programas ativos
          </p>
        </div>
      </div>

      {/* 2. Valor Estimado em Reais */}
      <div className="relative overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-xs transition hover:shadow-md">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Valor Estimado
          </span>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-700 dark:bg-emerald-400/20 dark:text-emerald-300">
            <DollarSign className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-2">
          <p className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
            {formatCurrency(valorTotal)}
          </p>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            Baseado em cotações médias de mercado
          </p>
        </div>
      </div>

      {/* 3. Alertas de Expiração */}
      <div className="relative overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-xs transition hover:shadow-md">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Expirando em Breve
          </span>
          <div
            className={`flex h-9 w-9 items-center justify-center rounded-lg ${
              totalExpirando > 0
                ? 'bg-rose-500/15 text-rose-700 dark:bg-rose-400/20 dark:text-rose-300'
                : 'bg-[var(--color-bg)] text-[var(--color-muted)]'
            }`}
          >
            <AlertTriangle className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-2">
          <p
            className={`text-2xl font-bold tracking-tight ${
              totalExpirando > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-[var(--color-text)]'
            }`}
          >
            {totalExpirando.toLocaleString('pt-BR')} <span className="text-sm font-normal text-[var(--color-muted)]">pts</span>
          </p>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            {exp30d > 0
              ? `⚠️ ${exp30d.toLocaleString('pt-BR')} pts em até 30 dias!`
              : totalExpirando > 0
              ? `${exp90d.toLocaleString('pt-BR')} pts nos próximos 90 dias`
              : 'Nenhum ponto expirando nos próximos 90 dias'}
          </p>
        </div>
      </div>

      {/* 4. Volume de Movimentações */}
      <div className="relative overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-xs transition hover:shadow-md">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Acúmulo x Resgates
          </span>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/15 text-violet-700 dark:bg-violet-400/20 dark:text-violet-300">
            <TrendingUp className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-2">
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
              +{totalEntradas.toLocaleString('pt-BR')}
            </span>
            <span className="text-xs text-[var(--color-muted)]">/</span>
            <span className="text-sm font-semibold text-rose-600 dark:text-rose-400">
              -{totalSaidas.toLocaleString('pt-BR')}
            </span>
          </div>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            {resumo?.cpm_geral_medio
              ? `CPM médio: ${formatCurrency(resumo.cpm_geral_medio)} / milheiro`
              : 'Acúmulo total histórico'}
          </p>
        </div>
      </div>
    </div>
  )
}
