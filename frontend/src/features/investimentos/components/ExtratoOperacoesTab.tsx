import { useMemo, useState } from 'react'
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  ArrowDownLeft,
  ArrowUpRight,
  Sparkles,
  DollarSign,
  History,
} from 'lucide-react'
import type {
  InvestmentAsset,
  InvestmentTransaction,
  InvestmentTransactionType,
} from '@/shared/types/investimento'
import { formatCurrency, formatDateBr } from '@/shared/utils/date'

interface ExtratoOperacoesTabProps {
  transactions: InvestmentTransaction[]
  assets: InvestmentAsset[]
  onOpenNovaOperacao: () => void
  onEditTransaction: (tx: InvestmentTransaction) => void
  onDeleteTransaction: (txId: number) => void
}

const TX_TYPES: (InvestmentTransactionType | 'Todos')[] = [
  'Todos',
  'Compra',
  'Venda',
  'Dividendos',
  'JCP',
  'Aporte',
  'Resgate',
  'Bonificação',
  'Split',
]

export function ExtratoOperacoesTab({
  transactions,
  assets,
  onOpenNovaOperacao,
  onEditTransaction,
  onDeleteTransaction,
}: ExtratoOperacoesTabProps) {
  const [filterTipo, setFilterTipo] = useState<string>('Todos')
  const [filterAssetId, setFilterAssetId] = useState<string>('todos')
  const [search, setSearch] = useState<string>('')

  // Filtragem
  const filteredTxs = useMemo(() => {
    return transactions.filter((tx) => {
      const matchTipo = filterTipo === 'Todos' || tx.tipo === filterTipo
      const matchAsset = filterAssetId === 'todos' || String(tx.asset_id) === filterAssetId
      const q = search.trim().toLowerCase()
      const matchSearch =
        !q ||
        (tx.ativo_codigo && tx.ativo_codigo.toLowerCase().includes(q)) ||
        (tx.ativo_nome && tx.ativo_nome.toLowerCase().includes(q)) ||
        (tx.corretora && tx.corretora.toLowerCase().includes(q)) ||
        (tx.observacoes && tx.observacoes.toLowerCase().includes(q))
      return matchTipo && matchAsset && matchSearch
    })
  }, [transactions, filterTipo, filterAssetId, search])

  const getBadgeForType = (tipo: InvestmentTransactionType) => {
    switch (tipo) {
      case 'Compra':
        return {
          bg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
          icon: <ArrowDownLeft className="h-3 w-3" />,
        }
      case 'Venda':
        return {
          bg: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
          icon: <ArrowUpRight className="h-3 w-3" />,
        }
      case 'Dividendos':
      case 'JCP':
        return {
          bg: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
          icon: <Sparkles className="h-3 w-3" />,
        }
      case 'Aporte':
        return {
          bg: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
          icon: <DollarSign className="h-3 w-3" />,
        }
      case 'Resgate':
        return {
          bg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
          icon: <ArrowUpRight className="h-3 w-3" />,
        }
      default:
        return {
          bg: 'bg-gray-100 text-[var(--color-muted)] dark:bg-gray-800',
          icon: <History className="h-3 w-3" />,
        }
    }
  }

  return (
    <div className="space-y-4">
      {/* Toolbar com Filtros */}
      <div className="flex flex-col gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3.5 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {/* Filtro por Tipo */}
          <select
            value={filterTipo}
            onChange={(e) => setFilterTipo(e.target.value)}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-2.5 py-1.5 text-xs text-[var(--color-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
          >
            {TX_TYPES.map((t) => (
              <option key={t} value={t}>
                {t === 'Todos' ? 'Todos os Tipos' : t}
              </option>
            ))}
          </select>

          {/* Filtro por Ativo */}
          <select
            value={filterAssetId}
            onChange={(e) => setFilterAssetId(e.target.value)}
            className="max-w-[200px] rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-2.5 py-1.5 text-xs text-[var(--color-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
          >
            <option value="todos">Todos os Ativos</option>
            {assets.map((a) => (
              <option key={a.id} value={String(a.id)}>
                {a.codigo} ({a.nome})
              </option>
            ))}
          </select>
        </div>

        {/* Busca e Botão Nova Operação */}
        <div className="flex items-center gap-2">
          <div className="relative min-w-[180px] max-w-[240px] flex-1">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-muted)]" />
            <input
              type="text"
              placeholder="Buscar corretora, nota…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] py-1.5 pl-8 pr-3 text-xs text-[var(--color-text)] placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
            />
          </div>

          <button
            type="button"
            onClick={onOpenNovaOperacao}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:opacity-90"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Nova Operação</span>
          </button>
        </div>
      </div>

      {/* Tabela de Extrato */}
      <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xs">
        {filteredTxs.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
              <History className="h-6 w-6" />
            </div>
            <h4 className="mt-3 text-sm font-semibold text-[var(--color-text)]">
              Nenhuma movimentação encontrada
            </h4>
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              {search || filterTipo !== 'Todos' || filterAssetId !== 'todos'
                ? 'Nenhuma movimentação corresponde aos filtros selecionados.'
                : 'Registre compras, vendas, aportes ou dividendos para manter o histórico atualizado.'}
            </p>
            <button
              type="button"
              onClick={onOpenNovaOperacao}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:opacity-90"
            >
              <Plus className="h-3.5 w-3.5" />
              Registrar Movimentação
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg)]/60 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                  <th className="px-4 py-3">Data</th>
                  <th className="px-3 py-3">Tipo</th>
                  <th className="px-3 py-3">Ativo</th>
                  <th className="px-3 py-3 text-right">Qtd</th>
                  <th className="px-3 py-3 text-right">Preço Unit.</th>
                  <th className="px-3 py-3 text-right">Taxas</th>
                  <th className="px-3 py-3 text-right">Total da Operação</th>
                  <th className="px-3 py-3">Corretora</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]/50">
                {filteredTxs.map((item) => {
                  const badge = getBadgeForType(item.tipo)
                  const isNegativo = item.tipo === 'Compra' || item.tipo === 'Aporte'

                  return (
                    <tr
                      key={item.id}
                      className="group transition-colors hover:bg-gray-50/70 dark:hover:bg-gray-800/40"
                    >
                      {/* Data */}
                      <td className="px-4 py-3 font-medium text-[var(--color-muted)] whitespace-nowrap">
                        {formatDateBr(item.data_movimentacao)}
                      </td>

                      {/* Tipo */}
                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold ${badge.bg}`}
                        >
                          {badge.icon}
                          <span>{item.tipo}</span>
                        </span>
                      </td>

                      {/* Ativo */}
                      <td className="px-3 py-3">
                        {item.ativo_codigo ? (
                          <div>
                            <span className="font-bold text-[var(--color-text)]">
                              {item.ativo_codigo}
                            </span>
                            {item.ativo_nome && (
                              <span className="ml-1.5 text-[11px] text-[var(--color-muted)]">
                                • {item.ativo_nome}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[var(--color-muted)] italic">Aporte em Carteira</span>
                        )}
                      </td>

                      {/* Quantidade */}
                      <td className="px-3 py-3 text-right tabular-nums text-[var(--color-text)]">
                        {item.quantidade ? Number(item.quantidade).toFixed(4).replace(/\.?0+$/, '') : '—'}
                      </td>

                      {/* Preço Unitário */}
                      <td className="px-3 py-3 text-right tabular-nums text-[var(--color-muted)]">
                        {item.preco ? formatCurrency(Number(item.preco)) : '—'}
                      </td>

                      {/* Taxas */}
                      <td className="px-3 py-3 text-right tabular-nums text-[var(--color-muted)]">
                        {Number(item.taxas || 0) > 0 ? formatCurrency(Number(item.taxas)) : '—'}
                      </td>

                      {/* Total da Operação */}
                      <td className="px-3 py-3 text-right font-bold text-[var(--color-text)] tabular-nums">
                        <span className={isNegativo ? '' : 'text-emerald-600 dark:text-emerald-400'}>
                          {formatCurrency(Number(item.valor_total || 0))}
                        </span>
                      </td>

                      {/* Corretora */}
                      <td className="px-3 py-3 text-[var(--color-muted)]">
                        {item.corretora || '—'}
                      </td>

                      {/* Ações */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => onEditTransaction(item)}
                            title="Editar Operação"
                            className="rounded-md p-1 text-[var(--color-muted)] hover:bg-gray-100 hover:text-[var(--color-text)] dark:hover:bg-gray-800"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteTransaction(item.id)}
                            title="Excluir Operação"
                            className="rounded-md p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
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
