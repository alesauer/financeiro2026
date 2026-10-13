import { useMemo, useState } from 'react'
import {
  ShieldCheck,
  Search,
  Plus,
  Pencil,
  Trash2,
  Landmark,
  ArrowUpDown,
  Lock,
} from 'lucide-react'
import type {
  InvestmentAsset,
  InvestmentDashboard,
  InvestmentDashboardAsset,
} from '@/shared/types/investimento'
import { formatCurrency } from '@/shared/utils/date'

interface RendaFixaTabProps {
  dash: InvestmentDashboard | null
  assets: InvestmentAsset[]
  onOpenNovaOperacao: (asset?: InvestmentDashboardAsset) => void
  onOpenNovoAtivo: (tipoPadrao?: string) => void
  onEditAtivo: (asset: InvestmentAsset) => void
  onDeleteAtivo: (assetId: number) => void
}

const RF_TYPES = ['Tesouro Direto', 'CDB', 'LCI', 'LCA', 'Debêntures', 'Previdência']

export function RendaFixaTab({
  dash,
  assets,
  onOpenNovaOperacao,
  onOpenNovoAtivo,
  onEditAtivo,
  onDeleteAtivo,
}: RendaFixaTabProps) {
  const [filterTipo, setFilterTipo] = useState<string>('todos')
  const [search, setSearch] = useState<string>('')
  const [sortField, setSortField] = useState<'patrimonio' | 'investido' | 'codigo' | 'lucro'>('patrimonio')
  const [sortAsc, setSortAsc] = useState<boolean>(false)

  // Filtrar apenas ativos de Renda Fixa da dashboard consolidada
  const rfAtivos = useMemo(() => {
    if (!dash?.ativos) return []
    return dash.ativos.filter((a) => {
      if (a.classe_macro) return a.classe_macro === 'Renda Fixa'
      return RF_TYPES.includes(a.tipo)
    })
  }, [dash])

  // Filtrar e ordenar ativos
  const filteredAtivos = useMemo(() => {
    let list = rfAtivos.filter((item) => {
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
      } else if (sortField === 'investido') {
        diff = (b.valor_investido || 0) - (a.valor_investido || 0)
      } else if (sortField === 'lucro') {
        diff = (b.p_l || 0) - (a.p_l || 0)
      } else if (sortField === 'codigo') {
        diff = a.codigo.localeCompare(b.codigo)
      }
      return sortAsc ? -diff : diff
    })

    return list
  }, [rfAtivos, filterTipo, search, sortField, sortAsc])

  // Métricas consolidadas de Renda Fixa
  const totalPatrimonioRf = dash?.patrimonio_renda_fixa ?? rfAtivos.reduce((s, a) => s + (a.valor_atual || 0), 0)
  const totalInvestidoRf = dash?.investido_renda_fixa ?? rfAtivos.reduce((s, a) => s + (a.valor_investido || 0), 0)
  const rendimentoRf = totalPatrimonioRf - totalInvestidoRf
  const rendimentoPercentual = totalInvestidoRf > 0 ? (rendimentoRf / totalInvestidoRf) * 100 : 0

  const handleSort = (field: 'patrimonio' | 'investido' | 'codigo' | 'lucro') => {
    if (sortField === field) {
      setSortAsc(!sortAsc)
    } else {
      setSortField(field)
      setSortAsc(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Mini KPIs de Renda Fixa */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3.5 shadow-xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Total em Renda Fixa
          </span>
          <div className="mt-1 text-xl font-bold tracking-tight text-[var(--color-text)] tabular-nums">
            {formatCurrency(totalPatrimonioRf)}
          </div>
        </div>

        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3.5 shadow-xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Total Aportado / Custo
          </span>
          <div className="mt-1 text-xl font-bold tracking-tight text-[var(--color-text)] tabular-nums">
            {formatCurrency(totalInvestidoRf)}
          </div>
        </div>

        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3.5 shadow-xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Rendimento Estimado
          </span>
          <div
            className={`mt-1 text-xl font-bold tracking-tight tabular-nums ${
              rendimentoRf >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-[var(--color-text)]'
            }`}
          >
            {rendimentoRf >= 0 ? '+' : ''}
            {formatCurrency(rendimentoRf)}
          </div>
        </div>

        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3.5 shadow-xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Ganho Acumulado
          </span>
          <div className="mt-1 inline-flex items-center gap-1 text-xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 tabular-nums">
            <span>+{rendimentoPercentual.toFixed(2).replace('.', ',')}%</span>
          </div>
        </div>
      </div>

      {/* Toolbar: Filtros de Categoria, Busca e Botão Novo Ativo */}
      <div className="flex flex-col gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3.5 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        {/* Filtros de Tipo */}
        <div className="flex flex-wrap items-center gap-1.5">
          {['todos', 'CDB', 'Tesouro Direto', 'LCI', 'LCA', 'Debêntures', 'Previdência'].map((tipo) => {
            const isSelected = filterTipo === tipo
            return (
              <button
                key={tipo}
                type="button"
                onClick={() => setFilterTipo(tipo)}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all ${
                  isSelected
                    ? 'bg-sky-600 text-white shadow-xs'
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
              placeholder="Buscar título ou emissor…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] py-1.5 pl-8 pr-3 text-xs text-[var(--color-text)] placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>

          <button
            type="button"
            onClick={() => onOpenNovoAtivo('CDB')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text)] shadow-xs transition hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <Plus className="h-3.5 w-3.5 text-sky-600" />
            <span>Novo Título</span>
          </button>
        </div>
      </div>

      {/* Tabela de Renda Fixa */}
      <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xs">
        {filteredAtivos.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h4 className="mt-3 text-sm font-semibold text-[var(--color-text)]">
              Nenhum ativo de Renda Fixa encontrado
            </h4>
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              {search || filterTipo !== 'todos'
                ? 'Tente ajustar os filtros ou termos da busca.'
                : 'Cadastre títulos do Tesouro Direto, CDBs, LCIs ou LCAs para controlar a segurança do seu patrimônio.'}
            </p>
            <button
              type="button"
              onClick={() => onOpenNovoAtivo('CDB')}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-sky-700"
            >
              <Plus className="h-3.5 w-3.5" />
              Cadastrar Título
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg)]/60 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                  <th
                    className="cursor-pointer px-4 py-3 hover:text-[var(--color-text)]"
                    onClick={() => handleSort('codigo')}
                  >
                    <div className="flex items-center gap-1">
                      <span>Título / Emissor</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                  <th className="px-3 py-3 text-left">Classe / Indexador</th>
                  <th
                    className="cursor-pointer px-3 py-3 text-right hover:text-[var(--color-text)]"
                    onClick={() => handleSort('investido')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Valor Aplicado</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
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
                    onClick={() => handleSort('lucro')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Rendimento</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                  <th className="px-3 py-3 text-center">Peso</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]/50">
                {filteredAtivos.map((item) => {
                  const lucro = item.p_l ?? 0
                  const isProfit = lucro >= 0
                  const rent = item.rentabilidade_percentual ?? 0
                  const peso = item.peso_carteira ?? 0
                  const rawAsset = assets.find((a) => a.id === item.asset_id)

                  return (
                    <tr
                      key={item.asset_id}
                      className="group transition-colors hover:bg-gray-50/70 dark:hover:bg-gray-800/40"
                    >
                      {/* Título / Emissor */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 font-bold text-sky-600 dark:text-sky-400">
                            <Landmark className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <span className="font-bold text-sm text-[var(--color-text)]">
                              {item.codigo}
                            </span>
                            <p className="truncate text-[11px] text-[var(--color-muted)]">
                              {item.nome}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Classe / Indexador */}
                      <td className="px-3 py-3">
                        <span className="inline-flex items-center gap-1 rounded bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
                          <Lock className="h-3 w-3" />
                          {item.tipo}
                        </span>
                        {item.setor && (
                          <span className="ml-1.5 text-[11px] text-[var(--color-muted)]">
                            • {item.setor}
                          </span>
                        )}
                      </td>

                      {/* Valor Aplicado */}
                      <td className="px-3 py-3 text-right text-[var(--color-muted)] tabular-nums">
                        {formatCurrency(item.valor_investido)}
                      </td>

                      {/* Saldo Atual */}
                      <td className="px-3 py-3 text-right font-bold text-[var(--color-text)] tabular-nums">
                        {formatCurrency(item.valor_atual)}
                      </td>

                      {/* Rendimento */}
                      <td className="px-3 py-3 text-right tabular-nums">
                        <span
                          className={`font-semibold ${
                            isProfit ? 'text-emerald-600 dark:text-emerald-400' : 'text-[var(--color-text)]'
                          }`}
                        >
                          {isProfit ? '+' : ''}
                          {formatCurrency(lucro)}
                        </span>
                        {item.valor_investido > 0 && (
                          <div className="text-[10px] text-[var(--color-muted)]">
                            +{rent.toFixed(2).replace('.', ',')}%
                          </div>
                        )}
                      </td>

                      {/* Peso na Carteira */}
                      <td className="px-3 py-3 text-center">
                        <div className="inline-flex flex-col items-center">
                          <span className="text-[11px] font-medium text-[var(--color-text)] tabular-nums">
                            {peso.toFixed(1).replace('.', ',')}%
                          </span>
                          <div className="mt-1 h-1.5 w-12 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                            <div
                              className="h-full rounded-full bg-sky-500"
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
                            title="Registrar Aporte / Resgate"
                            className="inline-flex items-center gap-1 rounded-md bg-sky-500/10 px-2 py-1 text-[11px] font-semibold text-sky-600 transition hover:bg-sky-600 hover:text-white dark:text-sky-400"
                          >
                            <Plus className="h-3 w-3" />
                            <span>Aporte</span>
                          </button>
                          {rawAsset && (
                            <>
                              <button
                                type="button"
                                onClick={() => onEditAtivo(rawAsset)}
                                title="Editar Título"
                                className="rounded-md p-1 text-[var(--color-muted)] hover:bg-gray-100 hover:text-[var(--color-text)] dark:hover:bg-gray-800"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onDeleteAtivo(rawAsset.id)}
                                title="Excluir Título"
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
