import {
  CreditCard,
  Receipt,
  Landmark,
  TrendingUp,
  RefreshCw,
  Target,
  Bell,
} from 'lucide-react'
import type { Lembrete, LembretePrioridade } from '@/shared/types/lembrete'

export type CategoriaConfig = {
  nome: string
  cor: string
  bgLight: string
  textColor: string
  icon: any
}

export const CATEGORIAS_FINANCEIRAS: Record<string, CategoriaConfig> = {
  'Cartões & Faturas': {
    nome: 'Cartões & Faturas',
    cor: '#F43F5E',
    bgLight: 'rgba(244, 63, 94, 0.12)',
    textColor: '#E11D48',
    icon: CreditCard,
  },
  'Boletos & Contas': {
    nome: 'Boletos & Contas',
    cor: '#F59E0B',
    bgLight: 'rgba(245, 158, 11, 0.12)',
    textColor: '#D97706',
    icon: Receipt,
  },
  'Impostos & Taxas': {
    nome: 'Impostos & Taxas',
    cor: '#8B5CF6',
    bgLight: 'rgba(139, 92, 246, 0.12)',
    textColor: '#7C3AED',
    icon: Landmark,
  },
  'Investimentos': {
    nome: 'Investimentos',
    cor: '#10B981',
    bgLight: 'rgba(16, 185, 129, 0.12)',
    textColor: '#059669',
    icon: TrendingUp,
  },
  'Assinaturas & Recorrentes': {
    nome: 'Assinaturas & Recorrentes',
    cor: '#0EA5E9',
    bgLight: 'rgba(14, 165, 233, 0.12)',
    textColor: '#0284C7',
    icon: RefreshCw,
  },
  'Metas & Planejamento': {
    nome: 'Metas & Planejamento',
    cor: '#6366F1',
    bgLight: 'rgba(99, 102, 241, 0.12)',
    textColor: '#4F46E5',
    icon: Target,
  },
  'Geral': {
    nome: 'Geral',
    cor: '#64748B',
    bgLight: 'rgba(100, 116, 139, 0.12)',
    textColor: '#475569',
    icon: Bell,
  },
}

export function obterCategoriaConfig(nome: string | null | undefined): CategoriaConfig {
  if (!nome) return CATEGORIAS_FINANCEIRAS['Geral']
  const matchedKey = Object.keys(CATEGORIAS_FINANCEIRAS).find(
    (k) => k.toLowerCase() === nome.toLowerCase().trim()
  )
  if (matchedKey) return CATEGORIAS_FINANCEIRAS[matchedKey]

  // Fallback
  return {
    nome,
    cor: '#64748B',
    bgLight: 'rgba(100, 116, 139, 0.12)',
    textColor: '#475569',
    icon: Bell,
  }
}

export type LembreteTemplate = {
  titulo: string
  categoria: string
  prioridade: LembretePrioridade
  diasOffset?: number
}

export const TEMPLATES_FINANCEIROS: LembreteTemplate[] = [
  {
    titulo: 'Pagar fatura do Cartão de Crédito',
    categoria: 'Cartões & Faturas',
    prioridade: 'Alta',
    diasOffset: 0,
  },
  {
    titulo: 'Pagar conta de Luz / Água / Internet',
    categoria: 'Boletos & Contas',
    prioridade: 'Alta',
    diasOffset: 1,
  },
  {
    titulo: 'Pagar DAS MEI / Guias Tributárias',
    categoria: 'Impostos & Taxas',
    prioridade: 'Alta',
    diasOffset: 5,
  },
  {
    titulo: 'Aporte mensal de Investimentos',
    categoria: 'Investimentos',
    prioridade: 'Média',
    diasOffset: 2,
  },
  {
    titulo: 'Revisar e cancelar assinaturas em teste',
    categoria: 'Assinaturas & Recorrentes',
    prioridade: 'Média',
    diasOffset: 7,
  },
  {
    titulo: 'Renovação do Seguro Auto / Residencial',
    categoria: 'Boletos & Contas',
    prioridade: 'Média',
    diasOffset: 15,
  },
]

export type GrupoTemporal = 'atrasado' | 'hoje' | 'amanha' | 'proximos_7d' | 'mais_adiante' | 'sem_data' | 'concluido'

export type LembretesAgrupados = {
  atrasados: Lembrete[]
  hoje: Lembrete[]
  amanha: Lembrete[]
  proximos7d: Lembrete[]
  maisAdiante: Lembrete[]
  semData: Lembrete[]
  concluidos: Lembrete[]
}

export function agruparLembretes(items: Lembrete[]): LembretesAgrupados {
  const agora = new Date()
  const hojeStr = agora.toISOString().slice(0, 10)

  const amanha = new Date(agora)
  amanha.setDate(amanha.getDate() + 1)
  const amanhaStr = amanha.toISOString().slice(0, 10)

  const seteDias = new Date(agora)
  seteDias.setDate(seteDias.getDate() + 7)
  const seteDiasStr = seteDias.toISOString().slice(0, 10)

  const grupos: LembretesAgrupados = {
    atrasados: [],
    hoje: [],
    amanha: [],
    proximos7d: [],
    maisAdiante: [],
    semData: [],
    concluidos: [],
  }

  for (const item of items) {
    if (item.status === 'Concluído') {
      grupos.concluidos.push(item)
      continue
    }

    if (!item.data_lembrete) {
      grupos.semData.push(item)
      continue
    }

    if (item.data_lembrete < hojeStr) {
      grupos.atrasados.push(item)
    } else if (item.data_lembrete === hojeStr) {
      grupos.hoje.push(item)
    } else if (item.data_lembrete === amanhaStr) {
      grupos.amanha.push(item)
    } else if (item.data_lembrete <= seteDiasStr) {
      grupos.proximos7d.push(item)
    } else {
      grupos.maisAdiante.push(item)
    }
  }

  return grupos
}

export function formatarUrgenciaLembrete(dataLembrete: string | null): {
  texto: string
  urgencia: 'atrasado' | 'hoje' | 'amanha' | 'proximo' | 'futuro' | 'sem_data'
  badgeClass: string
} {
  if (!dataLembrete) {
    return {
      texto: 'Sem data',
      urgencia: 'sem_data',
      badgeClass: 'text-[var(--color-muted)] bg-[var(--color-bg)] border-[var(--color-border)]',
    }
  }

  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const target = new Date(dataLembrete + 'T00:00:00')
  const diffTime = target.getTime() - hoje.getTime()
  const diffDias = Math.round(diffTime / (1000 * 3600 * 24))

  if (diffDias < 0) {
    const diasAtraso = Math.abs(diffDias)
    return {
      texto: diasAtraso === 1 ? 'Atrasado ontem' : `Atrasado há ${diasAtraso} dias`,
      urgencia: 'atrasado',
      badgeClass: 'text-rose-700 bg-rose-50 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/60 font-bold',
    }
  }

  if (diffDias === 0) {
    return {
      texto: 'Vence Hoje',
      urgencia: 'hoje',
      badgeClass: 'text-amber-700 bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/60 font-bold',
    }
  }

  if (diffDias === 1) {
    return {
      texto: 'Amanhã',
      urgencia: 'amanha',
      badgeClass: 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/60 font-semibold',
    }
  }

  if (diffDias <= 7) {
    return {
      texto: `Em ${diffDias} dias`,
      urgencia: 'proximo',
      badgeClass: 'text-sky-700 bg-sky-50 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-900/60 font-medium',
    }
  }

  return {
    texto: `Em ${diffDias} dias`,
    urgencia: 'futuro',
    badgeClass: 'text-[var(--color-muted)] bg-[var(--color-bg)] border-[var(--color-border)] font-medium',
  }
}
