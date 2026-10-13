import { useMemo } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import {
  TrendingUp,
  TrendingDown,
  PieChart as PieIcon,
  ShieldCheck,
  Layers,
  ArrowRight,
  Sparkles,
} from 'lucide-react'
import type { InvestmentDashboard, InvestmentDashboardAsset } from '@/shared/types/investimento'
import { formatCurrency } from '@/shared/utils/date'

interface VisaoGeralTabProps {
  dash: InvestmentDashboard | null
  onNavigateTab: (tab: 'renda-variavel' | 'renda-fixa' | 'operacoes') => void
  onOpenNovaOperacao: (asset?: InvestmentDashboardAsset) => void
}

const PALETTE = [
  '#3b82f6', // Azul (Ações)
  '#8b5cf6', // Roxo (FIIs)
  '#10b981', // Esmeralda (Tesouro)
  '#0ea5e9', // Sky (CDB)
  '#06b6d4', // Ciano (LCI/LCA)
  '#f59e0b', // Âmbar (Cripto)
  '#6366f1', // Índigo (ETFs)
  '#ec4899', // Rosa (BDRs)
  '#14b8a6', // Teal (Debêntures)
  '#64748b', // Slate (Outros)
]

export function VisaoGeralTab({ dash, onNavigateTab, onOpenNovaOperacao }: VisaoGeralTabProps) {
  const patrimonioTotal = dash?.patrimonio_total ?? 0
  const patRf = dash?.patrimonio_renda_fixa ?? 0
  const patRv = dash?.patrimonio_renda_variavel ?? 0
  const pesoRf = patrimonioTotal > 0 ? (patRf / patrimonioTotal) * 100 : 0
  const pesoRv = patrimonioTotal > 0 ? (patRv / patrimonioTotal) * 100 : 0

  const alocacaoData = useMemo(() => {
    if (!dash?.alocacao_por_tipo || dash.alocacao_por_tipo.length === 0) return []
    return dash.alocacao_por_tipo.map((item, idx) => ({
      name: item.tipo,
      value: item.valor,
      percentual: item.percentual,
      color: PALETTE[idx % PALETTE.length],
    }))
  }, [dash])

  // Top 5 ativos por patrimônio
  const topAtivos = useMemo(() => {
    if (!dash?.ativos || dash.ativos.length === 0) return []
    return [...dash.ativos]
      .sort((a, b) => (b.valor_atual || 0) - (a.valor_atual || 0))
      .slice(0, 5)
  }, [dash])

  if (!dash || dash.ativos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)]/50 p-12 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
          <Sparkles className="h-8 w-8" />
        </div>
        <h3 className="mt-4 text-base font-semibold text-[var(--color-text)]">
          Sua carteira está pronta para os primeiros ativos
        </h3>
        <p className="mt-1.5 max-w-md text-sm text-[var(--color-muted)]">
          Cadastre seus ativos de Renda Fixa ou Renda Variável e registre suas primeiras movimentações para visualizar os gráficos de alocação e desempenho.
        </p>
        <button
          type="button"
          onClick={() => onOpenNovaOperacao()}
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white shadow-xs transition hover:opacity-90"
        >
          <Sparkles className="h-4 w-4" />
          Registrar Primeira Operação
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Barra de Distribuição Macro: Renda Fixa vs Renda Variável */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-[var(--color-text)]">Distribuição Macro do Portfólio</h3>
            <p className="text-xs text-[var(--color-muted)]">
              Equilíbrio estratégico entre Segurança/Liquidez e Crescimento/Proventos
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs font-medium">
            <button
              type="button"
              onClick={() => onNavigateTab('renda-fixa')}
              className="flex items-center gap-1.5 text-sky-600 hover:underline dark:text-sky-400"
            >
              <span className="h-2.5 w-2.5 rounded-full bg-sky-500" />
              <span>Renda Fixa: <strong>{pesoRf.toFixed(1).replace('.', ',')}%</strong> ({formatCurrency(patRf)})</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab('renda-variavel')}
              className="flex items-center gap-1.5 text-purple-600 hover:underline dark:text-purple-400"
            >
              <span className="h-2.5 w-2.5 rounded-full bg-purple-500" />
              <span>Renda Variável: <strong>{pesoRv.toFixed(1).replace('.', ',')}%</strong> ({formatCurrency(patRv)})</span>
            </button>
          </div>
        </div>

        {/* Visual Progress Bar */}
        <div className="mt-4 flex h-3.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
          <div
            className="bg-sky-500 transition-all duration-500"
            style={{ width: `${Math.max(0, Math.min(pesoRf, 100))}%` }}
            title={`Renda Fixa: ${pesoRf.toFixed(1)}%`}
          />
          <div
            className="bg-purple-500 transition-all duration-500"
            style={{ width: `${Math.max(0, Math.min(pesoRv, 100))}%` }}
            title={`Renda Variável: ${pesoRv.toFixed(1)}%`}
          />
        </div>

        <div className="mt-3 flex justify-between text-[11px] text-[var(--color-muted)]">
          <span className="flex items-center gap-1">
            <ShieldCheck className="h-3 w-3 text-sky-500" /> Proteção, Reserva e Prazos
          </span>
          <span className="flex items-center gap-1">
            Geração de Renda & Valorização <PieIcon className="h-3 w-3 text-purple-500" />
          </span>
        </div>
      </div>

      {/* Grid Principal: Donut Chart e Top Posições */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Gráfico Donut de Alocação por Tipo */}
        <div className="flex flex-col rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-xs lg:col-span-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                <Layers className="h-4 w-4" />
              </div>
              <h3 className="text-sm font-bold text-[var(--color-text)]">Alocação por Categoria</h3>
            </div>
            <span className="text-xs text-[var(--color-muted)]">{alocacaoData.length} classes</span>
          </div>

          <div className="mt-3 flex-1">
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip
                    formatter={(val: any) => [formatCurrency(Number(val)), 'Patrimônio']}
                    contentStyle={{
                      backgroundColor: 'var(--color-surface)',
                      borderColor: 'var(--color-border)',
                      borderRadius: '0.5rem',
                      fontSize: '12px',
                    }}
                  />
                  <Pie
                    data={alocacaoData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {alocacaoData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Legenda compacta com barras */}
            <div className="mt-3 space-y-2 border-t border-[var(--color-border)]/50 pt-3">
              {alocacaoData.map((item) => (
                <div key={item.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="truncate font-medium text-[var(--color-text)]">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-2 tabular-nums">
                    <span className="text-[var(--color-muted)]">{formatCurrency(item.value)}</span>
                    <span className="w-11 text-right font-semibold text-[var(--color-text)]">
                      {item.percentual.toFixed(1).replace('.', ',')}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Maiores Posições da Carteira */}
        <div className="flex flex-col rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-xs lg:col-span-7">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
                <TrendingUp className="h-4 w-4" />
              </div>
              <h3 className="text-sm font-bold text-[var(--color-text)]">Maiores Posições da Carteira</h3>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('renda-variavel')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-primary)] hover:underline"
            >
              <span>Ver todos os ativos</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="mt-4 flex-1 divide-y divide-[var(--color-border)]/50">
            {topAtivos.map((ativo, idx) => {
              const pL = ativo.p_l ?? 0
              const isProfit = pL >= 0
              const peso = ativo.peso_carteira ?? (patrimonioTotal > 0 ? (ativo.valor_atual / patrimonioTotal) * 100 : 0)

              return (
                <div key={ativo.asset_id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[11px] font-bold text-[var(--color-muted)] dark:bg-gray-800">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-[var(--color-text)]">{ativo.codigo}</span>
                        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-muted)] dark:bg-gray-800">
                          {ativo.tipo}
                        </span>
                      </div>
                      <p className="truncate text-xs text-[var(--color-muted)]">{ativo.nome}</p>
                    </div>
                  </div>

                  <div className="text-right tabular-nums">
                    <div className="text-sm font-semibold text-[var(--color-text)]">
                      {formatCurrency(ativo.valor_atual)}
                    </div>
                    <div className="flex items-center justify-end gap-1.5 text-xs">
                      <span className="text-[var(--color-muted)]">{peso.toFixed(1).replace('.', ',')}%</span>
                      {ativo.classe_macro === 'Renda Variável' && (
                        <span
                          className={`inline-flex items-center font-medium ${
                            isProfit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {isProfit ? <TrendingUp className="mr-0.5 h-3 w-3" /> : <TrendingDown className="mr-0.5 h-3 w-3" />}
                          {isProfit ? '+' : ''}
                          {(ativo.rentabilidade_percentual ?? 0).toFixed(1).replace('.', ',')}%
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="mt-5 rounded-lg border border-[var(--color-border)]/70 bg-[var(--color-bg)]/40 p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[var(--color-muted)]">Concentração no Top 5:</span>
              <span className="font-bold text-[var(--color-text)]">
                {topAtivos
                  .reduce((acc, curr) => acc + (curr.peso_carteira ?? 0), 0)
                  .toFixed(1)
                  .replace('.', ',')}
                % do patrimônio total
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
