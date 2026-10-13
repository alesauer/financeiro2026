import { TrendingUp, TrendingDown, DollarSign, ShieldCheck, PieChart, Landmark } from 'lucide-react'
import type { InvestmentDashboard } from '@/shared/types/investimento'
import { formatCurrency } from '@/shared/utils/date'

interface InvestimentosKpiCardsProps {
  dash: InvestmentDashboard | null
  loading?: boolean
}

export function InvestimentosKpiCards({ dash, loading }: InvestimentosKpiCardsProps) {
  const patrimonioTotal = dash?.patrimonio_total ?? 0
  const valorInvestido = dash?.valor_investido ?? 0
  const lucroPrejuizo = dash?.lucro_prejuizo ?? 0
  const rentabilidadePercentual = dash?.rentabilidade_percentual ?? 0

  const patRendaFixa = dash?.patrimonio_renda_fixa ?? 0
  const invRendaFixa = dash?.investido_renda_fixa ?? 0
  const patRendaVariavel = dash?.patrimonio_renda_variavel ?? 0
  const invRendaVariavel = dash?.investido_renda_variavel ?? 0
  const lucroRendaVariavel = dash?.lucro_renda_variavel ?? 0
  const rentRendaVariavel = dash?.rentabilidade_renda_variavel ?? 0

  const proventosMes = dash?.dividendos_mes ?? 0
  const aporteMes = dash?.aporte_mes ?? 0

  const pesoRf = patrimonioTotal > 0 ? (patRendaFixa / patrimonioTotal) * 100 : 0
  const pesoRv = patrimonioTotal > 0 ? (patRendaVariavel / patrimonioTotal) * 100 : 0

  const isPositivo = lucroPrejuizo >= 0

  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-32 animate-pulse rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4" />
        ))}
      </div>
    )
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {/* 1. Hero Card: Patrimônio Total */}
      <div className="relative overflow-hidden rounded-xl border border-[var(--color-border)] bg-gradient-to-br from-[var(--color-surface)] to-[var(--color-bg)] p-4.5 shadow-xs transition-all hover:shadow-md">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Patrimônio Consolidado
          </span>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
            <DollarSign className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-2.5">
          <div className="text-2xl font-bold tracking-tight text-[var(--color-text)] tabular-nums">
            {formatCurrency(patrimonioTotal)}
          </div>
          <div className="mt-2 flex items-center justify-between gap-2 border-t border-[var(--color-border)]/50 pt-2 text-xs">
            <span className="text-[var(--color-muted)]">
              Investido: <strong className="text-[var(--color-text)] font-medium">{formatCurrency(valorInvestido)}</strong>
            </span>
            <div
              className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 font-medium tabular-nums ${
                isPositivo
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
              }`}
            >
              {isPositivo ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              <span>
                {isPositivo ? '+' : ''}
                {rentabilidadePercentual.toFixed(2).replace('.', ',')}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Renda Fixa */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4.5 shadow-xs transition-all hover:shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              Renda Fixa
            </span>
            <span className="rounded bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-sky-600 dark:text-sky-400">
              {pesoRf.toFixed(1).replace('.', ',')}%
            </span>
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400">
            <ShieldCheck className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-2.5">
          <div className="text-xl font-bold tracking-tight text-[var(--color-text)] tabular-nums">
            {formatCurrency(patRendaFixa)}
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-[var(--color-border)]/50 pt-2 text-xs text-[var(--color-muted)]">
            <span>Custo: {formatCurrency(invRendaFixa)}</span>
            <span className="text-[11px] font-medium text-sky-600 dark:text-sky-400">CDB • Tesouro • LCI</span>
          </div>
        </div>
      </div>

      {/* 3. Renda Variável */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4.5 shadow-xs transition-all hover:shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              Renda Variável
            </span>
            <span className="rounded bg-purple-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-purple-600 dark:text-purple-400">
              {pesoRv.toFixed(1).replace('.', ',')}%
            </span>
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
            <PieChart className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-2.5">
          <div className="text-xl font-bold tracking-tight text-[var(--color-text)] tabular-nums">
            {formatCurrency(patRendaVariavel)}
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-[var(--color-border)]/50 pt-2 text-xs text-[var(--color-muted)]">
            <span>Investido: {formatCurrency(invRendaVariavel)}</span>
            <span
              className={`font-semibold tabular-nums ${
                lucroRendaVariavel >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {lucroRendaVariavel >= 0 ? '+' : ''}
              {rentRendaVariavel.toFixed(1).replace('.', ',')}%
            </span>
          </div>
        </div>
      </div>

      {/* 4. Proventos & Movimentações do Mês */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4.5 shadow-xs transition-all hover:shadow-md">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Fluxo no Mês
          </span>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <Landmark className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-2.5">
          <div className="flex items-baseline justify-between">
            <div className="text-xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 tabular-nums">
              {formatCurrency(proventosMes)}
            </div>
            <span className="text-[11px] font-medium text-[var(--color-muted)]">Dividendos / JCP</span>
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-[var(--color-border)]/50 pt-2 text-xs text-[var(--color-muted)]">
            <span>Aportes recentes:</span>
            <span className="font-semibold text-[var(--color-text)] tabular-nums">
              {formatCurrency(aporteMes)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
