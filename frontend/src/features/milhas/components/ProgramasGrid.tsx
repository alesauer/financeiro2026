import type { MilhaProgramaResumo } from '@/shared/types/milha'
import { obterMetaPrograma, PROGRAMAS_POPULARES } from '../utils/programasConfig'
import { formatCurrency, formatDateBr } from '@/shared/utils/date'
import {
  Plus,
  Minus,
  ArrowRightLeft,
  Plane,
  Building2,
  Hotel,
  HelpCircle,
  AlertCircle,
  Award,
} from 'lucide-react'

type Props = {
  programas: MilhaProgramaResumo[]
  saldoTotal: number
  programaSelecionado: string | null
  onSelectPrograma: (nome: string | null) => void
  onNovaMovimentacao: (programa: string, tipo: 'entrada' | 'saida') => void
  onTransferir: (programaOrigem: string) => void
}

function renderTipoIcon(tipo: string) {
  switch (tipo) {
    case 'aereo':
      return <Plane className="h-3.5 w-3.5" />
    case 'bancario':
      return <Building2 className="h-3.5 w-3.5" />
    case 'hotel':
      return <Hotel className="h-3.5 w-3.5" />
    default:
      return <HelpCircle className="h-3.5 w-3.5" />
  }
}

export function ProgramasGrid({
  programas,
  saldoTotal,
  programaSelecionado,
  onSelectPrograma,
  onNovaMovimentacao,
  onTransferir,
}: Props) {
  if (programas.length === 0) {
    const programasIniciais = ['Smiles', 'Livelo', 'LATAM Pass', 'Azul Fidelidade', 'Esfera', 'C6 Átomos']

    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center shadow-xs">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
          <Award className="h-7 w-7" />
        </div>

        <h3 className="mt-4 text-base font-bold text-[var(--color-text)]">
          Nenhum programa de milhas cadastrado ainda
        </h3>
        <p className="mx-auto mt-1.5 max-w-lg text-xs leading-relaxed text-[var(--color-muted)]">
          Cadastre seu saldo e movimentações em programas aéreos, bancários ou de hotéis para acompanhar cotações em tempo real, transferências bonificadas e alertas de expiração.
        </p>

        {/* Ações Rápidas */}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
          <button
            type="button"
            onClick={() => onNovaMovimentacao('Smiles', 'entrada')}
            className="flex items-center gap-1.5 rounded-[var(--radius-sm)] bg-[var(--color-primary)] px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            Nova Movimentação
          </button>

          <button
            type="button"
            onClick={() => onTransferir('Livelo')}
            className="flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-xs font-semibold text-[var(--color-text)] shadow-xs transition hover:bg-[var(--color-bg)]"
          >
            <ArrowRightLeft className="h-4 w-4 text-[var(--color-primary)]" />
            Transferência Bonificada
          </button>
        </div>

        {/* Sugestões de Programas Populares */}
        <div className="mt-8 border-t border-[var(--color-border)] pt-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Ou comece adicionando pontos em um programa popular:
          </p>

          <div className="mt-3.5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-6">
            {programasIniciais.map((nome) => {
              const meta = PROGRAMAS_POPULARES[nome] || obterMetaPrograma(nome)
              return (
                <button
                  key={nome}
                  type="button"
                  onClick={() => onNovaMovimentacao(nome, 'entrada')}
                  className="group flex flex-col items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)]/60 p-3 transition hover:border-[var(--color-primary)] hover:bg-[var(--color-surface)] hover:shadow-xs"
                >
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-lg font-bold text-xs shadow-2xs"
                    style={{
                      backgroundColor: meta.bgLight,
                      color: meta.textColor,
                      border: `1px solid ${meta.corPrimaria}40`,
                    }}
                  >
                    {meta.sigla}
                  </div>
                  <span className="mt-2 text-xs font-semibold text-[var(--color-text)] group-hover:text-[var(--color-primary)]">
                    {nome}
                  </span>
                  <span className="text-[10px] text-[var(--color-muted)] mt-0.5">
                    ≈ {formatCurrency(meta.cpmPadrao)}/k
                  </span>
                  <span className="mt-2 inline-flex items-center gap-0.5 text-[10px] font-semibold text-[var(--color-primary)] opacity-0 group-hover:opacity-100 transition">
                    <Plus className="h-3 w-3" /> Adicionar
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          Programas de Fidelidade
        </h3>
        {programaSelecionado && (
          <button
            type="button"
            onClick={() => onSelectPrograma(null)}
            className="text-xs font-medium text-[var(--color-primary)] hover:underline"
          >
            Limpar filtro ({programaSelecionado})
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {programas.map((prog) => {
          const meta = obterMetaPrograma(prog.nome)
          const isSelected = programaSelecionado?.toLowerCase() === prog.nome.toLowerCase()
          const percentual = saldoTotal > 0 ? (prog.saldo / saldoTotal) * 100 : 0

          return (
            <div
              key={prog.nome}
              className={`group relative flex flex-col justify-between overflow-hidden rounded-[var(--radius-md)] border bg-[var(--color-surface)] p-4 shadow-sm transition hover:shadow-md ${
                isSelected
                  ? 'border-[var(--color-primary)] ring-2 ring-[var(--color-primary)]/20'
                  : 'border-[var(--color-border)] hover:border-[var(--color-border)]/80'
              }`}
            >
              {/* Top Accent Bar */}
              <div
                className="absolute top-0 left-0 right-0 h-1"
                style={{ backgroundColor: meta.corPrimaria }}
              />

              {/* Header: Logo / Sigla + Nome + Tipo */}
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-lg font-bold text-xs shadow-xs"
                      style={{
                        backgroundColor: meta.bgLight,
                        color: meta.textColor,
                        border: `1px solid ${meta.corPrimaria}40`,
                      }}
                    >
                      {meta.sigla}
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm text-[var(--color-text)] leading-tight">
                        {prog.nome}
                      </h4>
                      <span className="inline-flex items-center gap-1 text-[11px] text-[var(--color-muted)]">
                        {renderTipoIcon(meta.tipo)}
                        {meta.tipo === 'aereo'
                          ? 'Aéreo'
                          : meta.tipo === 'bancario'
                          ? 'Banco / Cartão'
                          : meta.tipo === 'hotel'
                          ? 'Hotelaria'
                          : 'Fidelidade'}
                      </span>
                    </div>
                  </div>

                  <span className="text-[11px] font-semibold text-[var(--color-muted)]">
                    {percentual.toFixed(0)}%
                  </span>
                </div>

                {/* Saldo + Valor Estimado */}
                <div className="mt-4">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xl font-bold tracking-tight text-[var(--color-text)]">
                      {prog.saldo.toLocaleString('pt-BR')}
                    </span>
                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      ≈ {formatCurrency(prog.valor_estimado)}
                    </span>
                  </div>

                  {/* Progress bar do total */}
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-bg)]">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.max(4, Math.min(100, percentual))}%`,
                        backgroundColor: meta.corPrimaria,
                      }}
                    />
                  </div>
                </div>

                {/* Expiração info */}
                <div className="mt-3 min-h-[22px]">
                  {prog.proxima_expiracao ? (
                    <div className="flex items-center gap-1.5 text-[11px] text-amber-700 dark:text-amber-400">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      <span>
                        {prog.qtd_expirando_proxima.toLocaleString('pt-BR')} pts expiram em{' '}
                        {formatDateBr(prog.proxima_expiracao)}
                      </span>
                    </div>
                  ) : (
                    <span className="text-[11px] text-[var(--color-muted)]">
                      Sem expiração programada
                    </span>
                  )}
                </div>
              </div>

              {/* Botões de Ação Rápida */}
              <div className="mt-4 flex items-center justify-between gap-1.5 border-t border-[var(--color-border)]/60 pt-3">
                <button
                  type="button"
                  onClick={() => onSelectPrograma(isSelected ? null : prog.nome)}
                  className="rounded px-2 py-1 text-xs font-medium text-[var(--color-muted)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]"
                >
                  {isSelected ? 'Ver Todos' : 'Ver Extrato'}
                </button>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    title={`Transferir pontos de ${prog.nome}`}
                    onClick={() => onTransferir(prog.nome)}
                    className="flex h-7 w-7 items-center justify-center rounded border border-[var(--color-border)] text-[var(--color-muted)] hover:bg-[var(--color-bg)] hover:text-[var(--color-primary)]"
                  >
                    <ArrowRightLeft className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    title={`Registrar resgate / saída em ${prog.nome}`}
                    onClick={() => onNovaMovimentacao(prog.nome, 'saida')}
                    className="flex h-7 w-7 items-center justify-center rounded border border-[var(--color-border)] text-[var(--color-muted)] hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    title={`Adicionar pontos em ${prog.nome}`}
                    onClick={() => onNovaMovimentacao(prog.nome, 'entrada')}
                    className="flex h-7 w-7 items-center justify-center rounded bg-[var(--color-primary)] text-white hover:opacity-90"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
