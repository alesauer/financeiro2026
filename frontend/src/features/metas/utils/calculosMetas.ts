import type { SituacaoMeta } from '@/features/metas/types/metas'

export const MESES_LISTA = [
  { numero: 1, nome: 'Janeiro', curto: 'Jan' },
  { numero: 2, nome: 'Fevereiro', curto: 'Fev' },
  { numero: 3, nome: 'Março', curto: 'Mar' },
  { numero: 4, nome: 'Abril', curto: 'Abr' },
  { numero: 5, nome: 'Maio', curto: 'Mai' },
  { numero: 6, nome: 'Junho', curto: 'Jun' },
  { numero: 7, nome: 'Julho', curto: 'Jul' },
  { numero: 8, nome: 'Agosto', curto: 'Ago' },
  { numero: 9, nome: 'Setembro', curto: 'Set' },
  { numero: 10, nome: 'Outubro', curto: 'Out' },
  { numero: 11, nome: 'Novembro', curto: 'Nov' },
  { numero: 12, nome: 'Dezembro', curto: 'Dez' },
]

export function getEstiloSituacao(situacao: SituacaoMeta) {
  if (situacao === 'ultrapassada') {
    return {
      barColor: 'bg-rose-500',
      textColor: 'text-rose-600',
      badgeBg: 'bg-rose-50 text-rose-700 border-rose-200',
      label: 'Ultrapassada',
    }
  }
  if (situacao === 'atencao') {
    return {
      barColor: 'bg-amber-500',
      textColor: 'text-amber-600',
      badgeBg: 'bg-amber-50 text-amber-800 border-amber-200',
      label: 'Em atenção',
    }
  }
  return {
    barColor: 'bg-emerald-600',
    textColor: 'text-emerald-700',
    badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    label: 'Dentro da meta',
  }
}

export function navegarPeriodo(mes: number, ano: number, delta: -1 | 1): { mes: number; ano: number } {
  let novoMes = mes + delta
  let novoAno = ano
  if (novoMes < 1) {
    novoMes = 12
    novoAno -= 1
  } else if (novoMes > 12) {
    novoMes = 1
    novoAno += 1
  }
  return { mes: novoMes, ano: novoAno }
}

export function formatarDataCurtaPt(isoDate: string): string {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}/.test(isoDate)) return isoDate
  const [y, m, d] = isoDate.slice(0, 10).split('-').map(Number)
  const mesCurto = MESES_LISTA[m - 1]?.curto.toLowerCase() ?? ''
  return `${String(d).padStart(2, '0')}/${mesCurto}/${y}`
}

