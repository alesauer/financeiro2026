import { useState } from 'react'
import { PROGRAMAS_POPULARES, obterMetaPrograma } from '../utils/programasConfig'
import { formatCurrency } from '@/shared/utils/date'
import { X, Calculator, CheckCircle2, AlertCircle } from 'lucide-react'

type Props = {
  isOpen: boolean
  onClose: () => void
}

type TabMode = 'cpm' | 'passagem' | 'cotacoes'

export function CpmCalculadoraModal({ isOpen, onClose }: Props) {
  const [tab, setTab] = useState<TabMode>('cpm')

  // 1. Calculadora CPM
  const [programaCpm, setProgramaCpm] = useState<string>('Livelo')
  const [valorPago, setValorPago] = useState<string>('350')
  const [pontosRecebidos, setPontosRecebidos] = useState<string>('10000')

  // 2. Comparador de Passagem
  const [precoDinheiro, setPrecoDinheiro] = useState<string>('1200')
  const [milhasPassagem, setMilhasPassagem] = useState<string>('45000')
  const [taxaEmbarque, setTaxaEmbarque] = useState<string>('75')
  const [programaPassagem, setProgramaPassagem] = useState<string>('Smiles')

  if (!isOpen) return null

  // Cálculos CPM
  const vPago = parseFloat(valorPago.replace(',', '.')) || 0
  const qPontos = parseFloat(pontosRecebidos.replace(',', '.')) || 0
  const cpmCalculado = qPontos > 0 ? (vPago / (qPontos / 1000.0)) : 0

  const metaCpm = obterMetaPrograma(programaCpm)
  let avaliacaoCpm = { texto: 'Excelente oportunidade', cor: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300' }
  if (cpmCalculado > metaCpm.cpmPadrao * 1.2) {
    avaliacaoCpm = { texto: 'Preço acima da média de mercado', cor: 'text-rose-600 bg-rose-50 dark:bg-rose-950/40 dark:text-rose-300' }
  } else if (cpmCalculado > metaCpm.cpmPadrao * 0.95) {
    avaliacaoCpm = { texto: 'Dentro da média de mercado', cor: 'text-amber-600 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300' }
  }

  // Cálculos Passagem
  const pDinheiro = parseFloat(precoDinheiro.replace(',', '.')) || 0
  const mPassagem = parseFloat(milhasPassagem.replace(',', '.')) || 0
  const tEmbarque = parseFloat(taxaEmbarque.replace(',', '.')) || 0
  const economiaReal = pDinheiro - tEmbarque
  const cpmPassagem = mPassagem > 0 && economiaReal > 0 ? (economiaReal / (mPassagem / 1000.0)) : 0
  const metaPassagem = obterMetaPrograma(programaPassagem)
  const valePenaMilhas = cpmPassagem >= metaPassagem.cpmPadrao

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:bg-amber-400/20 dark:text-amber-300">
              <Calculator className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[var(--color-text)]">
                Calculadora & Ferramentas de Milhas
              </h3>
              <p className="text-xs text-[var(--color-muted)]">
                Avalie o custo do milheiro e simule emissões vantajosas.
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

        {/* Tabs */}
        <div className="mt-4 flex rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] p-1 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setTab('cpm')}
            className={`flex-1 rounded py-1.5 transition ${
              tab === 'cpm'
                ? 'bg-[var(--color-surface)] text-[var(--color-text)] shadow-xs'
                : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            Custo do Milheiro (CPM)
          </button>
          <button
            type="button"
            onClick={() => setTab('passagem')}
            className={`flex-1 rounded py-1.5 transition ${
              tab === 'passagem'
                ? 'bg-[var(--color-surface)] text-[var(--color-text)] shadow-xs'
                : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            Milhas vs Dinheiro
          </button>
          <button
            type="button"
            onClick={() => setTab('cotacoes')}
            className={`flex-1 rounded py-1.5 transition ${
              tab === 'cotacoes'
                ? 'bg-[var(--color-surface)] text-[var(--color-text)] shadow-xs'
                : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            Cotações Médias
          </button>
        </div>

        {/* Tab 1: CPM */}
        {tab === 'cpm' && (
          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-1">
                Programa
              </label>
              <select
                value={programaCpm}
                onChange={(e) => setProgramaCpm(e.target.value)}
                className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-xs text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-hidden"
              >
                {Object.keys(PROGRAMAS_POPULARES).map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-1">
                  Valor Total Pago (R$)
                </label>
                <input
                  type="text"
                  value={valorPago}
                  onChange={(e) => setValorPago(e.target.value)}
                  className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-xs font-semibold text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-1">
                  Pontos Recebidos
                </label>
                <input
                  type="text"
                  value={pontosRecebidos}
                  onChange={(e) => setPontosRecebidos(e.target.value)}
                  className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-xs font-semibold text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-hidden"
                />
              </div>
            </div>

            {/* Resultado CPM */}
            <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)]/40 p-4 text-center">
              <span className="text-xs text-[var(--color-muted)] block">
                Custo Efetivo por Milheiro (1.000 pontos)
              </span>
              <span className="text-3xl font-extrabold text-[var(--color-text)] mt-1 block">
                {formatCurrency(cpmCalculado)}
              </span>
              <span className="text-xs text-[var(--color-muted)] block mt-1">
                Referência de mercado {programaCpm}: ≈ {formatCurrency(metaCpm.cpmPadrao)}
              </span>

              <div className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${avaliacaoCpm.cor}`}>
                <CheckCircle2 className="h-3.5 w-3.5" />
                {avaliacaoCpm.texto}
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Passagem (Milhas vs Dinheiro) */}
        {tab === 'passagem' && (
          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-1">
                Programa da Passagem
              </label>
              <select
                value={programaPassagem}
                onChange={(e) => setProgramaPassagem(e.target.value)}
                className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-xs text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-hidden"
              >
                {Object.keys(PROGRAMAS_POPULARES).map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-1">
                  Passagem em R$
                </label>
                <input
                  type="text"
                  value={precoDinheiro}
                  onChange={(e) => setPrecoDinheiro(e.target.value)}
                  className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-xs font-semibold text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-1">
                  Milhas Pedidas
                </label>
                <input
                  type="text"
                  value={milhasPassagem}
                  onChange={(e) => setMilhasPassagem(e.target.value)}
                  className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-xs font-semibold text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-1">
                  Taxas (R$)
                </label>
                <input
                  type="text"
                  value={taxaEmbarque}
                  onChange={(e) => setTaxaEmbarque(e.target.value)}
                  className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-xs font-semibold text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-hidden"
                />
              </div>
            </div>

            {/* Resultado Passagem */}
            <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)]/40 p-4 text-center">
              <span className="text-xs text-[var(--color-muted)] block">
                Valor gerado por milheiro nesta emissão
              </span>
              <span className="text-2xl font-bold text-[var(--color-text)] mt-1 block">
                {formatCurrency(cpmPassagem)} / milheiro
              </span>

              <div
                className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                  valePenaMilhas
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                }`}
              >
                {valePenaMilhas ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Vale a pena emitir com Milhas!
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-3.5 w-3.5" />
                    Mais vantajoso pagar no dinheiro
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Cotações Médias */}
        {tab === 'cotacoes' && (
          <div className="mt-4 space-y-2">
            <p className="text-xs text-[var(--color-muted)] mb-3">
              Valores médios de mercado por milheiro (1.000 pontos) usados para avaliação patrimonial e alertas.
            </p>
            <div className="divide-y divide-[var(--color-border)] max-h-60 overflow-y-auto rounded border border-[var(--color-border)]">
              {Object.entries(PROGRAMAS_POPULARES).map(([nome, meta]) => (
                <div key={nome} className="flex items-center justify-between p-2.5 text-xs">
                  <div className="flex items-center gap-2">
                    <span
                      className="flex h-6 w-6 items-center justify-center rounded text-[10px] font-bold"
                      style={{ backgroundColor: meta.bgLight, color: meta.textColor }}
                    >
                      {meta.sigla}
                    </span>
                    <span className="font-semibold text-[var(--color-text)]">{nome}</span>
                  </div>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    ≈ {formatCurrency(meta.cpmPadrao)} /k
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-6 flex justify-end border-t border-[var(--color-border)] pt-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-[var(--radius-sm)] bg-[var(--color-primary)] px-4 py-1.5 text-xs font-semibold text-white shadow-xs"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
