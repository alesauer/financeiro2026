import { useEffect, useState, type FormEvent } from 'react'
import { X, ArrowDownLeft, ArrowUpRight, Sparkles, DollarSign, Calculator } from 'lucide-react'
import type {
  InvestmentAsset,
  InvestmentTransaction,
  InvestmentTransactionPayload,
  InvestmentTransactionType,
  InvestmentWallet,
} from '@/shared/types/investimento'

interface OperacaoModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (payload: InvestmentTransactionPayload, editId?: number) => Promise<void>
  wallets: InvestmentWallet[]
  assets: InvestmentAsset[]
  initialWalletId: number | null
  initialAssetId?: number | null
  transactionToEdit?: InvestmentTransaction | null
}

const TX_TYPES: { type: InvestmentTransactionType; label: string; icon: any; color: string }[] = [
  { type: 'Compra', label: 'Compra', icon: ArrowDownLeft, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40' },
  { type: 'Venda', label: 'Venda', icon: ArrowUpRight, color: 'text-rose-600 bg-rose-50 dark:bg-rose-950/40' },
  { type: 'Dividendos', label: 'Dividendos', icon: Sparkles, color: 'text-purple-600 bg-purple-50 dark:bg-purple-950/40' },
  { type: 'JCP', label: 'JCP', icon: Sparkles, color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40' },
  { type: 'Aporte', label: 'Aporte', icon: DollarSign, color: 'text-sky-600 bg-sky-50 dark:bg-sky-950/40' },
  { type: 'Resgate', label: 'Resgate', icon: ArrowUpRight, color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/40' },
]

export function OperacaoModal({
  isOpen,
  onClose,
  onSave,
  wallets,
  assets,
  initialWalletId,
  initialAssetId,
  transactionToEdit,
}: OperacaoModalProps) {
  const [walletId, setWalletId] = useState<number>(initialWalletId || (wallets[0]?.id ?? 0))
  const [assetId, setAssetId] = useState<number | null>(initialAssetId || null)
  const [tipo, setTipo] = useState<InvestmentTransactionType>('Compra')
  const [dataMovimentacao, setDataMovimentacao] = useState<string>(
    new Date().toISOString().slice(0, 10)
  )
  const [quantidade, setQuantidade] = useState<string>('')
  const [preco, setPreco] = useState<string>('')
  const [taxas, setTaxas] = useState<string>('0')
  const [valorTotal, setValorTotal] = useState<string>('')
  const [corretora, setCorretora] = useState<string>('')
  const [observacoes, setObservacoes] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(false)

  // Sincronizar estado inicial ou edição
  useEffect(() => {
    if (transactionToEdit) {
      setWalletId(transactionToEdit.wallet_id)
      setAssetId(transactionToEdit.asset_id)
      setTipo(transactionToEdit.tipo)
      setDataMovimentacao(transactionToEdit.data_movimentacao.slice(0, 10))
      setQuantidade(transactionToEdit.quantidade ?? '')
      setPreco(transactionToEdit.preco ?? '')
      setTaxas(transactionToEdit.taxas ?? '0')
      setValorTotal(transactionToEdit.valor_total ?? '')
      setCorretora(transactionToEdit.corretora ?? '')
      setObservacoes(transactionToEdit.observacoes ?? '')
    } else {
      setWalletId(initialWalletId || (wallets[0]?.id ?? 0))
      setAssetId(initialAssetId || null)
      setTipo('Compra')
      setDataMovimentacao(new Date().toISOString().slice(0, 10))
      setQuantidade('')
      setPreco('')
      setTaxas('0')
      setValorTotal('')
      setCorretora('')
      setObservacoes('')
    }
  }, [transactionToEdit, initialWalletId, initialAssetId, wallets, isOpen])

  // Filtrar ativos pertencentes à carteira selecionada
  const assetsOfWallet = assets.filter((a) => !walletId || a.wallet_id === walletId)

  // Cálculo automático do total
  const recalcularTotal = (qtdStr: string, precoStr: string, taxasStr: string, currentTipo: InvestmentTransactionType) => {
    const q = parseFloat(qtdStr.replace(',', '.'))
    const p = parseFloat(precoStr.replace(',', '.'))
    const t = parseFloat(taxasStr.replace(',', '.')) || 0

    if (!isNaN(q) && !isNaN(p) && q > 0 && p > 0) {
      let tot = q * p
      if (currentTipo === 'Compra') {
        tot += t
      } else if (currentTipo === 'Venda') {
        tot = Math.max(0, tot - t)
      }
      setValorTotal(tot.toFixed(2))
    }
  }

  const handleQtdChange = (val: string) => {
    setQuantidade(val)
    recalcularTotal(val, preco, taxas, tipo)
  }

  const handlePrecoChange = (val: string) => {
    setPreco(val)
    recalcularTotal(quantidade, val, taxas, tipo)
  }

  const handleTaxasChange = (val: string) => {
    setTaxas(val)
    recalcularTotal(quantidade, preco, val, tipo)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!walletId) return

    setLoading(true)
    try {
      const payload: InvestmentTransactionPayload = {
        wallet_id: walletId,
        asset_id: assetId,
        tipo,
        data_movimentacao: dataMovimentacao,
        quantidade: quantidade.trim() ? quantidade.replace(',', '.') : null,
        preco: preco.trim() ? preco.replace(',', '.') : null,
        taxas: taxas.trim() ? taxas.replace(',', '.') : '0',
        valor_total: valorTotal.trim() ? valorTotal.replace(',', '.') : '0',
        corretora: corretora.trim() || null,
        observacoes: observacoes.trim() || null,
      }

      await onSave(payload, transactionToEdit?.id)
      onClose()
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-lg rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4 bg-[var(--color-bg)]/40">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
              <Calculator className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[var(--color-text)]">
                {transactionToEdit ? 'Editar Movimentação' : 'Registrar Nova Operação'}
              </h3>
              <p className="text-xs text-[var(--color-muted)]">
                Compra, venda, aportes ou proventos recebidos
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)] transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Seletor de Tipo de Operação */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider">
              Tipo de Operação
            </label>
            <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
              {TX_TYPES.map((t) => {
                const isSelected = tipo === t.type
                const Icon = t.icon
                return (
                  <button
                    key={t.type}
                    type="button"
                    onClick={() => {
                      setTipo(t.type)
                      recalcularTotal(quantidade, preco, taxas, t.type)
                    }}
                    className={`flex flex-col items-center justify-center rounded-xl border p-2 text-xs font-semibold transition-all ${
                      isSelected
                        ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)] shadow-xs'
                        : 'border-[var(--color-border)] bg-[var(--color-bg)]/50 text-[var(--color-muted)] hover:border-gray-300 hover:text-[var(--color-text)]'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5 mb-1" />
                    <span>{t.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Carteira e Ativo */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-[var(--color-muted)]">
                Carteira *
              </label>
              <select
                required
                value={walletId}
                onChange={(e) => {
                  const wid = Number(e.target.value)
                  setWalletId(wid)
                  setAssetId(null)
                }}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs font-medium text-[var(--color-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
              >
                {wallets.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.nome} ({w.moeda})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-[var(--color-muted)]">
                Ativo / Título
              </label>
              <select
                value={assetId ?? ''}
                onChange={(e) => setAssetId(e.target.value ? Number(e.target.value) : null)}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs font-medium text-[var(--color-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
              >
                <option value="">Sem ativo (Aporte/Resgate em conta)</option>
                {assetsOfWallet.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.codigo} — {a.nome} ({a.tipo})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Data e Corretora */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-[var(--color-muted)]">
                Data da Movimentação *
              </label>
              <input
                type="date"
                required
                value={dataMovimentacao}
                onChange={(e) => setDataMovimentacao(e.target.value)}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs text-[var(--color-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-[var(--color-muted)]">
                Corretora / Instituição
              </label>
              <input
                type="text"
                placeholder="Ex: XP, BTG, Inter, NuInvest"
                value={corretora}
                onChange={(e) => setCorretora(e.target.value)}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs text-[var(--color-text)] placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
              />
            </div>
          </div>

          {/* Quantidade, Preço Unitário e Taxas */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-[var(--color-muted)]">
                Quantidade
              </label>
              <input
                type="number"
                step="0.000001"
                placeholder="Ex: 100"
                value={quantidade}
                onChange={(e) => handleQtdChange(e.target.value)}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs text-[var(--color-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-[var(--color-muted)]">
                Preço Unitário (R$)
              </label>
              <input
                type="number"
                step="0.000001"
                placeholder="Ex: 34.50"
                value={preco}
                onChange={(e) => handlePrecoChange(e.target.value)}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs text-[var(--color-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-[var(--color-muted)]">
                Taxas / Custos (R$)
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="Ex: 4.90"
                value={taxas}
                onChange={(e) => handleTaxasChange(e.target.value)}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs text-[var(--color-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
              />
            </div>
          </div>

          {/* Valor Total da Operação */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-[var(--color-muted)]">
                Valor Total da Operação (R$) *
              </label>
              <span className="text-[11px] text-[var(--color-muted)]">
                Calculado: (Qtd × Preço) ± Taxas
              </span>
            </div>
            <input
              type="number"
              step="0.01"
              required
              placeholder="0,00"
              value={valorTotal}
              onChange={(e) => setValorTotal(e.target.value)}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 text-sm font-bold text-[var(--color-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
            />
          </div>

          {/* Observações */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-[var(--color-muted)]">
              Notas / Observações
            </label>
            <input
              type="text"
              placeholder="Ex: Aporte mensal recorrente, recompra de posição"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs text-[var(--color-text)] placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
            />
          </div>

          {/* Botões do Rodapé */}
          <div className="flex items-center justify-end gap-2.5 border-t border-[var(--color-border)] pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-xs font-semibold text-[var(--color-text)] transition hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-[var(--color-primary)] px-5 py-2 text-xs font-semibold text-white shadow-xs transition hover:opacity-90 disabled:opacity-50"
            >
              {loading ? 'Salvando…' : transactionToEdit ? 'Atualizar Operação' : 'Registrar Operação'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
