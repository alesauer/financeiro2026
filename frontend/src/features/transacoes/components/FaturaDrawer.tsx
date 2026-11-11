import { useEffect, useMemo, useState } from 'react'
import {
  X,
  Calendar,
  Clock,
  Search,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Edit2,
  PieChart as PieIcon,
  Tag,
  ArrowDownRight,
  ShieldCheck,
  ArrowUpDown,
} from 'lucide-react'
import type { FaturaCartao, Transacao } from '@/shared/types/transacao'
import { formatCurrency } from '@/shared/utils/date'
import { BankCardIcon } from '@/shared/components/BankCardIcon'
import { MerchantAvatar } from '@/shared/components/MerchantAvatar'

interface FaturaDrawerProps {
  isOpen: boolean
  fatura: FaturaCartao | null
  onClose: () => void
  onEditarTransacao?: (transacao: Transacao) => void
  onExcluirTransacao?: (id: number) => void
  onExcluirLote?: (ids: number[]) => void
  onQuitarFatura?: (fatura: FaturaCartao, status: 'Pago' | 'Pendente') => Promise<void>
}

export function FaturaDrawer({
  isOpen,
  fatura,
  onClose,
  onEditarTransacao,
  onExcluirTransacao,
  onExcluirLote,
  onQuitarFatura,
}: FaturaDrawerProps) {
  const [busca, setBusca] = useState('')
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('')
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [loadingAcao, setLoadingAcao] = useState(false)
  const [ordemData, setOrdemData] = useState<'asc' | 'desc'>('asc')

  // Fechar com tecla ESC
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Limpar seleções e filtros ao abrir nova fatura
  useEffect(() => {
    if (isOpen) {
      setBusca('')
      setCategoriaFiltro('')
      setSelectedIds([])
      setOrdemData('asc')
    }
  }, [isOpen, fatura?.key])

  const itensFiltrados = useMemo(() => {
    if (!fatura?.transacoes) return []
    let list = fatura.transacoes

    if (busca.trim()) {
      const q = busca.toLowerCase()
      list = list.filter(
        (t) =>
          t.descricao.toLowerCase().includes(q) ||
          (t.categoria_nome && t.categoria_nome.toLowerCase().includes(q)) ||
          t.valor.includes(q),
      )
    }

    if (categoriaFiltro) {
      list = list.filter((t) => (t.categoria_nome || 'Outros') === categoriaFiltro)
    }

    // Ordenação ascendente por padrão (da primeira compra até a última compra do ciclo)
    return [...list].sort((a, b) => {
      const dtA = a.data_transacao || ''
      const dtB = b.data_transacao || ''
      if (dtA !== dtB) {
        return ordemData === 'asc' ? dtA.localeCompare(dtB) : dtB.localeCompare(dtA)
      }
      return ordemData === 'asc' ? a.id - b.id : b.id - a.id
    })
  }, [fatura?.transacoes, busca, categoriaFiltro, ordemData])

  if (!isOpen || !fatura) return null

  const isQuitada = fatura.status_fatura === 'Pago'
  const isParcial = fatura.status_fatura === 'Parcial'

  const handleToggleSelectAll = () => {
    if (selectedIds.length === itensFiltrados.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(itensFiltrados.map((item) => item.id))
    }
  }

  const handleToggleSelect = (id: number) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]))
  }

  const handleQuitarClick = async () => {
    if (!onQuitarFatura) return
    setLoadingAcao(true)
    try {
      const novoStatus = isQuitada ? 'Pendente' : 'Pago'
      await onQuitarFatura(fatura, novoStatus)
    } finally {
      setLoadingAcao(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-300 animate-fade-in"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <aside className="w-screen max-w-2xl bg-[var(--color-surface)] shadow-2xl flex flex-col border-l border-[var(--color-border)] transform transition-transform duration-300 ease-in-out">
          {/* Header da Gaveta */}
          <div className="px-6 py-5 border-b border-[var(--color-border)] bg-[var(--color-bg)]/50">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <BankCardIcon
                  icone={fatura.forma_pagamento_icone}
                  cor={fatura.forma_pagamento_cor}
                  nome={fatura.cartao_nome}
                  size="lg"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-[var(--color-text)]">
                      Fatura {fatura.cartao_nome}
                    </h3>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        isQuitada
                          ? 'bg-emerald-100 text-emerald-800'
                          : isParcial
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {isQuitada ? (
                        <>
                          <CheckCircle2 className="h-3 w-3" /> Fatura Quitada
                        </>
                      ) : isParcial ? (
                        <>
                          <Clock className="h-3 w-3" /> Parcialmente Paga
                        </>
                      ) : (
                        <>
                          <AlertCircle className="h-3 w-3" /> Pendente de Pagamento
                        </>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-[var(--color-muted)] mt-1 flex-wrap">
                    <span className="flex items-center gap-1 font-medium text-[var(--color-text)]">
                      <Calendar className="h-3.5 w-3.5 text-emerald-600" />
                      Vencimento do Boleto: <strong>{fatura.data_vencimento_label}</strong>
                    </span>
                    {fatura.periodo_compras_label && (
                      <span>
                        · Compras realizadas: <strong>{fatura.periodo_compras_label}</strong>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-2 text-[var(--color-muted)] hover:bg-[var(--color-border)]/50 hover:text-[var(--color-text)] transition-colors"
                title="Fechar gaveta (Esc)"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Metric Cards da Fatura */}
            <div className="grid grid-cols-3 gap-3 mt-4">
              <div className="rounded-[var(--radius-md)] border border-blue-200 bg-blue-50/70 p-3">
                <p className="text-[11px] font-semibold text-blue-800 uppercase tracking-wider">
                  {fatura.origem_oficial ? 'Fatura Fechada' : 'Total Gastos'}
                </p>
                <p className="text-base font-bold text-blue-950 mt-0.5">{formatCurrency(fatura.total)}</p>
                <p className="text-[10px] text-blue-700 mt-0.5 font-medium">
                  {fatura.origem_oficial && fatura.total_lancamentos !== undefined && Math.abs(fatura.total_lancamentos - fatura.total) > 0.05
                    ? `Lançamentos: ${formatCurrency(fatura.total_lancamentos)}`
                    : `${fatura.qtd_compras} compras ${fatura.qtd_estornos > 0 ? `· ${fatura.qtd_estornos} estorno(s)` : ''}`}
                </p>
              </div>

              <div className="rounded-[var(--radius-md)] border border-emerald-200 bg-emerald-50/70 p-3">
                <p className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider">Já Pago</p>
                <p className="text-base font-bold text-emerald-950 mt-0.5">{formatCurrency(fatura.total_pagas)}</p>
                <p className="text-[10px] text-emerald-700 mt-0.5 font-medium">
                  {fatura.total_pagas > 0 ? 'Abatido da fatura' : 'Nenhum pagamento'}
                </p>
              </div>

              <div className="rounded-[var(--radius-md)] border border-amber-200 bg-amber-50/70 p-3">
                <p className="text-[11px] font-semibold text-amber-800 uppercase tracking-wider">Saldo a Pagar</p>
                <p className="text-base font-bold text-amber-950 mt-0.5">{formatCurrency(fatura.total_pendentes)}</p>
                <p className="text-[10px] text-amber-700 mt-0.5 font-medium">
                  {fatura.total_pendentes <= 0 ? '✓ Sem pendências' : `Boleto de ${fatura.data_vencimento_label}`}
                </p>
              </div>
            </div>

            {/* Aviso informativo de conciliação de fatura fechada */}
            {fatura.origem_oficial && fatura.total_lancamentos !== undefined && Math.abs(fatura.total_lancamentos - fatura.total) > 0.05 && (
              <div className="mt-3 rounded-lg bg-sky-50/90 border border-sky-200/90 p-2.5 text-xs text-sky-950 flex items-start gap-2.5 shadow-2xs">
                <ShieldCheck className="h-4 w-4 text-sky-600 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <span className="font-semibold text-sky-900">Fatura oficial confirmada pelo banco: </span>
                  O valor fechado cobrado/pago no boleto foi de <strong>{formatCurrency(fatura.total)}</strong>.
                  Os lançamentos individuais do período totalizam {formatCurrency(fatura.total_lancamentos)}, refletindo pagamentos parciais antecipados e estornos do ciclo.
                </div>
              </div>
            )}

            {/* Categorias Resumo Pill Bar */}
            {fatura.categorias_resumo && fatura.categorias_resumo.length > 0 && (
              <div className="mt-3 pt-3 border-t border-[var(--color-border)]/60 flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
                <span className="text-[11px] font-semibold text-[var(--color-muted)] flex items-center gap-1 shrink-0 mr-1">
                  <PieIcon className="h-3 w-3" /> Categorias:
                </span>
                <button
                  type="button"
                  onClick={() => setCategoriaFiltro('')}
                  className={`px-2 py-0.5 rounded-full text-[11px] font-medium shrink-0 transition ${
                    !categoriaFiltro
                      ? 'bg-[var(--color-primary)] text-white shadow-xs'
                      : 'bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)]'
                  }`}
                >
                  Todas ({fatura.qtd_transacoes})
                </button>
                {fatura.categorias_resumo.map((c) => (
                  <button
                    key={c.categoria}
                    type="button"
                    onClick={() => setCategoriaFiltro(categoriaFiltro === c.categoria ? '' : c.categoria)}
                    className={`px-2 py-0.5 rounded-full text-[11px] font-medium shrink-0 transition flex items-center gap-1 ${
                      categoriaFiltro === c.categoria
                        ? 'bg-[var(--color-primary)] text-white shadow-xs'
                        : 'bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)]'
                    }`}
                  >
                    <span>{c.categoria}</span>
                    <span className="opacity-75 font-normal">({c.percentual}%)</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Barra de Busca e Ações em Lote */}
          <div className="px-6 py-3 border-b border-[var(--color-border)] flex items-center justify-between gap-3 bg-[var(--color-bg)]/20">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--color-muted)]" />
                <input
                  type="text"
                  placeholder="Filtrar lançamentos da fatura..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="w-full h-8 pl-8 pr-3 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] text-xs text-[var(--color-text)] placeholder-[var(--color-muted)] focus:outline-none focus:border-[var(--color-primary)]"
                />
              </div>

              <button
                type="button"
                onClick={() => setOrdemData((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
                title={ordemData === 'asc' ? 'Ordenação ascendente (1ª à última compra do ciclo). Clique para inverter.' : 'Ordenação descendente (última compra primeiro). Clique para inverter.'}
                className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] text-xs font-medium text-[var(--color-text)] hover:bg-[var(--color-bg)] transition shrink-0"
              >
                <ArrowUpDown className="h-3.5 w-3.5 text-[var(--color-muted)]" />
                <span>{ordemData === 'asc' ? '1ª → Última' : 'Última → 1ª'}</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              {selectedIds.length > 0 && onExcluirLote && (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`Deseja excluir as ${selectedIds.length} transações selecionadas desta fatura?`)) {
                      onExcluirLote(selectedIds)
                      setSelectedIds([])
                    }
                  }}
                  className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] border border-rose-300 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition"
                >
                  <Trash2 className="h-3 w-3" />
                  Excluir ({selectedIds.length})
                </button>
              )}

              {onQuitarFatura && (
                <button
                  type="button"
                  disabled={loadingAcao}
                  onClick={handleQuitarClick}
                  className={`inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] px-3 py-1 text-xs font-semibold shadow-xs transition ${
                    isQuitada
                      ? 'border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  }`}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {isQuitada ? 'Reabrir Fatura' : 'Quitar Fatura Completa'}
                </button>
              )}
            </div>
          </div>

          {/* Lista de Compras da Fatura */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-[var(--color-muted)] mb-2">
              <label className="flex items-center gap-2 cursor-pointer font-medium hover:text-[var(--color-text)]">
                <input
                  type="checkbox"
                  checked={itensFiltrados.length > 0 && selectedIds.length === itensFiltrados.length}
                  onChange={handleToggleSelectAll}
                  className="rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)] h-3.5 w-3.5"
                />
                <span>Selecionar todos ({itensFiltrados.length})</span>
              </label>
              <span>{itensFiltrados.length} compra(s) encontrada(s)</span>
            </div>

            {itensFiltrados.length === 0 ? (
              <div className="py-12 text-center text-sm text-[var(--color-muted)]">
                Nenhum lançamento encontrado para os filtros selecionados.
              </div>
            ) : (
              <div className="space-y-1.5">
                {itensFiltrados.map((item) => {
                  const valor = parseFloat(item.valor_parcela || item.valor || '0')
                  const isEstorno = valor < 0 || item.tipo === 'Receita'
                  const isSelected = selectedIds.includes(item.id)

                  return (
                    <div
                      key={item.id}
                      className={`group flex items-center justify-between gap-3 p-3 rounded-[var(--radius-md)] border transition-all ${
                        isSelected
                          ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5'
                          : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-primary)]/50 hover:shadow-xs'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(item.id)}
                          className="rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)] h-3.5 w-3.5 shrink-0"
                        />
                        <div className="min-w-0 flex-1 flex items-start gap-2.5">
                          <MerchantAvatar
                            descricao={item.descricao}
                            estabelecimentoNome={item.estabelecimento_nome}
                            logoUrl={item.logo_url}
                            categoriaNome={item.categoria_nome}
                            size="md"
                            className="mt-0.5"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-sm text-[var(--color-text)] truncate">
                                {item.descricao}
                              </span>
                            {isEstorno && (
                              <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                                <ArrowDownRight className="h-2.5 w-2.5" /> Estorno
                              </span>
                            )}
                            {item.parcelado && item.total_parcelas && (
                              <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-medium text-sky-800">
                                Parc. {item.parcela_atual}/{item.total_parcelas}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-[var(--color-muted)] mt-0.5">
                            <span>{item.data_transacao}</span>
                            <span>·</span>
                            <span className="inline-flex items-center gap-1 font-medium text-[var(--color-text)]">
                              <Tag className="h-2.5 w-2.5 text-teal-600" />
                              {item.categoria_nome || 'Sem Categoria'}
                            </span>
                            <span>·</span>
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                item.status === 'Pago'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {item.status}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <p className={`text-sm font-bold ${isEstorno ? 'text-emerald-700' : 'text-[var(--color-text)]'}`}>
                            {isEstorno ? `- ${formatCurrency(Math.abs(valor))}` : formatCurrency(valor)}
                          </p>
                        </div>

                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {onEditarTransacao && (
                            <button
                              type="button"
                              onClick={() => {
                                onEditarTransacao(item)
                                onClose()
                              }}
                              className="rounded p-1 text-[var(--color-muted)] hover:bg-[var(--color-border)]/50 hover:text-[var(--color-text)]"
                              title="Editar lançamento"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {onExcluirTransacao && (
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm(`Excluir ${item.descricao}?`)) {
                                  onExcluirTransacao(item.id)
                                }
                              }}
                              className="rounded p-1 text-rose-500 hover:bg-rose-50"
                              title="Excluir lançamento"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Footer da Gaveta */}
          <div className="px-6 py-4 border-t border-[var(--color-border)] bg-[var(--color-bg)]/40 flex items-center justify-between">
            <div>
              {isQuitada ? (
                <>
                  <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Total da Fatura (Quitada)
                  </span>
                  <p className="text-xl font-bold text-[var(--color-text)]">{formatCurrency(fatura.total)}</p>
                  <span className="text-[11px] text-[var(--color-muted)]">
                    Total pago: {formatCurrency(fatura.total_pagas > 0 ? fatura.total_pagas : fatura.total)} · Sem pendências
                  </span>
                </>
              ) : isParcial ? (
                <>
                  <span className="text-xs text-amber-700 font-semibold">Saldo Restante a Pagar</span>
                  <p className="text-xl font-bold text-amber-800">{formatCurrency(fatura.total_pendentes)}</p>
                  <span className="text-[11px] text-[var(--color-muted)]">
                    Total da fatura: {formatCurrency(fatura.total)} (Já pago: {formatCurrency(fatura.total_pagas)})
                  </span>
                </>
              ) : (
                <>
                  <span className="text-xs text-[var(--color-muted)] font-medium">Valor Total a Pagar da Fatura</span>
                  <p className="text-xl font-bold text-[var(--color-text)]">
                    {formatCurrency(fatura.total_pendentes > 0 ? fatura.total_pendentes : fatura.total)}
                  </p>
                  <span className="text-[11px] text-[var(--color-muted)]">
                    Vencimento do Boleto: {fatura.data_vencimento_label}
                  </span>
                </>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-xs font-semibold text-[var(--color-text)] hover:bg-[var(--color-border)]/30 transition"
              >
                Fechar
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
