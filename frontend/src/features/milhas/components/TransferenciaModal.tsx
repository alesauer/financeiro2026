import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import type { TransferenciaPayload, MilhaProgramaResumo } from '@/shared/types/milha'
import { PROGRAMAS_POPULARES, obterMetaPrograma } from '../utils/programasConfig'
import { isoToday } from '@/shared/utils/date'
import { X, ArrowRight, ArrowRightLeft, Sparkles } from 'lucide-react'

type Props = {
  isOpen: boolean
  programasDisponiveis: MilhaProgramaResumo[]
  initialOrigem?: string
  onClose: () => void
  onTransferir: (payload: TransferenciaPayload) => Promise<void>
}

const BONUS_PRESETS = [0, 50, 70, 80, 100, 120]

export function TransferenciaModal({
  isOpen,
  programasDisponiveis,
  initialOrigem,
  onClose,
  onTransferir,
}: Props) {
  const [programaOrigem, setProgramaOrigem] = useState<string>('Livelo')
  const [programaDestino, setProgramaDestino] = useState<string>('Smiles')
  const [quantidade, setQuantidade] = useState<number>(10000)
  const [taxaBonus, setTaxaBonus] = useState<number>(80)
  const [custoReais, setCustoReais] = useState<string>('')
  const [dataMovimentacao, setDataMovimentacao] = useState<string>(isoToday())
  const [dataExpiracao, setDataExpiracao] = useState<string>('')
  const [observacao, setObservacao] = useState<string>('')
  const [transferindo, setTransferindo] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (initialOrigem) {
      setProgramaOrigem(initialOrigem)
      if (initialOrigem.toLowerCase() === 'livelo' || initialOrigem.toLowerCase() === 'esfera') {
        setProgramaDestino('Smiles')
      } else {
        setProgramaDestino('LATAM Pass')
      }
    }
    const d = new Date()
    d.setFullYear(d.getFullYear() + 2)
    setDataExpiracao(d.toISOString().slice(0, 10))
    setErro(null)
  }, [initialOrigem, isOpen])

  if (!isOpen) return null

  const saldoOrigem =
    programasDisponiveis.find(
      (p) => p.nome.toLowerCase() === programaOrigem.toLowerCase()
    )?.saldo ?? 0

  const metaOrigem = obterMetaPrograma(programaOrigem)
  const metaDestino = obterMetaPrograma(programaDestino)

  const qtdBonus = Math.round(quantidade * (taxaBonus / 100.0))
  const qtdTotalDestino = quantidade + qtdBonus
  const custoNum = parseFloat(custoReais.replace(',', '.'))

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!programaOrigem || !programaDestino) {
      setErro('Selecione os programas de origem e destino.')
      return
    }
    if (programaOrigem.toLowerCase() === programaDestino.toLowerCase()) {
      setErro('O programa de origem e o de destino não podem ser iguais.')
      return
    }
    if (quantidade <= 0) {
      setErro('A quantidade de pontos a transferir deve ser maior que zero.')
      return
    }

    setTransferindo(true)
    setErro(null)

    try {
      const payload: TransferenciaPayload = {
        programa_origem: programaOrigem,
        programa_destino: programaDestino,
        quantidade,
        taxa_bonus: taxaBonus,
        data_movimentacao: dataMovimentacao || null,
        data_expiracao: dataExpiracao || null,
        custo_reais: !isNaN(custoNum) && custoNum > 0 ? custoNum : null,
        observacao: observacao.trim() || null,
      }

      await onTransferir(payload)
      onClose()
    } catch (err: any) {
      setErro(err?.message || 'Erro ao realizar transferência bonificada.')
    } finally {
      setTransferindo(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
              <ArrowRightLeft className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[var(--color-text)]">
                Transferência Bonificada
              </h3>
              <p className="text-xs text-[var(--color-muted)]">
                Transfira pontos entre programas com cálculo automático de bônus.
              </p>
            </div>
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
          {/* Seletor de Origem e Destino com Card Visual */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {/* Origem */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-1">
                De (Origem)
              </label>
              <select
                value={programaOrigem}
                onChange={(e) => setProgramaOrigem(e.target.value)}
                className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-xs font-medium text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-hidden"
              >
                {Object.keys(PROGRAMAS_POPULARES).map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-[11px] text-[var(--color-muted)]">
                Saldo disponível: {saldoOrigem.toLocaleString('pt-BR')} pts
              </span>
            </div>

            {/* Destino */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-1">
                Para (Destino)
              </label>
              <select
                value={programaDestino}
                onChange={(e) => setProgramaDestino(e.target.value)}
                className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-xs font-medium text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-hidden"
              >
                {Object.keys(PROGRAMAS_POPULARES).map((p) => (
                  <option key={p} value={p} disabled={p === programaOrigem}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Quantidade a Transferir */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                Quantidade de Pontos (Origem)
              </label>
              <div className="flex items-center gap-1">
                {[5000, 10000, 20000, 50000].map((step) => (
                  <button
                    key={step}
                    type="button"
                    onClick={() => setQuantidade((prev) => (prev || 0) + step)}
                    className="rounded bg-[var(--color-bg)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-muted)] hover:bg-[var(--color-primary)] hover:text-white"
                  >
                    +{step / 1000}k
                  </button>
                ))}
              </div>
            </div>
            <input
              type="number"
              min={1}
              required
              value={quantidade || ''}
              onChange={(e) => setQuantidade(parseInt(e.target.value) || 0)}
              className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm font-bold text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-hidden"
            />
          </div>

          {/* Bônus da Promoção */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                Bônus Promocional (%)
              </label>
              <div className="flex items-center gap-1">
                {BONUS_PRESETS.map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setTaxaBonus(b)}
                    className={`rounded px-1.5 py-0.5 text-[10px] font-semibold transition ${
                      taxaBonus === b
                        ? 'bg-[var(--color-primary)] text-white'
                        : 'bg-[var(--color-bg)] text-[var(--color-muted)] hover:text-[var(--color-text)]'
                    }`}
                  >
                    {b === 0 ? 'Sem bônus' : `+${b}%`}
                  </button>
                ))}
              </div>
            </div>
            <div className="relative">
              <input
                type="number"
                min={0}
                max={500}
                value={taxaBonus}
                onChange={(e) => setTaxaBonus(parseFloat(e.target.value) || 0)}
                className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-xs font-bold text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-hidden"
              />
              <span className="absolute right-3 top-2 text-xs font-semibold text-[var(--color-muted)]">
                %
              </span>
            </div>
          </div>

          {/* CARD DE SIMULAÇÃO VISUAL */}
          <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)]/80 p-3.5 shadow-2xs">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--color-text)]">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              Resultado da Transferência
            </div>
            <div className="mt-2.5 flex items-center justify-between gap-2 text-xs">
              <div className="text-left">
                <span className="text-[10px] text-[var(--color-muted)] flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: metaOrigem.corPrimaria }} />
                  Saída ({programaOrigem}):
                </span>
                <span className="font-bold text-rose-600 dark:text-rose-400">
                  -{quantidade.toLocaleString('pt-BR')} pts
                </span>
              </div>
              <ArrowRight className="h-4 w-4 text-[var(--color-muted)] shrink-0" />
              <div className="text-right">
                <span className="text-[10px] text-[var(--color-muted)] flex items-center justify-end gap-1">
                  <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: metaDestino.corPrimaria }} />
                  Entrada ({programaDestino}) {taxaBonus > 0 && `(+${taxaBonus}% bônus)`}:
                </span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                  +{qtdTotalDestino.toLocaleString('pt-BR')} pts
                </span>
              </div>
            </div>
            {taxaBonus > 0 && (
              <span className="mt-2 block text-center text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                🎉 Você ganha <strong>{qtdBonus.toLocaleString('pt-BR')} pontos extras</strong> nesta transferência!
              </span>
            )}
          </div>

          {/* Custo adicional & Datas */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-1">
                Data da Transferência
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
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-1">
                Validade no Destino
              </label>
              <input
                type="date"
                value={dataExpiracao}
                onChange={(e) => setDataExpiracao(e.target.value)}
                className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-xs text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-hidden"
              />
            </div>
          </div>

          {/* Custo adicional e Observações */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-1">
                Custo Adicional (R$) <span className="font-normal lowercase">(opcional)</span>
              </label>
              <input
                type="text"
                placeholder="Ex: 150,00 (taxa ou compra)"
                value={custoReais}
                onChange={(e) => setCustoReais(e.target.value)}
                className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-xs text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-1">
                Observação da Promoção <span className="font-normal lowercase">(opcional)</span>
              </label>
              <input
                type="text"
                placeholder="Ex: Promoção Smiles 80% Clube"
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-xs text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-hidden"
              />
            </div>
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
              disabled={transferindo}
              className="flex items-center gap-1.5 rounded-[var(--radius-sm)] bg-[var(--color-primary)] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:opacity-90 disabled:opacity-50"
            >
              <ArrowRightLeft className="h-3.5 w-3.5" />
              {transferindo ? 'Processando...' : 'Confirmar Transferência'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
