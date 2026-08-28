import { Area, AreaChart, ResponsiveContainer } from 'recharts'

import { formatarPercentual } from '@/features/dashboard/charts/chartTheme'
import { formatCurrency } from '@/shared/utils/date'

type KpiCardProps = {
  titulo: string
  valor: number
  serie: number[]
  cor: string
  variacao?: number | null
  anoComparado?: number
  /** Em despesas, uma alta é ruim; em receitas, é boa. */
  inverterCorVariacao?: boolean
}

export function KpiCard({
  titulo,
  valor,
  serie,
  cor,
  variacao,
  anoComparado,
  inverterCorVariacao = false,
}: KpiCardProps) {
  const dadosSparkline = serie.map((v, i) => ({ mes: i, valor: v }))
  const gradienteId = `spark-${titulo.replace(/\s/g, '-').toLowerCase()}`

  const variacaoPositiva = (variacao ?? 0) > 0
  const ehBoa = inverterCorVariacao ? !variacaoPositiva : variacaoPositiva
  const corVariacao = variacao === null || variacao === undefined || variacao === 0
    ? 'text-[var(--color-muted)]'
    : ehBoa
      ? 'text-emerald-600'
      : 'text-rose-600'

  return (
    <article className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <h3 className="text-sm font-medium text-[var(--color-muted)]">{titulo}</h3>

      <p className="mt-1.5 text-2xl font-bold tabular-nums" style={{ color: cor }}>
        {formatCurrency(valor)}
      </p>

      <div className="mt-2 flex items-end justify-between gap-3">
        <div className="text-xs">
          {variacao !== null && variacao !== undefined ? (
            <>
              <span className={`font-semibold ${corVariacao}`}>
                {variacaoPositiva ? '▲' : variacao < 0 ? '▼' : '—'} {formatarPercentual(variacao)}
              </span>
              {anoComparado ? <span className="ml-1 text-[var(--color-muted)]">vs {anoComparado}</span> : null}
            </>
          ) : (
            <span className="text-[var(--color-muted)]">Sem comparação</span>
          )}
        </div>

        <div className="h-10 w-24 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dadosSparkline} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={gradienteId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={cor} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={cor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="valor"
                stroke={cor}
                strokeWidth={1.8}
                fill={`url(#${gradienteId})`}
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </article>
  )
}
