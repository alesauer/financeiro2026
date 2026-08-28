import { ArrowLeft, Download, FileSpreadsheet, FileText } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

import {
  exportarCsv,
  exportarPdf,
  exportarXlsx,
  type DadosExportacao,
} from '@/features/relatorios/utils/exportarRelatorio'
import { formatCurrency, getCurrentMonthRange } from '@/shared/utils/date'

/* ------------------------------------------------------------------ */
/* Shell: cabeçalho com voltar, título e exportação                    */
/* ------------------------------------------------------------------ */

type ReportShellProps = {
  titulo: string
  descricao: string
  filtros?: ReactNode
  loading?: boolean
  error?: string | null
  exportData?: () => DadosExportacao | null
  children: ReactNode
}

export function ReportShell({ titulo, descricao, filtros, loading, error, exportData, children }: ReportShellProps) {
  const [exportando, setExportando] = useState(false)

  const handleExport = async (formato: 'csv' | 'xlsx' | 'pdf') => {
    const dados = exportData?.()
    if (!dados) return
    setExportando(true)
    try {
      if (formato === 'csv') exportarCsv(dados)
      if (formato === 'xlsx') await exportarXlsx(dados)
      if (formato === 'pdf') await exportarPdf(dados)
    } finally {
      setExportando(false)
    }
  }

  const btnExport =
    'inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-text)] transition-colors hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] disabled:opacity-50'

  return (
    <section className="space-y-5">
      <header className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5">
            <Link
              to="/relatorios"
              className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-muted)] transition-colors hover:text-[var(--color-primary)]"
            >
              <ArrowLeft size={14} />
              Central de relatórios
            </Link>
            <h2 className="text-2xl font-semibold text-[var(--color-text)]">{titulo}</h2>
            <p className="text-sm text-[var(--color-muted)]">{descricao}</p>
          </div>

          {exportData ? (
            <div className="flex items-center gap-2">
              <button type="button" disabled={exportando} onClick={() => handleExport('csv')} className={btnExport}>
                <Download size={14} />
                CSV
              </button>
              <button type="button" disabled={exportando} onClick={() => handleExport('xlsx')} className={btnExport}>
                <FileSpreadsheet size={14} />
                XLSX
              </button>
              <button type="button" disabled={exportando} onClick={() => handleExport('pdf')} className={btnExport}>
                <FileText size={14} />
                PDF
              </button>
            </div>
          ) : null}
        </div>

        {filtros ? <div className="mt-4 border-t border-[var(--color-border)] pt-4">{filtros}</div> : null}
      </header>

      {error ? (
        <p className="rounded-[var(--radius-md)] border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</p>
      ) : null}

      {loading ? (
        <p className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center text-sm text-[var(--color-muted)]">
          Carregando relatório...
        </p>
      ) : (
        children
      )}
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Filtros reutilizáveis                                               */
/* ------------------------------------------------------------------ */

const inputCls =
  'w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm'

const labelCls = 'text-xs font-medium uppercase tracking-wide text-[var(--color-muted)]'

type PeriodoFiltroProps = {
  inicio: string
  fim: string
  onChange: (inicio: string, fim: string) => void
}

export function PeriodoFiltro({ inicio, fim, onChange }: PeriodoFiltroProps) {
  const ano = new Date().getFullYear()

  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="space-y-1">
        <span className={labelCls}>Início</span>
        <input type="date" value={inicio} onChange={(e) => onChange(e.target.value, fim)} className={inputCls} />
      </label>
      <label className="space-y-1">
        <span className={labelCls}>Fim</span>
        <input type="date" value={fim} onChange={(e) => onChange(inicio, e.target.value)} className={inputCls} />
      </label>
      <div className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] border border-[var(--color-border)] p-1">
        <button
          type="button"
          onClick={() => {
            const range = getCurrentMonthRange()
            onChange(range.firstDay, range.lastDay)
          }}
          className="rounded px-2.5 py-1 text-xs font-medium text-[var(--color-muted)] transition-colors hover:text-[var(--color-text)]"
        >
          Mês atual
        </button>
        <button
          type="button"
          onClick={() => onChange(`${ano}-01-01`, `${ano}-12-31`)}
          className="rounded px-2.5 py-1 text-xs font-medium text-[var(--color-muted)] transition-colors hover:text-[var(--color-text)]"
        >
          Ano inteiro
        </button>
      </div>
    </div>
  )
}

type AnoFiltroProps = {
  ano: number
  onChange: (ano: number) => void
}

export function AnoFiltro({ ano, onChange }: AnoFiltroProps) {
  const atual = new Date().getFullYear()
  const anos = Array.from({ length: 6 }, (_, i) => atual - 4 + i)

  return (
    <label className="inline-flex flex-col gap-1">
      <span className={labelCls}>Ano</span>
      <select value={ano} onChange={(e) => onChange(Number(e.target.value))} className={inputCls}>
        {anos.map((a) => (
          <option key={a} value={a}>
            {a}
          </option>
        ))}
      </select>
    </label>
  )
}

const NOMES_MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

type MesAnoFiltroProps = {
  ano: number
  mes: number
  onChange: (ano: number, mes: number) => void
}

export function MesAnoFiltro({ ano, mes, onChange }: MesAnoFiltroProps) {
  const atual = new Date().getFullYear()
  const anos = Array.from({ length: 6 }, (_, i) => atual - 4 + i)

  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="inline-flex flex-col gap-1">
        <span className={labelCls}>Mês</span>
        <select value={mes} onChange={(e) => onChange(ano, Number(e.target.value))} className={inputCls}>
          {NOMES_MESES.map((nome, i) => (
            <option key={nome} value={i + 1}>
              {nome}
            </option>
          ))}
        </select>
      </label>
      <label className="inline-flex flex-col gap-1">
        <span className={labelCls}>Ano</span>
        <select value={ano} onChange={(e) => onChange(Number(e.target.value), mes)} className={inputCls}>
          {anos.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Blocos visuais compartilhados                                       */
/* ------------------------------------------------------------------ */

type KpiBoxProps = {
  titulo: string
  valor: string
  detalhe?: ReactNode
  cor?: string
  destaque?: boolean
}

export function KpiBox({ titulo, valor, detalhe, cor, destaque = false }: KpiBoxProps) {
  return (
    <article
      className={`rounded-[var(--radius-md)] border p-4 ${
        destaque
          ? 'border-[var(--color-primary)]/40 bg-[var(--color-primary)]/5'
          : 'border-[var(--color-border)] bg-[var(--color-surface)]'
      }`}
    >
      <h3 className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted)]">{titulo}</h3>
      <p className="mt-1.5 text-2xl font-bold tabular-nums" style={cor ? { color: cor } : undefined}>
        {valor}
      </p>
      {detalhe ? <div className="mt-1 text-xs text-[var(--color-muted)]">{detalhe}</div> : null}
    </article>
  )
}

type VariacaoProps = {
  atual: number
  anterior: number | null
  /** Em despesas, alta é ruim. */
  inverter?: boolean
  rotulo?: string
}

export function VariacaoBadge({ atual, anterior, inverter = false, rotulo = 'vs período anterior' }: VariacaoProps) {
  if (anterior === null || anterior === 0) {
    return <span className="text-[var(--color-muted)]">Sem comparação</span>
  }

  const variacao = ((atual - anterior) / Math.abs(anterior)) * 100
  const positiva = variacao > 0
  const ehBoa = inverter ? !positiva : positiva
  const cor = Math.abs(variacao) < 0.01 ? 'text-[var(--color-muted)]' : ehBoa ? 'text-emerald-600' : 'text-rose-600'

  return (
    <span>
      <span className={`font-semibold ${cor}`}>
        {positiva ? '▲' : variacao < 0 ? '▼' : '—'} {Math.abs(variacao).toFixed(1).replace('.', ',')}%
      </span>{' '}
      <span className="text-[var(--color-muted)]">{rotulo}</span>
    </span>
  )
}

type BarraShareProps = {
  percentual: number
  cor?: string
}

export function BarraShare({ percentual, cor = 'var(--color-primary)' }: BarraShareProps) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-full min-w-16 overflow-hidden rounded-full bg-[var(--color-border)]">
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.min(100, Math.max(0, percentual))}%`, backgroundColor: cor }}
        />
      </div>
      <span className="w-12 shrink-0 text-right text-xs tabular-nums text-[var(--color-muted)]">
        {percentual.toFixed(1).replace('.', ',')}%
      </span>
    </div>
  )
}

type TabelaCardProps = {
  titulo: string
  subtitulo?: string
  children: ReactNode
  acao?: ReactNode
}

export function TabelaCard({ titulo, subtitulo, children, acao }: TabelaCardProps) {
  return (
    <article className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[var(--color-text)]">{titulo}</h3>
          {subtitulo ? <p className="text-xs text-[var(--color-muted)]">{subtitulo}</p> : null}
        </div>
        {acao}
      </div>
      <div className="overflow-x-auto">{children}</div>
    </article>
  )
}

export const thCls = 'px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-[var(--color-muted)]'
export const thNumCls = 'px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-[var(--color-muted)]'
export const tdCls = 'px-3 py-2 text-sm text-[var(--color-text)]'
export const tdNumCls = 'px-3 py-2 text-right text-sm tabular-nums text-[var(--color-text)]'

export function fmt(valor: number) {
  return formatCurrency(valor)
}

/** Calcula o período imediatamente anterior com a mesma duração. */
export function periodoAnterior(inicio: string, fim: string) {
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  const dataInicio = new Date(`${inicio}T00:00:00`)
  const dataFim = new Date(`${fim}T00:00:00`)
  const dias = Math.max(1, Math.round((dataFim.getTime() - dataInicio.getTime()) / 86_400_000) + 1)

  const fimAnterior = new Date(dataInicio)
  fimAnterior.setDate(fimAnterior.getDate() - 1)
  const inicioAnterior = new Date(fimAnterior)
  inicioAnterior.setDate(inicioAnterior.getDate() - dias + 1)

  return { inicio: iso(inicioAnterior), fim: iso(fimAnterior) }
}
