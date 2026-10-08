import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import type { Milha, MilhaPayload, MilhaTipo } from '@/shared/types/milha'
import { PROGRAMAS_POPULARES, CATEGORIAS_ORIGEM, obterMetaPrograma } from '../utils/programasConfig'
import { isoToday } from '@/shared/utils/date'
import { X } from 'lucide-react'

type Props = {
  isOpen: boolean
  editingItem: Milha | null
  initialPrograma?: string
  initialTipo?: MilhaTipo
  onClose: () => void
  onSave: (payload: MilhaPayload, id?: number) => Promise<void>
}

export function MilhaModalForm({
  isOpen,
  editingItem,
  initialPrograma,
  initialTipo = 'entrada',
  onClose,
  onSave,
}: Props) {
  const [programa, setPrograma] = useState('')
  const [customPrograma, setCustomPrograma] = useState('')
  const [tipo, setTipo] = useState<MilhaTipo>('entrada')
  const [quantidade, setQuantidade] = useState<number>(0)
  const [categoriaOrigem, setCategoriaOrigem] = useState<string>('Cartão de Crédito')
  const [custoReais, setCustoReais] = useState<string>('')
  const [dataMovimentacao, setDataMovimentacao] = useState<string>(isoToday())
  const [dataExpiracao, setDataExpiracao] = useState<string>('')
  const [descricao, setDescricao] = useState<string>('')
  const [origem, setOrigem] = useState<string>('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (editingItem) {
      const isPopular = Object.keys(PROGRAMAS_POPULARES).includes(editingItem.programa)
      setPrograma(isPopular ? editingItem.programa : 'Outro')
      setCustomPrograma(isPopular ? '' : editingItem.programa)
      setTipo(editingItem.tipo)
      setQuantidade(editingItem.quantidade)
      setCategoriaOrigem(editingItem.categoria_origem || (editingItem.tipo === 'entrada' ? 'Cartão de Crédito' : 'Resgate Passagem'))
      setCustoReais(editingItem.custo_reais ? String(editingItem.custo_reais) : '')
      setDataMovimentacao(editingItem.data_movimentacao || isoToday())
      setDataExpiracao(editingItem.data_expiracao || '')
      setDescricao(editingItem.descricao || '')
      setOrigem(editingItem.origem || '')
    } else {
      const defaultProg = initialPrograma || 'Smiles'
      const isPopular = Object.keys(PROGRAMAS_POPULARES).includes(defaultProg)
      setPrograma(isPopular ? defaultProg : 'Outro')
      setCustomPrograma(isPopular ? '' : defaultProg)
      setTipo(initialTipo)
      setQuantidade(0)
      setCategoriaOrigem(initialTipo === 'entrada' ? 'Cartão de Crédito' : 'Resgate Passagem')
      setCustoReais('')
      setDataMovimentacao(isoToday())
      setDataExpiracao('')
      setDescricao('')
      setOrigem('')
    }
    setErro(null)
  }, [editingItem, initialPrograma, initialTipo, isOpen])

  if (!isOpen) return null

  const programaFinal = programa === 'Outro' ? customPrograma.trim() : programa

  // Cálculo de CPM em tempo real
  const custoNum = parseFloat(custoReais.replace(',', '.'))
  const cpmCalculado =
    !isNaN(custoNum) && custoNum > 0 && quantidade > 0
      ? (custoNum / (quantidade / 1000.0)).toFixed(2)
      : null

  const handleAddQtd = (delta: number) => {
    setQuantidade((prev) => Math.max(0, (prev || 0) + delta))
  }

  const handleSetExpYears = (anos: number | null) => {
    if (anos === null) {
      setDataExpiracao('')
      return
    }
    const base = dataMovimentacao ? new Date(dataMovimentacao) : new Date()
    base.setFullYear(base.getFullYear() + anos)
    setDataExpiracao(base.toISOString().slice(0, 10))
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!programaFinal) {
      setErro('Selecione ou digite o nome do programa.')
      return
    }
    if (!quantidade || quantidade <= 0) {
      setErro('A quantidade de milhas deve ser maior que zero.')
      return
    }

    setSalvando(true)
    setErro(null)

    try {
      const payload: MilhaPayload = {
        programa: programaFinal,
        tipo,
        quantidade,
        categoria_origem: categoriaOrigem || null,
        custo_reais: !isNaN(custoNum) && custoNum > 0 ? custoNum : null,
        data_movimentacao: dataMovimentacao || null,
        data_expiracao: dataExpiracao || null,
        origem: origem.trim() || null,
        descricao: descricao.trim() || null,
      }

      await onSave(payload, editingItem?.id)
      onClose()
    } catch (err: any) {
      setErro(err?.message || 'Erro ao salvar movimentação.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
          <div>
            <h3 className="text-base font-semibold text-[var(--color-text)]">
              {editingItem ? 'Editar Movimentação' : 'Nova Movimentação de Milhas'}
            </h3>
            <p className="text-xs text-[var(--color-muted)]">
              Registre entradas, compras, resgates ou expirações.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-[var(--color-muted)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {erro && (
          <div className="mt-3 rounded bg-rose-50 p-2.5 text-xs font-medium text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
            {erro}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* 1. Tipo de Movimentação */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-1.5">
              Tipo de Movimentação
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTipo('entrada')}
                className={`rounded-[var(--radius-sm)] border py-2 text-xs font-semibold transition ${
                  tipo === 'entrada'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 ring-2 ring-emerald-500/20'
                    : 'border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-muted)] hover:text-[var(--color-text)]'
                }`}
              >
                + Entrada (Acúmulo)
              </button>
              <button
                type="button"
                onClick={() => setTipo('saida')}
                className={`rounded-[var(--radius-sm)] border py-2 text-xs font-semibold transition ${
                  tipo === 'saida'
                    ? 'border-rose-600 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 ring-2 ring-rose-500/20'
                    : 'border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-muted)] hover:text-[var(--color-text)]'
                }`}
              >
                - Saída (Resgate / Venda)
              </button>
            </div>
          </div>

          {/* 2. Programa */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-1.5">
              Programa de Fidelidade
            </label>
            <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
              {Object.keys(PROGRAMAS_POPULARES).map((pNome) => {
                const meta = obterMetaPrograma(pNome)
                const isSelected = programa === pNome
                return (
                  <button
                    key={pNome}
                    type="button"
                    onClick={() => setPrograma(pNome)}
                    className={`rounded-[var(--radius-sm)] border px-2 py-1.5 text-xs font-medium text-center transition truncate ${
                      isSelected
                        ? 'border-[var(--color-primary)] ring-2 ring-[var(--color-primary)]/20 font-semibold'
                        : 'border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] hover:border-[var(--color-border)]/80'
                    }`}
                    style={isSelected ? { backgroundColor: meta.bgLight, color: meta.textColor } : {}}
                  >
                    {pNome}
                  </button>
                )
              })}
              <button
                type="button"
                onClick={() => setPrograma('Outro')}
                className={`rounded-[var(--radius-sm)] border px-2 py-1.5 text-xs font-medium text-center transition ${
                  programa === 'Outro'
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 font-semibold text-[var(--color-primary)]'
                    : 'border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-muted)]'
                }`}
              >
                + Outro
              </button>
            </div>

            {programa === 'Outro' && (
              <input
                type="text"
                placeholder="Digite o nome do programa..."
                value={customPrograma}
                onChange={(e) => setCustomPrograma(e.target.value)}
                className="mt-2 w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-xs text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-hidden"
              />
            )}
          </div>

          {/* 3. Quantidade e Atalhos */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                Quantidade de Milhas / Pontos
              </label>
              <div className="flex items-center gap-1">
                {[1000, 5000, 10000, 50000].map((step) => (
                  <button
                    key={step}
                    type="button"
                    onClick={() => handleAddQtd(step)}
                    className="rounded bg-[var(--color-bg)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-muted)] hover:bg-[var(--color-primary)] hover:text-white"
                  >
                    +{step >= 1000 ? `${step / 1000}k` : step}
                  </button>
                ))}
              </div>
            </div>
            <input
              type="number"
              min={1}
              step={1}
              required
              placeholder="Ex: 10000"
              value={quantidade || ''}
              onChange={(e) => setQuantidade(parseInt(e.target.value) || 0)}
              className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm font-bold text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-hidden"
            />
          </div>

          {/* 4. Categoria & Custo em Reais (CPM) */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-1.5">
                Categoria de Origem / Destino
              </label>
              <select
                value={categoriaOrigem}
                onChange={(e) => setCategoriaOrigem(e.target.value)}
                className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-xs text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-hidden"
              >
                {CATEGORIAS_ORIGEM.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-1.5">
                Custo Total Pago (R$) <span className="font-normal lowercase">(opcional)</span>
              </label>
              <input
                type="text"
                placeholder="Ex: 350,00"
                value={custoReais}
                onChange={(e) => setCustoReais(e.target.value)}
                className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-xs text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-hidden"
              />
              {cpmCalculado && (
                <span className="mt-1 block text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                  CPM: R$ {cpmCalculado} / milheiro
                </span>
              )}
            </div>
          </div>

          {/* 5. Datas: Movimentação & Expiração */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-1.5">
                Data da Movimentação
              </label>
              <input
                type="date"
                required
                value={dataMovimentacao}
                onChange={(e) => setDataMovimentacao(e.target.value)}
                className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-xs text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-hidden"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                  Data de Expiração
                </label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleSetExpYears(null)}
                    className="text-[10px] text-[var(--color-muted)] hover:underline"
                  >
                    Nunca
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetExpYears(2)}
                    className="text-[10px] text-[var(--color-primary)] hover:underline font-medium"
                  >
                    +2 anos
                  </button>
                </div>
              </div>
              <input
                type="date"
                value={dataExpiracao}
                onChange={(e) => setDataExpiracao(e.target.value)}
                className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-xs text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-hidden"
              />
            </div>
          </div>

          {/* 6. Descrição / Detalhes */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-1.5">
              Descrição / Observações <span className="font-normal lowercase">(opcional)</span>
            </label>
            <input
              type="text"
              placeholder="Ex: Mensalidade Clube Smiles 1.000 / Compra Casas Bahia"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-xs text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-hidden"
            />
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-2 border-t border-[var(--color-border)] pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-4 py-2 text-xs font-semibold text-[var(--color-muted)] hover:text-[var(--color-text)]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvando}
              className="rounded-[var(--radius-sm)] bg-[var(--color-primary)] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:opacity-90 disabled:opacity-50"
            >
              {salvando ? 'Salvando...' : editingItem ? 'Salvar Alterações' : 'Adicionar Movimentação'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
