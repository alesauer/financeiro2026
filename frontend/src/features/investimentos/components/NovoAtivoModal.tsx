import { useEffect, useState, type FormEvent } from 'react'
import { X, Plus, Landmark, Briefcase } from 'lucide-react'
import type {
  InvestmentAsset,
  InvestmentAssetPayload,
  InvestmentAssetType,
  InvestmentWallet,
} from '@/shared/types/investimento'

interface NovoAtivoModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (payload: InvestmentAssetPayload, editId?: number) => Promise<void>
  wallets: InvestmentWallet[]
  initialWalletId: number | null
  initialType?: string
  assetToEdit?: InvestmentAsset | null
}

const ALL_ASSET_TYPES: { type: InvestmentAssetType; label: string; macro: 'RV' | 'RF' }[] = [
  { type: 'Ações', label: 'Ações (B3 / Mercado à Vista)', macro: 'RV' },
  { type: 'FIIs', label: 'Fundos Imobiliários (FIIs)', macro: 'RV' },
  { type: 'ETFs', label: 'ETFs (Índices)', macro: 'RV' },
  { type: 'BDRs', label: 'BDRs (Mercado Internacional)', macro: 'RV' },
  { type: 'Criptomoedas', label: 'Criptomoedas', macro: 'RV' },
  { type: 'Tesouro Direto', label: 'Tesouro Direto (Selic, IPCA+, Prefixado)', macro: 'RF' },
  { type: 'CDB', label: 'CDB (Certificado de Depósito Bancário)', macro: 'RF' },
  { type: 'LCI', label: 'LCI (Isento de IR)', macro: 'RF' },
  { type: 'LCA', label: 'LCA (Isento de IR)', macro: 'RF' },
  { type: 'Debêntures', label: 'Debêntures / Títulos Privados', macro: 'RF' },
  { type: 'Fundos', label: 'Fundos de Investimento', macro: 'RF' },
  { type: 'Previdência', label: 'Previdência Privada (PGBL / VGBL)', macro: 'RF' },
]

export function NovoAtivoModal({
  isOpen,
  onClose,
  onSave,
  wallets,
  initialWalletId,
  initialType,
  assetToEdit,
}: NovoAtivoModalProps) {
  const [walletId, setWalletId] = useState<number>(initialWalletId || (wallets[0]?.id ?? 0))
  const [tipo, setTipo] = useState<InvestmentAssetType>('Ações')
  const [codigo, setCodigo] = useState<string>('')
  const [nome, setNome] = useState<string>('')
  const [setor, setSetor] = useState<string>('')
  const [bolsa, setBolsa] = useState<string>('B3')
  const [moeda, setMoeda] = useState<string>('BRL')
  const [loading, setLoading] = useState<boolean>(false)

  useEffect(() => {
    if (assetToEdit) {
      setWalletId(assetToEdit.wallet_id)
      setTipo(assetToEdit.tipo)
      setCodigo(assetToEdit.codigo)
      setNome(assetToEdit.nome)
      setSetor(assetToEdit.setor ?? '')
      setBolsa(assetToEdit.bolsa ?? 'B3')
      setMoeda(assetToEdit.moeda ?? 'BRL')
    } else {
      setWalletId(initialWalletId || (wallets[0]?.id ?? 0))
      setTipo((initialType as InvestmentAssetType) || 'Ações')
      setCodigo('')
      setNome('')
      setSetor('')
      setBolsa('B3')
      setMoeda('BRL')
    }
  }, [assetToEdit, initialWalletId, initialType, wallets, isOpen])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!walletId || !codigo.trim() || !nome.trim()) return

    setLoading(true)
    try {
      const payload: InvestmentAssetPayload = {
        wallet_id: walletId,
        codigo: codigo.trim().toUpperCase(),
        nome: nome.trim(),
        tipo,
        setor: setor.trim() || null,
        bolsa: bolsa.trim() || null,
        moeda: moeda.trim() || 'BRL',
        ativo: true,
      }

      await onSave(payload, assetToEdit?.id)
      onClose()
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  const isRendaFixa = ['Tesouro Direto', 'CDB', 'LCI', 'LCA', 'Debêntures', 'Fundos', 'Previdência'].includes(tipo)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4 bg-[var(--color-bg)]/40">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
              {isRendaFixa ? <Landmark className="h-5 w-5" /> : <Briefcase className="h-5 w-5" />}
            </div>
            <div>
              <h3 className="text-base font-bold text-[var(--color-text)]">
                {assetToEdit ? 'Editar Ativo' : 'Cadastrar Ativo / Título'}
              </h3>
              <p className="text-xs text-[var(--color-muted)]">
                Renda Fixa ou Renda Variável para a sua carteira
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
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Carteira */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-[var(--color-muted)]">
              Carteira de Destino *
            </label>
            <select
              required
              value={walletId}
              onChange={(e) => setWalletId(Number(e.target.value))}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs font-medium text-[var(--color-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
            >
              {wallets.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.nome} ({w.moeda})
                </option>
              ))}
            </select>
          </div>

          {/* Tipo de Ativo */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-[var(--color-muted)]">
              Tipo do Ativo *
            </label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as InvestmentAssetType)}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs font-medium text-[var(--color-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
            >
              <optgroup label="Renda Variável">
                {ALL_ASSET_TYPES.filter((t) => t.macro === 'RV').map((t) => (
                  <option key={t.type} value={t.type}>
                    {t.label}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Renda Fixa">
                {ALL_ASSET_TYPES.filter((t) => t.macro === 'RF').map((t) => (
                  <option key={t.type} value={t.type}>
                    {t.label}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* Código e Nome */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-[var(--color-muted)]">
                {isRendaFixa ? 'Código / Título *' : 'Ticker / Código *'}
              </label>
              <input
                required
                type="text"
                placeholder={isRendaFixa ? 'Ex: CDB INTER 110%' : 'Ex: PETR4'}
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs font-semibold uppercase text-[var(--color-text)] placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-[var(--color-muted)]">
                Nome Descritivo *
              </label>
              <input
                required
                type="text"
                placeholder={isRendaFixa ? 'Ex: Banco Inter Liquidez Diária' : 'Ex: Petrobras PN'}
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs text-[var(--color-text)] placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
              />
            </div>
          </div>

          {/* Setor e Bolsa */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-[var(--color-muted)]">
                {isRendaFixa ? 'Emissor / Indexador' : 'Setor de Atuação'}
              </label>
              <input
                type="text"
                placeholder={isRendaFixa ? 'Ex: 110% CDI ou IPCA + 6%' : 'Ex: Energia, Financeiro'}
                value={setor}
                onChange={(e) => setSetor(e.target.value)}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs text-[var(--color-text)] placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-[var(--color-muted)]">
                Bolsa / Mercado
              </label>
              <input
                type="text"
                placeholder="B3, Balcão, etc."
                value={bolsa}
                onChange={(e) => setBolsa(e.target.value)}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs text-[var(--color-text)] placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
              />
            </div>
          </div>

          {/* Footer Buttons */}
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
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-5 py-2 text-xs font-semibold text-white shadow-xs transition hover:opacity-90 disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{loading ? 'Salvando…' : assetToEdit ? 'Atualizar Ativo' : 'Adicionar Ativo'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
