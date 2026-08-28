import { useEffect, useMemo, useState } from 'react'

import { useAuth } from '@/app/providers/AuthProvider'
import { investimentosService } from '@/features/investimentos/services/investimentosService'
import type { MarketSnapshotItem, MarketSnapshotResponse } from '@/shared/types/investimento'
import { getErrorMessage } from '@/shared/utils/error'

function formatNumber(value: number | null) {
  if (value === null || Number.isNaN(value)) return '—'
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
}

function ChangeBadge({ value }: { value: number | null }) {
  if (value === null || Number.isNaN(value)) {
    return <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-500">—</span>
  }
  const positive = value >= 0
  return (
    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${positive ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
      {positive ? '+' : ''}{value.toFixed(2).replace('.', ',')}%
    </span>
  )
}

function MarketCard({ item }: { item: MarketSnapshotItem }) {
  return (
    <article className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-[var(--color-text)]">{item.name}</p>
          <p className="text-xs text-[var(--color-muted)]">{item.symbol}</p>
        </div>
        <ChangeBadge value={item.change_percent} />
      </div>
      <p className="mt-3 text-2xl font-semibold tabular-nums text-[var(--color-text)]">
        {item.price === null ? '—' : formatNumber(item.price)}
      </p>
      <p className="mt-1 text-xs text-[var(--color-muted)]">{item.currency}</p>
    </article>
  )
}

function TableRow({ item }: { item: MarketSnapshotItem }) {
  const positive = (item.change_percent ?? 0) >= 0
  return (
    <tr className="border-b border-[var(--color-border)]/50 hover:bg-gray-50">
      <td className="px-3 py-2">
        <p className="font-medium text-[var(--color-text)]">{item.name}</p>
        <p className="text-xs text-[var(--color-muted)]">{item.symbol}</p>
      </td>
      <td className="px-3 py-2 text-right tabular-nums">{item.price === null ? '—' : formatNumber(item.price)}</td>
      <td className={`px-3 py-2 text-right tabular-nums ${positive ? 'text-emerald-600' : 'text-rose-600'}`}>
        {item.change === null ? '—' : `${positive ? '+' : ''}${formatNumber(item.change)}`}
      </td>
      <td className="px-3 py-2 text-right"><ChangeBadge value={item.change_percent} /></td>
      <td className="px-3 py-2 text-right text-[var(--color-muted)]">{item.currency}</td>
    </tr>
  )
}

export function InvestimentosMercadoPage() {
  const { token } = useAuth()
  const [data, setData] = useState<MarketSnapshotResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const carregar = async (silent = false) => {
    if (!token) return
    if (!silent) setLoading(true)
    setError(null)
    try {
      const res = await investimentosService.marketSnapshot(token)
      setData(res)
    } catch (err) {
      setError(getErrorMessage(err, 'Não foi possível carregar painel de mercado.'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    carregar()
  }, [token])

  const atualizacaoLabel = useMemo(() => {
    if (!data?.updated_at) return 'Sem horário de atualização'
    const dt = new Date(data.updated_at)
    if (Number.isNaN(dt.getTime())) return 'Sem horário de atualização'
    return `Atualizado às ${dt.toLocaleTimeString('pt-BR')}`
  }, [data?.updated_at])

  return (
    <section className="space-y-6">
      <header className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold text-[var(--color-text)]">Mercado</h2>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              Monitor em tempo real da situação das bolsas e ativos globais (fonte gratuita).
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--color-muted)]">{atualizacaoLabel}</span>
            <button
              type="button"
              onClick={() => {
                setRefreshing(true)
                carregar(true)
              }}
              disabled={refreshing || loading}
              className="rounded-md bg-[var(--color-primary)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
            >
              {refreshing ? 'Atualizando...' : 'Atualizar'}
            </button>
          </div>
        </div>
      </header>

      {error ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      ) : null}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">Principais índices</h3>
          <span className="text-xs text-[var(--color-muted)]">Fonte: {data?.source ?? 'yahoo'}</span>
        </div>
        {loading ? (
          <p className="text-sm text-[var(--color-muted)]">Carregando índices...</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {(data?.indices ?? []).map((item) => (
              <MarketCard key={item.symbol} item={item} />
            ))}
          </div>
        )}
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <article className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">Top movers</h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-left text-xs uppercase text-[var(--color-muted)]">
                  <th className="px-3 py-2">Ativo</th>
                  <th className="px-3 py-2 text-right">Preço</th>
                  <th className="px-3 py-2 text-right">Variação</th>
                  <th className="px-3 py-2 text-right">%</th>
                  <th className="px-3 py-2 text-right">Moeda</th>
                </tr>
              </thead>
              <tbody>
                {(data?.movers ?? []).map((item) => (
                  <TableRow key={item.symbol} item={item} />
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">Câmbio & commodities</h3>
          <div className="space-y-2">
            {(data?.fx ?? []).map((item) => {
              const positive = (item.change_percent ?? 0) >= 0
              return (
                <div key={item.symbol} className="flex items-center justify-between rounded-md border border-[var(--color-border)] px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-[var(--color-text)]">{item.name}</p>
                    <p className="text-xs text-[var(--color-muted)]">{item.symbol}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold tabular-nums text-[var(--color-text)]">{item.price === null ? '—' : formatNumber(item.price)}</p>
                    <p className={`text-xs tabular-nums ${positive ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {item.change_percent === null ? '—' : `${positive ? '+' : ''}${item.change_percent.toFixed(2).replace('.', ',')}%`}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="mt-4 rounded-md bg-slate-50 p-3 text-xs text-[var(--color-muted)]">
            Dados gratuitos com possível atraso de mercado. Use para contexto e monitoramento rápido, não como recomendação de investimento.
          </div>
        </article>
      </section>
    </section>
  )
}
