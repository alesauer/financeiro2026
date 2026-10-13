import { useMemo, useState } from 'react'
import {
  TrendingUp,
  TrendingDown,
  Search,
  Plus,
  Pencil,
  Trash2,
  PieChart,
  ArrowUpDown,
} from 'lucide-react'
import type {
  InvestmentAsset,
  InvestmentDashboard,
  InvestmentDashboardAsset,
} from '@/shared/types/investimento'
import { formatCurrency } from '@/shared/utils/date'

interface RendaVariavelTabProps {
  dash: InvestmentDashboard | null
  assets: InvestmentAsset[]
  onOpenNovaOperacao: (asset?: InvestmentDashboardAsset) => void
  onOpenNovoAtivo: (tipoPadrao?: string) => void
  onEditAtivo: (asset: InvestmentAsset) => void
  onDeleteAtivo: (assetId: number) => void
}

const RV_TYPES = ['Ações', 'FIIs', 'BDRs', 'ETFs', 'Criptomoedas']

export function RendaVariavelTab({
  dash,
  assets,
  onOpenNovaOperacao,
  onOpenNovoAtivo,
  onEditAtivo,
  onDeleteAtivo,
}: RendaVariavelTabProps) {
  const [filterTipo, setFilterTipo] = useState<string>('todos')
  const [search, setSearch] = useState<string>('')
  const [sortField, setSortField] = useState<'patrimonio' | 'pl' | 'codigo' | 'rentabilidade'>('patrimonio')
  const [sortAsc, setSortAsc] = useState<boolean>(false)

  // Filtrar apenas ativos de Renda Variável da dashboard consolidada
  const rvAtivos = useMemo(() => {
    if (!dash?.ativos) return []
    return dash.ativos.filter((a) => {
      if (a.classe_macro) return a.classe_macro === 'Renda Variável'
      return RV_TYPES.includes(a.tipo)
    })
  }, [dash])

  // Filtrar e ordenar ativos
  const filteredAtivos = useMemo(() => {
    let list = rvAtivos.filter((item) => {
      const matchTipo = filterTipo === 'todos' || item.tipo === filterTipo
      const q = search.trim().toLowerCase()
      const matchSearch =
        !q ||
        item.codigo.toLowerCase().includes(q) ||
        item.nome.toLowerCase().includes(q) ||
        (item.setor && item.setor.toLowerCase().includes(q))
      return matchTipo && matchSearch
    })

    list.sort((a, b) => {
      let diff = 0
      if (sortField === 'patrimonio') {
        diff = (b.valor_atual || 0) - (a.valor_atual || 0)
      } else if (sortField === 'pl') {
        diff = (b.p_l || 0) - (a.p_l || 0)
      } else if (sortField === 'rentabilidade') {
        diff = (b.rentabilidade_percentual || 0) - (a.rentabilidade_percentual || 0)
      } else if (sortField === 'codigo') {
        diff = a.codigo.localeCompare(b.codigo)
      }
      return sortAsc ? -diff : diff
    })

    return list
  }, [rvAtivos, filterTipo, search, sortField, sortAsc])

  // Métricas de Renda Variável
  const totalPatrimonioRv = dash?.patrimonio_renda_variavel ?? rvAtivos.reduce((s, a) => s + (a.valor_atual || 0), 0)
  const totalInvestidoRv = dash?.investido_renda_variavel ?? rvAtivos.reduce((s, a) => s + (a.valor_investido || 0), 0)
  const lucroRv = dash?.lucro_renda_variavel ?? (totalPatrimonioRv - totalInvestidoRv)
  const rentRv = dash?.rentabilidade_renda_variavel ?? (totalInvestidoRv > 0 ? (lucroRv / totalInvestidoRv) * 100 : 0)

  const handleSort = (field: 'patrimonio' | 'pl' | 'codigo' | 'rentabilidade') => {
    if (sortField === field) {
      setSortAsc(!sortAsc)
    } else {
      setSortField(field)
      setSortAsc(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Mini KPIs de Renda Variável */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3.5 shadow-xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Total em Renda Variável
          </span>
          <div className="mt-1 text-xl font-bold tracking-tight text-[var(--color-text)] tabular-nums">
            {formatCurrency(totalPatrimonioRv)}
          </div>
        </div>

        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3.5 shadow-xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Custo Investido
          </span>
          <div className="mt-1 text-xl font-bold tracking-tight text-[var(--color-text)] tabular-nums">
            {formatCurrency(totalInvestidoRv)}
          </div>
        </div>

        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3.5 shadow-xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Lucro / Prejuízo Aberto
          </span>
          <div
            className={`mt-1 text-xl font-bold tracking-tight tabular-nums ${
              lucroRv >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {lucroRv >= 0 ? '+' : ''}
            {formatCurrency(lucroRv)}
          </div>
        </div>

        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3.5 shadow-xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Rentabilidade Média
          </span>
          <div
            className={`mt-1 inline-flex items-center gap-1 text-xl font-bold tracking-tight tabular-nums ${
              rentRv >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {rentRv >= 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
            <span>
              {rentRv >= 0 ? '+' : ''}
              {rentRv.toFixed(2).replace('.', ',')}%
            </span>
          </div>
        </div>
      </div>

      {/* Toolbar: Filtros de Categoria, Busca e Botão Novo Ativo */}
      <div className="flex flex-col gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3.5 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        {/* Filtros em formato de pílulas */}
        <div className="flex flex-wrap items-center gap-1.5">
          {['todos', 'Ações', 'FIIs', 'BDRs', 'ETFs', 'Criptomoedas'].map((tipo) => {
            const isSelected = filterTipo === tipo
            return (
              <button
                key={tipo}
                type="button"
                onClick={() => setFilterTipo(tipo)}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all ${
                  isSelected
                    ? 'bg-[var(--color-primary)] text-white shadow-xs'
                    : 'bg-gray-100 text-[var(--color-muted)] hover:bg-gray-200 hover:text-[var(--color-text)] dark:bg-gray-800'
                }`}
              >
                {tipo === 'todos' ? 'Todos' : tipo}
              </button>
            )
          })}
        </div>

        {/* Busca e Ações */}
        <div className="flex items-center gap-2">
          <div className="relative min-w-[180px] max-w-[260px] flex-1">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-muted)]" />
            <input
              type="text"
              placeholder="Buscar ticker ou nome…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] py-1.5 pl-8 pr-3 text-xs text-[var(--color-text)] placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
            />
          </div>

          <button
            type="button"
            onClick={() => onOpenNovoAtivo('Ações')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text)] shadow-xs transition hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <Plus className="h-3.5 w-3.5 text-[var(--color-primary)]" />
            <span>Novo Ativo</span>
          </button>
        </div>
      </div>

      {/* Tabela de Renda Variável */}
      <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xs">
        {filteredAtivos.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600">
              <PieChart className="h-6 w-6" />
            </div>
            <h4 className="mt-3 text-sm font-semibold text-[var(--color-text)]">
              Nenhum ativo de Renda Variável encontrado
            </h4>
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              {search || filterTipo !== 'todos'
                ? 'Tente ajustar os filtros ou termos da busca.'
                : 'Cadastre suas ações, FIIs, ETFs ou BDRs para acompanhar suas cotações e rendimentos.'}
            </p>
            <button
              type="button"
              onClick={() => onOpenNovoAtivo('Ações')}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:opacity-90"
            >
              <Plus className="h-3.5 w-3.5" />
              Cadastrar Ativo
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg)]/60 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                  <th
                    className="cursor-pointer px-4 py-3 hover:text-[var(--color-text)]"
                    onClick={() => handleSort('codigo')}
                  >
                    <div className="flex items-center gap-1">
                      <span>Ativo</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                  <th className="px-3 py-3 text-right">Qtd</th>
                  <th className="px-3 py-3 text-right">Preço Médio</th>
                  <th className="px-3 py-3 text-right">Cotação Atual</th>
                  <th className="px-3 py-3 text-right">Var. Dia</th>
                  <th
                    className="cursor-pointer px-3 py-3 text-right hover:text-[var(--color-text)]"
                    onClick={() => handleSort('patrimonio')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Saldo Atual</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                  <th
                    className="cursor-pointer px-3 py-3 text-right hover:text-[var(--color-text)]"
                    onClick={() => handleSort('pl')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Lucro / Prejuízo</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                  <th
                    className="cursor-pointer px-3 py-3 text-right hover:text-[var(--color-text)]"
                    onClick={() => handleSort('rentabilidade')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Rentab.</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                  <th className="px-3 py-3 text-center">Peso</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]/50">
                {filteredAtivos.map((item) => {
                  const isProfit = item.p_l >= 0
                  const rent = item.rentabilidade_percentual ?? 0
                  const peso = item.peso_carteira ?? 0
                  const rawAsset = assets.find((a) => a.id === item.asset_id)

                  return (
                    <tr
                      key={item.asset_id}
                      className="group transition-colors hover:bg-gray-50/70 dark:hover:bg-gray-800/40"
                    >
                      {/* Ativo: Badge do Ticker + Nome + Tipo */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-primary)]/10 font-bold text-[11px] text-[var(--color-primary)]">
                            {item.codigo.slice(0, 4)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-sm text-[var(--color-text)]">
                                {item.codigo}
                              </span>
                              <span className="rounded bg-gray-100 px-1.5 py-0.2 text-[10px] font-medium text-[var(--color-muted)] dark:bg-gray-800">
                                {item.tipo}
                              </span>
                            </div>
                            <p className="truncate text-[11px] text-[var(--color-muted)]">
                              {item.nome}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Quantidade */}
                      <td className="px-3 py-3 text-right font-medium text-[var(--color-text)] tabular-nums">
                        {item.quantidade % 1 === 0 ? item.quantidade : item.quantidade.toFixed(4)}
                      </td>

                      {/* Preço Médio */}
                      <td className="px-3 py-3 text-right text-[var(--color-muted)] tabular-nums">
                        {formatCurrency(item.preco_medio ?? item.valor_investido / (item.quantidade || 1))}
                      </td>

                      {/* Cotação Atual */}
                      <td className="px-3 py-3 text-right font-semibold text-[var(--color-text)] tabular-nums">
                        {formatCurrency(item.preco_atual)}
                      </td>

                      {/* Variação Dia */}
                      <td className="px-3 py-3 text-right tabular-nums">
                        {item.variacao_dia !== null && item.variacao_dia !== undefined ? (
                          <span
                            className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 font-medium ${
                              item.variacao_dia >= 0
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            {item.variacao_dia >= 0 ? '+' : ''}
                            {item.variacao_dia.toFixed(2).replace('.', ',')}%
                          </span>
                        ) : (
                          <span className="text-[var(--color-muted)]">—</span>
                        )}
                      </td>

                      {/* Saldo Atual */}
                      <td className="px-3 py-3 text-right font-bold text-[var(--color-text)] tabular-nums">
                        {formatCurrency(item.valor_atual)}
                      </td>

                      {/* Lucro / Prejuízo R$ */}
                      <td
                        className={`px-3 py-3 text-right font-semibold tabular-nums ${
                          isProfit
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {isProfit ? '+' : ''}
                        {formatCurrency(item.p_l)}
                      </td>

                      {/* Rentabilidade % */}
                      <td
                        className={`px-3 py-3 text-right font-semibold tabular-nums ${
                          rent >= 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {rent >= 0 ? '+' : ''}
                        {rent.toFixed(2).replace('.', ',')}%
                      </td>

                      {/* Peso na Carteira */}
                      <td className="px-3 py-3 text-center">
                        <div className="inline-flex flex-col items-center">
                          <span className="text-[11px] font-medium text-[var(--color-text)] tabular-nums">
                            {peso.toFixed(1).replace('.', ',')}%
                          </span>
                          <div className="mt-1 h-1.5 w-12 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                            <div
                              className="h-full rounded-full bg-[var(--color-primary)]"
                              style={{ width: `${Math.min(peso, 100)}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Ações */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => onOpenNovaOperacao(item)}
                            title="Registrar Operação"
                            className="inline-flex items-center gap-1 rounded-md bg-[var(--color-primary)]/10 px-2 py-1 text-[11px] font-semibold text-[var(--color-primary)] transition hover:bg-[var(--color-primary)] hover:text-white"
                          >
                            <Plus className="h-3 w-3" />
                            <span>Operar</span>
                          </button>
                          {rawAsset && (
                            <>
                              <button
                                type="button"
                                onClick={() => onEditAtivo(rawAsset)}
                                title="Editar Ativo"
                                className="rounded-md p-1 text-[var(--color-muted)] hover:bg-gray-100 hover:text-[var(--color-text)] dark:hover:bg-gray-800"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onDeleteAtivo(rawAsset.id)}
                                title="Excluir Ativo"
                                className="rounded-md p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
