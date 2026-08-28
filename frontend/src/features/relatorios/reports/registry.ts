import type { LucideIcon } from 'lucide-react'
import {
  Activity,
  BarChart3,
  Calendar,
  CheckCircle,
  Clock,
  CreditCard,
  DollarSign,
  Layers,
  List,
  PieChart,
  TrendingUp,
} from 'lucide-react'
import { lazy, type ComponentType, type LazyExoticComponent } from 'react'

export type RelatorioGrupo = 'Visão financeira' | 'Despesas' | 'Cartões e compromissos'

export type RelatorioDef = {
  id: string
  titulo: string
  descricao: string
  grupo: RelatorioGrupo
  icone: LucideIcon
  cor: string
  Componente: LazyExoticComponent<ComponentType>
}

export const GRUPOS: RelatorioGrupo[] = ['Visão financeira', 'Despesas', 'Cartões e compromissos']

export const RELATORIOS: RelatorioDef[] = [
  {
    id: 'resumo-periodo',
    titulo: 'Resumo do período',
    descricao: 'Receitas, despesas e saldo com comparativo vs período anterior.',
    grupo: 'Visão financeira',
    icone: DollarSign,
    cor: '#0ea5e9',
    Componente: lazy(() => import('./visaoFinanceira').then((m) => ({ default: m.ResumoPeriodoReport }))),
  },
  {
    id: 'fluxo-mensal',
    titulo: 'Fluxo de caixa mensal',
    descricao: 'Receitas × despesas mês a mês e saldo acumulado do ano.',
    grupo: 'Visão financeira',
    icone: BarChart3,
    cor: '#8b5cf6',
    Componente: lazy(() => import('./visaoFinanceira').then((m) => ({ default: m.FluxoMensalReport }))),
  },
  {
    id: 'saldo-diario',
    titulo: 'Evolução do saldo diário',
    descricao: 'Movimento dia a dia do mês, melhores e piores dias.',
    grupo: 'Visão financeira',
    icone: Activity,
    cor: '#10b981',
    Componente: lazy(() => import('./visaoFinanceira').then((m) => ({ default: m.SaldoDiarioReport }))),
  },
  {
    id: 'comparativo-anual',
    titulo: 'Comparativo ano × ano anterior',
    descricao: 'Variações de receita, despesa e saldo em relação ao ano anterior.',
    grupo: 'Visão financeira',
    icone: Layers,
    cor: '#f59e0b',
    Componente: lazy(() => import('./visaoFinanceira').then((m) => ({ default: m.ComparativoAnualReport }))),
  },
  {
    id: 'projecao-anual',
    titulo: 'Projeção de fim de ano',
    descricao: 'Realizado + projeção com base na média mensal, e insights automáticos.',
    grupo: 'Visão financeira',
    icone: TrendingUp,
    cor: '#7c3aed',
    Componente: lazy(() => import('./visaoFinanceira').then((m) => ({ default: m.ProjecaoAnualReport }))),
  },
  {
    id: 'despesas-categoria',
    titulo: 'Despesas por categoria',
    descricao: 'Composição das despesas com participação percentual e variação.',
    grupo: 'Despesas',
    icone: PieChart,
    cor: '#e11d48',
    Componente: lazy(() => import('./despesas').then((m) => ({ default: m.DespesasCategoriaReport }))),
  },
  {
    id: 'top-despesas',
    titulo: 'Top despesas do período',
    descricao: 'Ranking dos maiores lançamentos individuais.',
    grupo: 'Despesas',
    icone: List,
    cor: '#f97316',
    Componente: lazy(() => import('./despesas').then((m) => ({ default: m.TopDespesasReport }))),
  },
  {
    id: 'formas-pagamento',
    titulo: 'Despesas por forma de pagamento',
    descricao: 'Participação de cada forma de pagamento no período.',
    grupo: 'Despesas',
    icone: Calendar,
    cor: '#14b8a6',
    Componente: lazy(() => import('./despesas').then((m) => ({ default: m.FormasPagamentoReport }))),
  },
  {
    id: 'gastos-cartao',
    titulo: 'Gastos por cartão',
    descricao: 'Total, número de compras e ticket médio de cada cartão.',
    grupo: 'Cartões e compromissos',
    icone: CreditCard,
    cor: '#ea580c',
    Componente: lazy(() => import('./cartoes').then((m) => ({ default: m.GastosCartaoReport }))),
  },
  {
    id: 'parcelamentos-futuros',
    titulo: 'Parcelamentos futuros',
    descricao: 'Parcelas a vencer, total comprometido e impacto mês a mês.',
    grupo: 'Cartões e compromissos',
    icone: Clock,
    cor: '#6366f1',
    Componente: lazy(() => import('./cartoes').then((m) => ({ default: m.ParcelamentosFuturosReport }))),
  },
  {
    id: 'pendentes-pagas',
    titulo: 'Contas pendentes × pagas',
    descricao: 'Status dos lançamentos e lista de pendências do período.',
    grupo: 'Cartões e compromissos',
    icone: CheckCircle,
    cor: '#84cc16',
    Componente: lazy(() => import('./cartoes').then((m) => ({ default: m.PendentesPagasReport }))),
  },
]

export function buscarRelatorio(id: string) {
  return RELATORIOS.find((r) => r.id === id) ?? null
}
