import type { ReactNode } from 'react'

import { formatCurrency } from '@/shared/utils/date'

type ChartCardProps = {
  titulo: string
  descricao?: string
  acao?: ReactNode
  children: ReactNode
  vazio?: boolean
  className?: string
}

export function ChartCard({ titulo, descricao, acao, children, vazio = false, className = '' }: ChartCardProps) {
  return (
    <article
      className={`flex flex-col rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 ${className}`}
    >
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[var(--color-text)]">{titulo}</h3>
          {descricao ? <p className="mt-0.5 text-xs text-[var(--color-muted)]">{descricao}</p> : null}
        </div>
        {acao}
      </header>

      {vazio ? (
        <div className="flex flex-1 items-center justify-center py-10 text-sm text-[var(--color-muted)]">
          Sem dados para exibir.
        </div>
      ) : (
        <div className="flex-1">{children}</div>
      )}
    </article>
  )
}

type TooltipItem = {
  name?: string | number
  value?: number | string
  color?: string
  dataKey?: string | number
}

type TooltipProps = {
  active?: boolean
  payload?: TooltipItem[]
  label?: string | number
  /** Exibe o total somado das séries no rodapé */
  mostrarTotal?: boolean
}

/** Tooltip padrão: título, séries com marcador colorido e valor em BRL. */
export function ChartTooltip({ active, payload, label, mostrarTotal = false }: TooltipProps) {
  if (!active || !payload?.length) return null

  const itens = payload.filter((item) => item.value !== undefined && item.value !== null)
  if (itens.length === 0) return null

  const total = itens.reduce((acc, item) => acc + Number(item.value ?? 0), 0)

  return (
    <div className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2 shadow-lg">
      {label !== undefined ? <p className="mb-1.5 text-xs font-semibold text-[var(--color-text)]">{label}</p> : null}

      <ul className="space-y-1">
        {itens.map((item, indice) => (
          <li key={`${item.dataKey}-${indice}`} className="flex items-center gap-2 text-xs">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="text-[var(--color-muted)]">{item.name}</span>
            <span className="ml-auto font-semibold tabular-nums text-[var(--color-text)]">
              {formatCurrency(Number(item.value))}
            </span>
          </li>
        ))}
      </ul>

      {mostrarTotal && itens.length > 1 ? (
        <p className="mt-1.5 border-t border-[var(--color-border)] pt-1.5 text-right text-xs font-bold tabular-nums text-[var(--color-text)]">
          {formatCurrency(total)}
        </p>
      ) : null}
    </div>
  )
}
