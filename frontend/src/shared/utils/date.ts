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
  }
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
