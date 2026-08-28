/**
 * Tema único dos gráficos do dashboard.
 * Mantém a mesma linguagem visual da planilha anual.
 */

export const CHART_COLORS = {
  receita: '#059669',
  despesa: '#e11d48',
  investimento: '#0284c7',
  cartoes: '#ea580c',
  saldo: '#7c3aed',
  saldoNegativo: '#e11d48',
  anterior: '#94a3b8',
  grid: '#e2e8f0',
  eixo: '#64748b',
} as const

/** Paleta cíclica para séries com número variável de itens (categorias). */
export const CHART_PALETTE = [
  '#0ea5e9',
  '#8b5cf6',
  '#f59e0b',
  '#10b981',
  '#ef4444',
  '#ec4899',
  '#14b8a6',
  '#f97316',
  '#6366f1',
  '#84cc16',
  '#06b6d4',
  '#a855f7',
]

export function corDaSerie(indice: number) {
  return CHART_PALETTE[indice % CHART_PALETTE.length]
}

export const MESES_CURTOS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

/** Formata valores no eixo de forma compacta: 1.2 mi, 24 mil, 850 */
export function formatarEixo(valor: number) {
  const absoluto = Math.abs(valor)
  if (absoluto >= 1_000_000) return `${(valor / 1_000_000).toFixed(1).replace('.', ',')} mi`
  if (absoluto >= 1_000) return `${Math.round(valor / 1_000)} mil`
  return String(Math.round(valor))
}

export function formatarPercentual(valor: number | null | undefined, casas = 1) {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return '—'
  const sinal = valor > 0 ? '+' : ''
  return `${sinal}${valor.toFixed(casas).replace('.', ',')}%`
}

/** Propriedades comuns dos eixos, para manter consistência entre gráficos. */
export const eixoProps = {
  stroke: CHART_COLORS.eixo,
  fontSize: 11,
  tickLine: false,
  axisLine: false,
} as const

export const gridProps = {
  stroke: CHART_COLORS.grid,
  strokeDasharray: '3 3',
  vertical: false,
} as const
