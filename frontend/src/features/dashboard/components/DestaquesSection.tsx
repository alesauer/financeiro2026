import { useMemo, useState } from 'react'
import {
  Sparkles,
  Trophy,
  AlertTriangle,
  PieChart as PieIcon,
  Calculator,
  TrendingUp,
  TrendingDown,
  Info,
  CheckCircle2,
  Calendar,
  LayoutGrid,
  ListFilter,
  BarChart3,
} from 'lucide-react'
import type { MatrizAnual } from '@/shared/types/relatorio'
import { formatCurrency } from '@/shared/utils/date'
import { MESES_CURTOS } from '@/features/dashboard/charts/chartTheme'

interface DestaquesSectionProps {
  dados: MatrizAnual
}

type AlternativaDestaques = 'cards' | 'feed' | 'comparativo'

export function DestaquesSection({ dados }: DestaquesSectionProps) {
  const [alternativa, setAlternativa] = useState<AlternativaDestaques>('cards')
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'positivo' | 'alerta' | 'info'>('todos')

  // 1. Cálculos de Recordes e Indicadores
  const indicadores = useMemo(() => {
    const receitas = dados.sumario.receita
    const despesas = dados.sumario.despesa
    const saldos = dados.sumario.saldo

    // Mês de maior sobra / saldo positivo
    let melhorMesIdx = 0
    let maiorSaldo = -Infinity
    saldos.forEach((s, i) => {
      if (s > maiorSaldo && (receitas[i] > 0 || despesas[i] > 0)) {
        maiorSaldo = s
        melhorMesIdx = i
      }
    })

    // Mês de maior despesa (pico)
    let piorMesDespesaIdx = 0
    let maiorDespesa = 0
    despesas.forEach((d, i) => {
      if (d > maiorDespesa) {
        maiorDespesa = d
        piorMesDespesaIdx = i
      }
    })

    // Mês de maior receita
    let melhorMesReceitaIdx = 0
    let maiorReceita = 0
    receitas.forEach((r, i) => {
      if (r > maiorReceita) {
        maiorReceita = r
        melhorMesReceitaIdx = i
      }
    })

    // Total e média de despesas
    const totalDesp = dados.sumario.totais.despesa
    const mesesComDados = despesas.filter((d) => d > 0).length || 1
    const mediaMensal = totalDesp / mesesComDados

    // Categoria líder
    const todasLinhas = [...(dados.secoes.Despesa ?? []), ...(dados.secoes.Cartoes ?? [])]
    const topCategoria = todasLinhas.sort((a, b) => b.total - a.total)[0]
    const percTop = totalDesp > 0 && topCategoria ? (topCategoria.total / totalDesp) * 100 : 0

    return {
      melhorMes: {
        nome: MESES_CURTOS[melhorMesIdx],
        saldo: maiorSaldo > -Infinity ? maiorSaldo : 0,
      },
      picoDespesa: {
        nome: MESES_CURTOS[piorMesDespesaIdx],
        valor: maiorDespesa,
      },
      picoReceita: {
        nome: MESES_CURTOS[melhorMesReceitaIdx],
        valor: maiorReceita,
      },
      mediaMensal,
      topCategoria: topCategoria ? { nome: topCategoria.chave, valor: topCategoria.total, percentual: percTop } : null,
    }
  }, [dados])

  // 2. Insights filtrados
  const insightsFiltrados = useMemo(() => {
    const list = dados.insights ?? []
    if (filtroTipo === 'todos') return list
    return list.filter((i) => i.tipo === filtroTipo)
  }, [dados.insights, filtroTipo])

  return (
    <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-xs">
      {/* Header com Seletor de Alternativas de Exibição */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-50 text-teal-700 border border-teal-200">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[var(--color-text)]">
              Destaques & Insights Financeiros
            </h3>
            <p className="text-xs text-[var(--color-muted)]">
              Análise inteligente do comportamento do seu orçamento em {dados.ano}
            </p>
          </div>
        </div>

        {/* Alternativas de Exibição */}
        <div className="flex rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]/60 p-1 text-xs">
          <button
            type="button"
            onClick={() => setAlternativa('cards')}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1 font-semibold transition ${
              alternativa === 'cards'
                ? 'bg-[var(--color-surface)] text-[var(--color-text)] shadow-xs'
                : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            <span>Indicadores & Recordes</span>
          </button>

          <button
            type="button"
            onClick={() => setAlternativa('feed')}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1 font-semibold transition ${
              alternativa === 'feed'
                ? 'bg-[var(--color-surface)] text-[var(--color-text)] shadow-xs'
                : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            <ListFilter className="h-3.5 w-3.5" />
            <span>Feed de Alertas ({(dados.insights ?? []).length})</span>
          </button>

          <button
            type="button"
            onClick={() => setAlternativa('comparativo')}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1 font-semibold transition ${
              alternativa === 'comparativo'
                ? 'bg-[var(--color-surface)] text-[var(--color-text)] shadow-xs'
                : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            <span>Projeção & Comparativo</span>
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* ALTERNATIVA 1: Grade de Indicadores & Recordes                */}
      {/* ------------------------------------------------------------- */}
      {alternativa === 'cards' && (
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          {/* Card 1: Melhor Mês */}
          <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/40 p-4 transition hover:shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                Maior Superávit
              </span>
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <Trophy className="h-3.5 w-3.5" />
              </div>
            </div>
            <p className="mt-2 text-lg font-bold text-emerald-950">
              {indicadores.melhorMes.nome} / {dados.ano}
            </p>
            <p className="text-xs text-emerald-800 mt-0.5">
              Saldo: <strong className="font-bold">{formatCurrency(indicadores.melhorMes.saldo)}</strong>
            </p>
          </div>

          {/* Card 2: Pico de Despesas */}
          <div className="rounded-xl border border-rose-200/80 bg-rose-50/40 p-4 transition hover:shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-rose-800">
                Pico de Gastos
              </span>
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-rose-100 text-rose-700">
                <AlertTriangle className="h-3.5 w-3.5" />
              </div>
            </div>
            <p className="mt-2 text-lg font-bold text-rose-950">
              {indicadores.picoDespesa.nome} / {dados.ano}
            </p>
            <p className="text-xs text-rose-800 mt-0.5">
              Total gasto: <strong className="font-bold">{formatCurrency(indicadores.picoDespesa.valor)}</strong>
            </p>
          </div>

          {/* Card 3: Categoria Principal */}
          <div className="rounded-xl border border-amber-200/80 bg-amber-50/40 p-4 transition hover:shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-800">
                Maior Categoria
              </span>
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                <PieIcon className="h-3.5 w-3.5" />
              </div>
            </div>
            <p className="mt-2 text-lg font-bold text-amber-950 truncate">
              {indicadores.topCategoria?.nome || 'N/A'}
            </p>
            <p className="text-xs text-amber-800 mt-0.5">
              {formatCurrency(indicadores.topCategoria?.valor ?? 0)} ({indicadores.topCategoria?.percentual.toFixed(1)}% do ano)
            </p>
          </div>

          {/* Card 4: Média Mensal */}
          <div className="rounded-xl border border-sky-200/80 bg-sky-50/40 p-4 transition hover:shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-sky-800">
                Média Mensal
              </span>
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-100 text-sky-700">
                <Calculator className="h-3.5 w-3.5" />
              </div>
            </div>
            <p className="mt-2 text-lg font-bold text-sky-950">
              {formatCurrency(indicadores.mediaMensal)}
            </p>
            <p className="text-xs text-sky-800 mt-0.5">
              Média de despesas por mês ativo
            </p>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* ALTERNATIVA 2: Feed de Insights & Alertas                     */}
      {/* ------------------------------------------------------------- */}
      {alternativa === 'feed' && (
        <div className="space-y-3">
          {/* Filtro de Tags */}
          <div className="flex items-center gap-1.5 text-xs">
            {(['todos', 'positivo', 'alerta', 'info'] as const).map((tipo) => (
              <button
                key={tipo}
                type="button"
                onClick={() => setFiltroTipo(tipo)}
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize transition ${
                  filtroTipo === tipo
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tipo === 'todos' ? 'Todos os Alertas' : tipo}
              </button>
            ))}
          </div>

          {insightsFiltrados.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--color-muted)]">
              Nenhum alerta para o filtro selecionado.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              {insightsFiltrados.map((insight, idx) => {
                const isPos = insight.tipo === 'positivo'
                const isAlert = insight.tipo === 'alerta'

                return (
                  <div
                    key={`${insight.titulo}-${idx}`}
                    className={`rounded-xl border p-3.5 flex items-start gap-3 transition ${
                      isPos
                        ? 'border-emerald-200 bg-emerald-50/50'
                        : isAlert
                          ? 'border-amber-200 bg-amber-50/50'
                          : 'border-sky-200 bg-sky-50/50'
                    }`}
                  >
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                        isPos
                          ? 'bg-emerald-100 text-emerald-700'
                          : isAlert
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-sky-100 text-sky-700'
                      }`}
                    >
                      {isPos ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : isAlert ? (
                        <AlertTriangle className="h-4 w-4" />
                      ) : (
                        <Info className="h-4 w-4" />
                      )}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-[var(--color-text)]">
                        {insight.titulo}
                      </h4>
                      <p className="text-xs text-[var(--color-muted)] mt-0.5 leading-relaxed">
                        {insight.texto}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* ALTERNATIVA 3: Projeção & Comparativo                         */}
      {/* ------------------------------------------------------------- */}
      {alternativa === 'comparativo' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Receitas */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[var(--color-muted)] uppercase">Receitas Anuais</span>
              <TrendingUp className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="text-xl font-bold text-emerald-700 mt-2">
              {formatCurrency(dados.sumario.totais.receita)}
            </p>
            {dados.comparativo?.variacoes.receita !== null && dados.comparativo?.variacoes.receita !== undefined && (
              <p className="text-xs text-[var(--color-muted)] mt-1">
                {dados.comparativo.variacoes.receita >= 0 ? '▲ +' : '▼ '}
                {dados.comparativo.variacoes.receita.toFixed(1)}% vs {dados.comparativo.ano}
              </p>
            )}
          </div>

          {/* Despesas */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[var(--color-muted)] uppercase">Despesas Anuais</span>
              <TrendingDown className="h-4 w-4 text-rose-600" />
            </div>
            <p className="text-xl font-bold text-rose-700 mt-2">
              {formatCurrency(dados.sumario.totais.despesa)}
            </p>
            {dados.comparativo?.variacoes.despesa !== null && dados.comparativo?.variacoes.despesa !== undefined && (
              <p className="text-xs text-[var(--color-muted)] mt-1">
                {dados.comparativo.variacoes.despesa >= 0 ? '▲ +' : '▼ '}
                {dados.comparativo.variacoes.despesa.toFixed(1)}% vs {dados.comparativo.ano}
              </p>
            )}
          </div>

          {/* Saldo / Projeção */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[var(--color-muted)] uppercase">
                {dados.projecao ? 'Projeção Final do Ano' : 'Saldo Consolidado'}
              </span>
              <Calendar className="h-4 w-4 text-teal-600" />
            </div>
            <p className="text-xl font-bold text-[var(--color-text)] mt-2">
              {formatCurrency(dados.projecao?.saldo.projetado ?? dados.sumario.totais.saldo)}
            </p>
            <p className="text-xs text-[var(--color-muted)] mt-1">
              {dados.projecao
                ? `Baseado no ritmo dos meses realizados em ${dados.ano}`
                : `Resultado acumulado até o momento`}
            </p>
          </div>
        </div>
      )}
    </section>
  )
}
