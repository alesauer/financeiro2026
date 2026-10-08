import { useState } from 'react'
import type { Milha, MilhasFiltros } from '@/shared/types/milha'
import { obterMetaPrograma, CATEGORIAS_ORIGEM } from '../utils/programasConfig'
import { formatCurrency, formatDateBr } from '@/shared/utils/date'
import {
  ArrowDownLeft,
  ArrowUpRight,
  Search,
  Filter,
  Trash2,
  Edit2,
  AlertTriangle,
  Sparkles,
  RefreshCw,
} from 'lucide-react'

type Props = {
  items: Milha[]
  totalItems: number
  currentPage: number
  totalPages: number
  loading?: boolean
  filtros: MilhasFiltros
  programasDisponiveis: string[]
  onFiltrosChange: (filtros: Partial<MilhasFiltros>) => void
  onEditar: (item: Milha) => void
  onExcluir: (id: number) => void
  onExcluirLote: (ids: number[]) => void
}

export function MilhasTable({
  items,
  totalItems,
  currentPage,
  totalPages,
  loading,
  filtros,
  programasDisponiveis,
  onFiltrosChange,
  onEditar,
  onExcluir,
  onExcluirLote,
}: Props) {
  const [selectedIds, setSelectedIds] = useState<number[]>([])

  const hoje = new Date()

  const handleSelectAll = () => {
    if (selectedIds.length === items.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(items.map((i) => i.id))
    }
  }

  const handleToggleSelect = (id: number) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]))
  }

  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) return
    if (!window.confirm(`Confirma a exclusão de ${selectedIds.length} movimentações selecionadas?`)) return
    onExcluirLote(selectedIds)
    setSelectedIds([])
  }

  return (
    <div className="space-y-4 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
      {/* Header & Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Extrato de Movimentações
          </h3>
          <p className="text-xs text-[var(--color-muted)]">
            {totalItems} movimentações encontradas
          </p>
        </div>

        {selectedIds.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-[var(--color-muted)]">
              {selectedIds.length} selecionado(s)
            </span>
            <button
              type="button"
              onClick={handleDeleteSelected}
              className="flex items-center gap-1 rounded bg-rose-600 px-2.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-rose-700"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Excluir selecionados
            </button>
          </div>
        )}
      </div>

      {/* Filter Bar */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[var(--color-muted)]" />
          <input
            type="text"
            placeholder="Buscar por descrição..."
            value={filtros.search || ''}
            onChange={(e) => onFiltrosChange({ search: e.target.value, page: 1 })}
            className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] py-1.5 pl-8 pr-3 text-xs text-[var(--color-text)] placeholder:text-[var(--color-muted)] focus:border-[var(--color-primary)] focus:outline-hidden"
          />
        </div>

        {/* Programa */}
        <div>
          <select
            value={filtros.programa || ''}
            onChange={(e) => onFiltrosChange({ programa: e.target.value || undefined, page: 1 })}
            className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-2.5 py-1.5 text-xs text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-hidden"
          >
            <option value="">Todos os programas</option>
            {programasDisponiveis.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        {/* Tipo (Entrada/Saída) */}
        <div>
          <select
            value={filtros.tipo || ''}
            onChange={(e) => onFiltrosChange({ tipo: (e.target.value as any) || undefined, page: 1 })}
            className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-2.5 py-1.5 text-xs text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-hidden"
          >
            <option value="">Entradas e Saídas</option>
            <option value="entrada">Apenas Entradas (+)</option>
            <option value="saida">Apenas Saídas (-)</option>
          </select>
        </div>

        {/* Categoria Origem */}
        <div>
          <select
            value={filtros.categoria_origem || ''}
            onChange={(e) => onFiltrosChange({ categoria_origem: e.target.value || undefined, page: 1 })}
            className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-2.5 py-1.5 text-xs text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-hidden"
          >
            <option value="">Todas as categorias</option>
            {CATEGORIAS_ORIGEM.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* Limpar Filtros */}
        {(filtros.search || filtros.programa || filtros.tipo || filtros.categoria_origem) && (
          <button
            type="button"
            onClick={() =>
              onFiltrosChange({
                search: undefined,
                programa: undefined,
                tipo: undefined,
                categoria_origem: undefined,
                page: 1,
              })
            }
            className="flex items-center justify-center gap-1 rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2.5 py-1.5 text-xs font-medium text-[var(--color-muted)] hover:text-[var(--color-text)]"
          >
            <Filter className="h-3.5 w-3.5" />
            Limpar filtros
          </button>
        )}
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-[var(--color-border)] text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            <tr>
              <th className="py-2.5 pl-2 pr-2 w-8">
                <input
                  type="checkbox"
                  checked={items.length > 0 && selectedIds.length === items.length}
                  onChange={handleSelectAll}
                  className="rounded border-[var(--color-border)] text-[var(--color-primary)]"
                />
              </th>
              <th className="py-2.5 px-3">Data</th>
              <th className="py-2.5 px-3">Programa</th>
              <th className="py-2.5 px-3">Tipo & Categoria</th>
              <th className="py-2.5 px-3 text-right">Quantidade</th>
              <th className="py-2.5 px-3 text-right">Custo / CPM</th>
              <th className="py-2.5 px-3">Expiração</th>
              <th className="py-2.5 px-3">Descrição / Origem</th>
              <th className="py-2.5 pr-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]/60">
            {loading ? (
              <tr>
                <td colSpan={9} className="py-8 text-center text-[var(--color-muted)]">
                  <RefreshCw className="mx-auto h-5 w-5 animate-spin text-[var(--color-muted)]" />
                  <span className="mt-2 block">Carregando movimentações...</span>
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-8 text-center text-[var(--color-muted)]">
                  Nenhuma movimentação encontrada com os filtros atuais.
                </td>
              </tr>
            ) : (
              items.map((item) => {
                const meta = obterMetaPrograma(item.programa)
                const isEntrada = item.tipo === 'entrada'
                const isSelected = selectedIds.includes(item.id)

                let expiraAlerta = false
                let diasRestantes = null
                if (item.data_expiracao && isEntrada) {
                  const expDate = new Date(item.data_expiracao)
                  diasRestantes = Math.ceil((expDate.getTime() - hoje.getTime()) / (1000 * 3600 * 24))
                  if (diasRestantes <= 60 && diasRestantes >= 0) expiraAlerta = true
                }

                return (
                  <tr
                    key={item.id}
                    className={`transition hover:bg-[var(--color-bg)]/40 ${
                      isSelected ? 'bg-[var(--color-primary)]/5' : ''
                    }`}
                  >
                    <td className="py-2.5 pl-2 pr-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelect(item.id)}
                        className="rounded border-[var(--color-border)] text-[var(--color-primary)]"
                      />
                    </td>

                    {/* Data */}
                    <td className="py-2.5 px-3 whitespace-nowrap font-medium text-[var(--color-text)]">
                      {item.data_movimentacao ? formatDateBr(item.data_movimentacao) : '-'}
                    </td>

                    {/* Programa */}
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                        style={{
                          backgroundColor: meta.bgLight,
                          color: meta.textColor,
                        }}
                      >
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: meta.corPrimaria }}
                        />
                        {item.programa}
                      </span>
                    </td>

                    {/* Tipo & Categoria */}
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                            isEntrada
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                              : 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'
                          }`}
                        >
                          {isEntrada ? (
                            <ArrowDownLeft className="h-3 w-3" />
                          ) : (
                            <ArrowUpRight className="h-3 w-3" />
                          )}
                        </span>
                        <span className="font-medium text-[var(--color-text)]">
                          {item.categoria_origem || (isEntrada ? 'Entrada' : 'Saída')}
                        </span>
                        {item.taxa_bonus && item.taxa_bonus > 0 ? (
                          <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:bg-emerald-400/20 dark:text-emerald-300">
                            <Sparkles className="h-2.5 w-2.5" />+{item.taxa_bonus}%
                          </span>
                        ) : null}
                      </div>
                    </td>

                    {/* Quantidade */}
                    <td className="py-2.5 px-3 whitespace-nowrap text-right">
                      <span
                        className={`font-bold ${
                          isEntrada
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {isEntrada ? '+' : '-'}
                        {item.quantidade.toLocaleString('pt-BR')} pts
                      </span>
                    </td>

                    {/* Custo / CPM */}
                    <td className="py-2.5 px-3 whitespace-nowrap text-right">
                      {item.custo_reais && item.custo_reais > 0 ? (
                        <div>
                          <span className="font-semibold text-[var(--color-text)]">
                            {formatCurrency(item.custo_reais)}
                          </span>
                          {item.cpm ? (
                            <span className="block text-[10px] text-[var(--color-muted)]">
                              CPM {formatCurrency(item.cpm)}/k
                            </span>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-[var(--color-muted)]">-</span>
                      )}
                    </td>

                    {/* Expiração */}
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      {item.data_expiracao ? (
                        <div className="flex items-center gap-1">
                          <span
                            className={
                              expiraAlerta
                                ? 'font-semibold text-rose-600 dark:text-rose-400'
                                : 'text-[var(--color-text)]'
                            }
                          >
                            {formatDateBr(item.data_expiracao)}
                          </span>
                          {expiraAlerta && (
                            <span
                              title={`Expira em ${diasRestantes} dias!`}
                              className="inline-flex items-center rounded-full bg-rose-100 p-0.5 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400"
                            >
                              <AlertTriangle className="h-3 w-3" />
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-[var(--color-muted)]">Não expira</span>
                      )}
                    </td>

                    {/* Descrição / Origem */}
                    <td className="py-2.5 px-3 max-w-[200px] truncate text-[var(--color-muted)]" title={item.descricao || item.origem || ''}>
                      {item.descricao || item.origem || '-'}
                    </td>

                    {/* Ações */}
                    <td className="py-2.5 pr-2 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => onEditar(item)}
                          title="Editar movimentação"
                          className="rounded p-1 text-[var(--color-muted)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onExcluir(item.id)}
                          title="Excluir movimentação"
                          className="rounded p-1 text-[var(--color-muted)] hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-[var(--color-border)] pt-3 text-xs">
          <span className="text-[var(--color-muted)]">
            Página {currentPage} de {totalPages}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => onFiltrosChange({ page: currentPage - 1 })}
              className="rounded border border-[var(--color-border)] px-2.5 py-1 font-medium disabled:opacity-40"
            >
              Anterior
            </button>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => onFiltrosChange({ page: currentPage + 1 })}
              className="rounded border border-[var(--color-border)] px-2.5 py-1 font-medium disabled:opacity-40"
            >
              Próxima
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
