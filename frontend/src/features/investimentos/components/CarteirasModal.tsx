import { useState, type FormEvent } from 'react'
import { X, Plus, Pencil, Trash2, Wallet } from 'lucide-react'
import type {
  InvestmentWallet,
  InvestmentWalletPayload,
} from '@/shared/types/investimento'

interface CarteirasModalProps {
  isOpen: boolean
  onClose: () => void
  wallets: InvestmentWallet[]
  onSaveWallet: (payload: InvestmentWalletPayload, editId?: number) => Promise<void>
  onDeleteWallet: (walletId: number) => Promise<void>
}

const DEFAULT_COLORS = [
  '#2563eb', // Azul
  '#7c3aed', // Roxo
  '#059669', // Esmeralda
  '#0284c7', // Sky
  '#d97706', // Âmbar
  '#e11d48', // Rose
  '#475569', // Slate
]

export function CarteirasModal({
  isOpen,
  onClose,
  wallets,
  onSaveWallet,
  onDeleteWallet,
}: CarteirasModalProps) {
  const [editingWallet, setEditingWallet] = useState<InvestmentWallet | null>(null)
  const [nome, setNome] = useState<string>('')
  const [cor, setCor] = useState<string>('#2563eb')
  const [moeda, setMoeda] = useState<string>('BRL')
  const [observacoes, setObservacoes] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(false)

  const handleStartEdit = (w: InvestmentWallet) => {
    setEditingWallet(w)
    setNome(w.nome)
    setCor(w.cor || '#2563eb')
    setMoeda(w.moeda || 'BRL')
    setObservacoes(w.observacoes || '')
  }

  const handleCancelEdit = () => {
    setEditingWallet(null)
    setNome('')
    setCor('#2563eb')
    setMoeda('BRL')
    setObservacoes('')
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!nome.trim()) return

    setLoading(true)
    try {
      const payload: InvestmentWalletPayload = {
        nome: nome.trim(),
        cor,
        moeda: moeda.trim() || 'BRL',
        observacoes: observacoes.trim() || null,
        ativo: true,
      }
      await onSaveWallet(payload, editingWallet?.id)
      handleCancelEdit()
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
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[var(--color-text)]">
                Gerenciar Carteiras
              </h3>
              <p className="text-xs text-[var(--color-muted)]">
                Organize seus investimentos em carteiras individuais ou conjuntas
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

        <div className="p-5 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Formulário (Criar / Editar) */}
          <form
            onSubmit={handleSubmit}
            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]/40 p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text)]">
                {editingWallet ? `Editar: ${editingWallet.nome}` : 'Adicionar Nova Carteira'}
              </h4>
              {editingWallet && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="text-xs text-[var(--color-muted)] hover:underline"
                >
                  Cancelar edição
                </button>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-[var(--color-muted)]">
                  Nome da Carteira *
                </label>
                <input
                  required
                  type="text"
                  placeholder="Ex: Carteira Principal, Longo Prazo"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs text-[var(--color-text)] placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-[var(--color-muted)]">
                  Moeda Principal
                </label>
                <input
                  type="text"
                  placeholder="BRL, USD"
                  value={moeda}
                  onChange={(e) => setMoeda(e.target.value)}
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs text-[var(--color-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                />
              </div>
            </div>

            {/* Seletor de Cores */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-[var(--color-muted)]">
                Cor de Destaque
              </label>
              <div className="flex items-center gap-2">
                {DEFAULT_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCor(c)}
                    className={`h-6 w-6 rounded-full transition-transform ${
                      cor === c ? 'scale-125 ring-2 ring-offset-2 ring-[var(--color-primary)]' : 'hover:scale-110'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
                <input
                  type="color"
                  value={cor}
                  onChange={(e) => setCor(e.target.value)}
                  className="h-6 w-6 cursor-pointer rounded-full border-0 bg-transparent p-0"
                  title="Cor personalizada"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-[var(--color-muted)]">
                Observações (opcional)
              </label>
              <input
                type="text"
                placeholder="Ex: Foco em dividendos e renda passiva"
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs text-[var(--color-text)] placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
              />
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-4 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:opacity-90 disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>{loading ? 'Salvando…' : editingWallet ? 'Salvar Carteira' : 'Criar Carteira'}</span>
              </button>
            </div>
          </form>

          {/* Lista de Carteiras Existentes */}
          <div>
            <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--color-muted)]">
              Carteiras Cadastradas ({wallets.length})
            </h4>

            {wallets.length === 0 ? (
              <p className="text-xs text-[var(--color-muted)]">Nenhuma carteira cadastrada.</p>
            ) : (
              <div className="space-y-2">
                {wallets.map((w) => (
                  <div
                    key={w.id}
                    className="flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className="h-3.5 w-3.5 shrink-0 rounded-full"
                        style={{ backgroundColor: w.cor || '#2563eb' }}
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-[var(--color-text)]">
                            {w.nome}
                          </span>
                          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-muted)] dark:bg-gray-800">
                            {w.moeda}
                          </span>
                        </div>
                        {w.observacoes && (
                          <p className="truncate text-xs text-[var(--color-muted)]">
                            {w.observacoes}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(w)}
                        title="Editar Carteira"
                        className="rounded-lg p-1.5 text-[var(--color-muted)] hover:bg-gray-100 hover:text-[var(--color-text)] dark:hover:bg-gray-800"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteWallet(w.id)}
                        title="Excluir Carteira"
                        className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
