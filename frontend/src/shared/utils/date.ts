export const MESES_NOMES_PT = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

export function getCurrentMonthRange() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const monthString = String(month).padStart(2, '0')
  const firstDay = `${year}-${monthString}-01`
  const lastDayDate = new Date(year, month, 0)
  const lastDay = `${year}-${monthString}-${String(lastDayDate.getDate()).padStart(2, '0')}`

  return {
    firstDay,
    lastDay,
    year,
    month,
    isoMonth: `${year}-${monthString}`,
  }
}

export function getMonthRange(year: number, month: number) {
  const monthString = String(month).padStart(2, '0')
  const firstDay = `${year}-${monthString}-01`
  const lastDayDate = new Date(year, month, 0)
  const lastDay = `${year}-${monthString}-${String(lastDayDate.getDate()).padStart(2, '0')}`

  return {
    firstDay,
    lastDay,
    year,
    month,
    isoMonth: `${year}-${monthString}`,
  }
}

export function shiftMonth(isoMonth: string, delta: number) {
  let [year, month] = (isoMonth || '').split('-').map(Number)
  if (!year || !month) {
    const now = new Date()
    year = now.getFullYear()
    month = now.getMonth() + 1
  }

  const d = new Date(year, month - 1 + delta, 1)
  return getMonthRange(d.getFullYear(), d.getMonth() + 1)
}

export function formatMonthYearLabel(isoMonth: string) {
  const [yearStr, monthStr] = (isoMonth || '').split('-')
  const monthIdx = Number(monthStr) - 1
  if (monthIdx >= 0 && monthIdx < 12 && yearStr) {
    return `${MESES_NOMES_PT[monthIdx]} de ${yearStr}`
  }
  return isoMonth
}

export function formatDateBr(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('pt-BR')
}

export function formatCurrency(value?: string | number | null) {
  if (value === null || value === undefined || value === '') return 'R$ 0,00'
  const amount = typeof value === 'string' ? Number(value) : value
  if (Number.isNaN(amount)) return 'R$ 0,00'
  return amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function isoToday(): string {
  return new Date().toISOString().slice(0, 10)
}


