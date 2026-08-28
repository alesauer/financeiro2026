import { useEffect, useMemo, useState } from 'react'
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { InsightsPanel, ProjecaoChart } from '@/features/dashboard/charts/AvancadosCharts'
import { CHART_COLORS, eixoProps, formatarEixo, MESES_CURTOS } from '@/features/dashboard/charts/chartTheme'
import { useMatrizAnual } from '@/features/dashboard/hooks/useMatrizAnual'
import {
  AnoFiltro,
  BarraShare,
  fmt,
  KpiBox,
  MesAnoFiltro,
  PeriodoFiltro,
  periodoAnterior,
  ReportShell,
  TabelaCard,
  tdCls,
  tdNumCls,
  thCls,
  thNumCls,
  VariacaoBadge,
} from '@/features/relatorios/components/ReportShell'
import { relatoriosService } from '@/features/relatorios/services/relatoriosService'
import type {
  RelatorioCategoriaItem,
  RelatorioResumoMensal,
  RelatorioStatusPeriodo,
  RelatorioSumarioAnual,
  RelatorioTotaisItem,
} from '@/shared/types/relatorio'
import { formatCurrency, getCurrentMonthRange } from '@/shared/utils/date'
import { getErrorMessage } from '@/shared/utils/error'

const tooltipMoeda = (valor: number | string) => formatCurrency(Number(valor))

function totalDoTipo(itens: RelatorioTotaisItem[], tipo: string) {
  return itens.find((t) => t.tipo === tipo)?.total ?? 0
}

/* ================================================================== */
/* 1. Resumo do período                                                */
/* ================================================================== */

export function ResumoPeriodoReport() {
  const range = getCurrentMonthRange()
  const [inicio, setInicio] = useState(range.firstDay)
  const [fim, setFim] = useState(range.lastDay)

  const [totais, setTotais] = useState<RelatorioTotaisItem[]>([])
  const [totaisAnt, setTotaisAnt] = useState<RelatorioTotaisItem[]>([])
  const [categorias, setCategorias] = useState<RelatorioCategoriaItem[]>([])
  const [status, setStatus] = useState<RelatorioStatusPeriodo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let ativo = true
    setLoading(true)
    setError(null)

    const anterior = periodoAnterior(inicio, fim)
    Promise.all([
      relatoriosService.totais(inicio, fim),
      relatoriosService.totais(anterior.inicio, anterior.fim),
      relatoriosService.categorias(inicio, fim, 'Despesa'),
      relatoriosService.statusPeriodo(inicio, fim),
    ])
      .then(([t, ta, c, s]) => {
        if (!ativo) return
        setTotais(t)
        setTotaisAnt(ta)
        setCategorias(c.sort((a, b) => b.total - a.total))
        setStatus(s)
      })
      .catch((err) => ativo && setError(getErrorMessage(err, 'Não foi possível carregar o relatório.')))
      .finally(() => ativo && setLoading(false))

    return () => {
      ativo = false
    }
  }, [inicio, fim])

  const receita = totalDoTipo(totais, 'Receita')
  const despesa = totalDoTipo(totais, 'Despesa')
  const investimento = totalDoTipo(totais, 'Investimento')
  const saldo = receita - despesa
  const receitaAnt = totalDoTipo(totaisAnt, 'Receita')
  const despesaAnt = totalDoTipo(totaisAnt, 'Despesa')
  const saldoAnt = receitaAnt - despesaAnt

  const qtdLancamentos = useMemo(
    () => (status?.resumo ?? []).reduce((acc, item) => acc + item.qtd, 0),
    [status],
  )

  const totalDespesasCategorias = categorias.reduce((acc, c) => acc + c.total, 0)

  return (
    <ReportShell
      titulo="Resumo do período"
      descricao="Visão consolidada de receitas, despesas e saldo com comparativo vs período anterior."
      filtros={<PeriodoFiltro inicio={inicio} fim={fim} onChange={(i, f) => (setInicio(i), setFim(f))} />}
      loading={loading}
      error={error}
      exportData={() => ({
        titulo: 'Resumo do período',
        subtitulo: `Período: ${inicio} a ${fim}`,
        colunas: ['Indicador', 'Período atual', 'Período anterior'],
        linhas: [
          ['Receitas', receita, receitaAnt],
          ['Despesas', despesa, despesaAnt],
          ['Investimentos', investimento, totalDoTipo(totaisAnt, 'Investimento')],
          ['Saldo', saldo, saldoAnt],
          ['Lançamentos', qtdLancamentos, ''],
        ],
      })}
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiBox
          titulo="Receitas"
          valor={fmt(receita)}
          cor={CHART_COLORS.receita}
          detalhe={<VariacaoBadge atual={receita} anterior={receitaAnt} />}
        />
        <KpiBox
          titulo="Despesas"
          valor={fmt(despesa)}
          cor={CHART_COLORS.despesa}
          detalhe={<VariacaoBadge atual={despesa} anterior={despesaAnt} inverter />}
        />
        <KpiBox
          titulo="Saldo do período"
          valor={fmt(saldo)}
          cor={saldo >= 0 ? CHART_COLORS.receita : CHART_COLORS.despesa}
          destaque
          detalhe={<VariacaoBadge atual={saldo} anterior={saldoAnt} />}
        />
        <KpiBox titulo="Lançamentos" valor={String(qtdLancamentos)} detalhe="Total de transações no período" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <TabelaCard titulo="Comparativo por tipo" subtitulo="Período atual vs período anterior de mesma duração">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                <th className={thCls}>Tipo</th>
                <th className={thNumCls}>Atual</th>
                <th className={thNumCls}>Anterior</th>
                <th className={thNumCls}>Variação</th>
              </tr>
            </thead>
            <tbody>
              {(['Receita', 'Despesa', 'Investimento'] as const).map((tipo) => {
                const atual = totalDoTipo(totais, tipo)
                const anterior = totalDoTipo(totaisAnt, tipo)
                return (
                  <tr key={tipo} className="border-b border-[var(--color-border)]/60">
                    <td className={tdCls}>{tipo}</td>
                    <td className={tdNumCls}>{fmt(atual)}</td>
                    <td className={tdNumCls}>{fmt(anterior)}</td>
                    <td className={`${tdNumCls} text-xs`}>
                      <VariacaoBadge atual={atual} anterior={anterior} inverter={tipo === 'Despesa'} rotulo="" />
                    </td>
                  </tr>
                )
              })}
              <tr>
                <td className={`${tdCls} font-semibold`}>Saldo</td>
                <td className={`${tdNumCls} font-semibold`}>{fmt(saldo)}</td>
                <td className={`${tdNumCls} font-semibold`}>{fmt(saldoAnt)}</td>
                <td className={`${tdNumCls} text-xs`}>
                  <VariacaoBadge atual={saldo} anterior={saldoAnt} rotulo="" />
                </td>
              </tr>
            </tbody>
          </table>
        </TabelaCard>

        <TabelaCard titulo="Top 5 categorias de despesa" subtitulo="Participação no total de despesas do período">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                <th className={thCls}>Categoria</th>
                <th className={thNumCls}>Valor</th>
                <th className={`${thCls} w-1/3`}>Participação</th>
              </tr>
            </thead>
            <tbody>
              {categorias.slice(0, 5).map((cat) => (
                <tr key={cat.categoria} className="border-b border-[var(--color-border)]/60">
                  <td className={tdCls}>{cat.categoria}</td>
                  <td className={tdNumCls}>{fmt(cat.total)}</td>
                  <td className={tdCls}>
                    <BarraShare percentual={totalDespesasCategorias > 0 ? (cat.total / totalDespesasCategorias) * 100 : 0} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TabelaCard>
      </div>
    </ReportShell>
  )
}

/* ================================================================== */
/* 2. Fluxo de caixa mensal                                            */
/* ================================================================== */

export function FluxoMensalReport() {
  const [ano, setAno] = useState(new Date().getFullYear())
  const [sumario, setSumario] = useState<RelatorioSumarioAnual | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let ativo = true
    setLoading(true)
    setError(null)
    relatoriosService
      .sumarioAnual(ano)
      .then((dados) => ativo && setSumario(dados))
      .catch((err) => ativo && setError(getErrorMessage(err, 'Não foi possível carregar o relatório.')))
      .finally(() => ativo && setLoading(false))
    return () => {
      ativo = false
    }
  }, [ano])

  const dadosChart = useMemo(() => {
    if (!sumario) return []
    let acumulado = 0
    return MESES_CURTOS.map((mes, i) => {
      acumulado += sumario.sobrou[i] ?? 0
      return {
        mes,
        receita: sumario.receita[i] ?? 0,
        despesa: sumario.despesa[i] ?? 0,
        sobrou: sumario.sobrou[i] ?? 0,
        acumulado,
      }
    })
  }, [sumario])

  const mediaMensal = useMemo(() => {
    if (!sumario) return 0
    const mesesComDados = sumario.sobrou.filter((_, i) => (sumario.receita[i] ?? 0) !== 0 || (sumario.despesa[i] ?? 0) !== 0)
    return mesesComDados.length > 0 ? mesesComDados.reduce((a, b) => a + b, 0) / mesesComDados.length : 0
  }, [sumario])

  return (
    <ReportShell
      titulo="Fluxo de caixa mensal"
      descricao="Receitas × despesas mês a mês com linha de saldo acumulado no ano."
      filtros={<AnoFiltro ano={ano} onChange={setAno} />}
      loading={loading}
      error={error}
      exportData={() =>
        sumario
          ? {
              titulo: `Fluxo de caixa mensal ${ano}`,
              colunas: ['Mês', 'Receita', 'Despesa', 'Investimento', 'Sobrou', 'Acumulado'],
              linhas: dadosChart.map((d, i) => [d.mes, d.receita, d.despesa, sumario.investimento[i] ?? 0, d.sobrou, d.acumulado]),
            }
          : null
      }
    >
      {sumario ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiBox titulo="Receitas no ano" valor={fmt(sumario.total_receita)} cor={CHART_COLORS.receita} />
            <KpiBox titulo="Despesas no ano" valor={fmt(sumario.total_despesa)} cor={CHART_COLORS.despesa} />
            <KpiBox
              titulo="Sobrou no ano"
              valor={fmt(sumario.total_sobrou)}
              cor={sumario.total_sobrou >= 0 ? CHART_COLORS.receita : CHART_COLORS.despesa}
              destaque
            />
            <KpiBox titulo="Média mensal de sobra" valor={fmt(mediaMensal)} detalhe="Considera meses com movimento" />
          </div>

          <article className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <h3 className="mb-3 text-sm font-semibold text-[var(--color-text)]">Receitas × despesas por mês</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={dadosChart} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
                  <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
                  <XAxis dataKey="mes" {...eixoProps} />
                  <YAxis {...eixoProps} tickFormatter={formatarEixo} width={56} />
                  <Tooltip formatter={tooltipMoeda} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="receita" name="Receita" fill={CHART_COLORS.receita} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="despesa" name="Despesa" fill={CHART_COLORS.despesa} radius={[3, 3, 0, 0]} />
                  <Line dataKey="acumulado" name="Saldo acumulado" stroke={CHART_COLORS.saldo} strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </article>

          <TabelaCard titulo="Detalhamento mensal" subtitulo={`Ano de ${ano}`}>
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  <th className={thCls}>Mês</th>
                  <th className={thNumCls}>Receita</th>
                  <th className={thNumCls}>Despesa</th>
                  <th className={thNumCls}>Investimento</th>
                  <th className={thNumCls}>Sobrou</th>
                  <th className={thNumCls}>Acumulado</th>
                </tr>
              </thead>
              <tbody>
                {dadosChart.map((linha, i) => (
                  <tr key={linha.mes} className="border-b border-[var(--color-border)]/60">
                    <td className={tdCls}>{linha.mes}</td>
                    <td className={tdNumCls}>{fmt(linha.receita)}</td>
                    <td className={tdNumCls}>{fmt(linha.despesa)}</td>
                    <td className={tdNumCls}>{fmt(sumario.investimento[i] ?? 0)}</td>
                    <td className={`${tdNumCls} font-medium ${linha.sobrou >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {fmt(linha.sobrou)}
                    </td>
                    <td className={`${tdNumCls} ${linha.acumulado >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {fmt(linha.acumulado)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TabelaCard>
        </>
      ) : null}
    </ReportShell>
  )
}

/* ================================================================== */
/* 3. Evolução do saldo diário                                         */
/* ================================================================== */

export function SaldoDiarioReport() {
  const hoje = new Date()
  const [ano, setAno] = useState(hoje.getFullYear())
  const [mes, setMes] = useState(hoje.getMonth() + 1)
  const [resumo, setResumo] = useState<RelatorioResumoMensal | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let ativo = true
    setLoading(true)
    setError(null)
    relatoriosService
      .resumoMensal(ano, mes)
      .then((dados) => ativo && setResumo(dados))
      .catch((err) => ativo && setError(getErrorMessage(err, 'Não foi possível carregar o relatório.')))
      .finally(() => ativo && setLoading(false))
    return () => {
      ativo = false
    }
  }, [ano, mes])

  const dadosChart = useMemo(() => {
    if (!resumo) return []
    let acumulado = 0
    return resumo.dias.map((dia, i) => {
      acumulado += resumo.saldo[i] ?? 0
      return { dia, saldo: resumo.saldo[i] ?? 0, acumulado, investimento: resumo.acum_invest[i] ?? 0 }
    })
  }, [resumo])

  const stats = useMemo(() => {
    if (dadosChart.length === 0) return null
    const melhor = dadosChart.reduce((a, b) => (b.saldo > a.saldo ? b : a))
    const pior = dadosChart.reduce((a, b) => (b.saldo < a.saldo ? b : a))
    const positivos = dadosChart.filter((d) => d.saldo > 0).length
    const total = dadosChart.reduce((acc, d) => acc + d.saldo, 0)
    return { melhor, pior, positivos, total }
  }, [dadosChart])

  return (
    <ReportShell
      titulo="Evolução do saldo diário"
      descricao="Saldo dia a dia do mês selecionado, com acumulado e investimentos."
      filtros={<MesAnoFiltro ano={ano} mes={mes} onChange={(a, m) => (setAno(a), setMes(m))} />}
      loading={loading}
      error={error}
      exportData={() =>
        resumo
          ? {
              titulo: `Saldo diário ${String(mes).padStart(2, '0')}-${ano}`,
              colunas: ['Dia', 'Saldo do dia', 'Saldo acumulado', 'Investimento acumulado'],
              linhas: dadosChart.map((d) => [d.dia, d.saldo, d.acumulado, d.investimento]),
            }
          : null
      }
    >
      {stats ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiBox
            titulo="Saldo do mês"
            valor={fmt(stats.total)}
            cor={stats.total >= 0 ? CHART_COLORS.receita : CHART_COLORS.despesa}
            destaque
          />
          <KpiBox titulo="Melhor dia" valor={fmt(stats.melhor.saldo)} cor={CHART_COLORS.receita} detalhe={`Dia ${stats.melhor.dia}`} />
          <KpiBox titulo="Pior dia" valor={fmt(stats.pior.saldo)} cor={CHART_COLORS.despesa} detalhe={`Dia ${stats.pior.dia}`} />
          <KpiBox titulo="Dias positivos" valor={`${stats.positivos}/${dadosChart.length}`} detalhe="Dias com mais entradas do que saídas" />
        </div>
      ) : null}

      <article className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <h3 className="mb-3 text-sm font-semibold text-[var(--color-text)]">Saldo diário e acumulado</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={dadosChart} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
              <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
              <XAxis dataKey="dia" {...eixoProps} interval={2} />
              <YAxis {...eixoProps} tickFormatter={formatarEixo} width={56} />
              <Tooltip formatter={tooltipMoeda} labelFormatter={(dia) => `Dia ${dia}`} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="saldo" name="Saldo do dia" radius={[3, 3, 0, 0]} fill={CHART_COLORS.investimento} />
              <Line dataKey="acumulado" name="Acumulado no mês" stroke={CHART_COLORS.saldo} strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </article>

      <article className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <h3 className="mb-3 text-sm font-semibold text-[var(--color-text)]">Investimentos acumulados no mês</h3>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={dadosChart} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
              <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
              <XAxis dataKey="dia" {...eixoProps} interval={2} />
              <YAxis {...eixoProps} tickFormatter={formatarEixo} width={56} />
              <Tooltip formatter={tooltipMoeda} labelFormatter={(dia) => `Dia ${dia}`} />
              <Area dataKey="investimento" name="Investimento acumulado" stroke={CHART_COLORS.investimento} fill={CHART_COLORS.investimento} fillOpacity={0.15} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </article>
    </ReportShell>
  )
}

/* ================================================================== */
/* 4. Comparativo ano × ano anterior                                   */
/* ================================================================== */

export function ComparativoAnualReport() {
  const [ano, setAno] = useState(new Date().getFullYear())
  const { dados, loading, error } = useMatrizAnual({ ano, agrupar: 'categoria', base: 'data', cartoes: 'categoria', comparar: true })

  const comparativo = dados?.comparativo ?? null

  const dadosChart = useMemo(() => {
    if (!dados || !comparativo) return []
    return MESES_CURTOS.map((mes, i) => ({
      mes,
      despesaAtual: dados.sumario.despesa[i] ?? 0,
      despesaAnterior: comparativo.sumario.despesa[i] ?? 0,
      saldoAtual: dados.sumario.saldo[i] ?? 0,
      saldoAnterior: comparativo.sumario.saldo[i] ?? 0,
    }))
  }, [dados, comparativo])

  return (
    <ReportShell
      titulo="Comparativo ano × ano anterior"
      descricao={`Evolução de ${ano} em relação a ${ano - 1}, mês a mês.`}
      filtros={<AnoFiltro ano={ano} onChange={setAno} />}
      loading={loading}
      error={error}
      exportData={() =>
        dados && comparativo
          ? {
              titulo: `Comparativo ${ano} x ${comparativo.ano}`,
              colunas: ['Mês', `Receita ${ano}`, `Receita ${comparativo.ano}`, `Despesa ${ano}`, `Despesa ${comparativo.ano}`, `Saldo ${ano}`, `Saldo ${comparativo.ano}`],
              linhas: MESES_CURTOS.map((mes, i) => [
                mes,
                dados.sumario.receita[i] ?? 0,
                comparativo.sumario.receita[i] ?? 0,
                dados.sumario.despesa[i] ?? 0,
                comparativo.sumario.despesa[i] ?? 0,
                dados.sumario.saldo[i] ?? 0,
                comparativo.sumario.saldo[i] ?? 0,
              ]),
            }
          : null
      }
    >
      {dados && comparativo ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiBox
              titulo="Receitas"
              valor={fmt(dados.sumario.totais.receita)}
              cor={CHART_COLORS.receita}
              detalhe={<VariacaoBadge atual={dados.sumario.totais.receita} anterior={comparativo.sumario.totais.receita} rotulo={`vs ${comparativo.ano}`} />}
            />
            <KpiBox
              titulo="Despesas"
              valor={fmt(dados.sumario.totais.despesa)}
              cor={CHART_COLORS.despesa}
              detalhe={<VariacaoBadge atual={dados.sumario.totais.despesa} anterior={comparativo.sumario.totais.despesa} inverter rotulo={`vs ${comparativo.ano}`} />}
            />
            <KpiBox
              titulo="Investimentos"
              valor={fmt(dados.sumario.totais.investimento)}
              cor={CHART_COLORS.investimento}
              detalhe={<VariacaoBadge atual={dados.sumario.totais.investimento} anterior={comparativo.sumario.totais.investimento} rotulo={`vs ${comparativo.ano}`} />}
            />
            <KpiBox
              titulo="Saldo"
              valor={fmt(dados.sumario.totais.saldo)}
              cor={dados.sumario.totais.saldo >= 0 ? CHART_COLORS.receita : CHART_COLORS.despesa}
              destaque
              detalhe={<VariacaoBadge atual={dados.sumario.totais.saldo} anterior={comparativo.sumario.totais.saldo} rotulo={`vs ${comparativo.ano}`} />}
            />
          </div>

          <article className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <h3 className="mb-3 text-sm font-semibold text-[var(--color-text)]">Despesas mensais: {ano} × {comparativo.ano}</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={dadosChart} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
                  <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
                  <XAxis dataKey="mes" {...eixoProps} />
                  <YAxis {...eixoProps} tickFormatter={formatarEixo} width={56} />
                  <Tooltip formatter={tooltipMoeda} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="despesaAnterior" name={`Despesa ${comparativo.ano}`} fill={CHART_COLORS.anterior} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="despesaAtual" name={`Despesa ${ano}`} fill={CHART_COLORS.despesa} radius={[3, 3, 0, 0]} />
                  <Line dataKey="saldoAtual" name={`Saldo ${ano}`} stroke={CHART_COLORS.saldo} strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </article>

          <TabelaCard titulo="Tabela comparativa mensal" subtitulo={`${ano} × ${comparativo.ano}`}>
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  <th className={thCls}>Mês</th>
                  <th className={thNumCls}>Receita {ano}</th>
                  <th className={thNumCls}>Receita {comparativo.ano}</th>
                  <th className={thNumCls}>Despesa {ano}</th>
                  <th className={thNumCls}>Despesa {comparativo.ano}</th>
                  <th className={thNumCls}>Saldo {ano}</th>
                  <th className={thNumCls}>Saldo {comparativo.ano}</th>
                </tr>
              </thead>
              <tbody>
                {MESES_CURTOS.map((mes, i) => (
                  <tr key={mes} className="border-b border-[var(--color-border)]/60">
                    <td className={tdCls}>{mes}</td>
                    <td className={tdNumCls}>{fmt(dados.sumario.receita[i] ?? 0)}</td>
                    <td className={`${tdNumCls} text-[var(--color-muted)]`}>{fmt(comparativo.sumario.receita[i] ?? 0)}</td>
                    <td className={tdNumCls}>{fmt(dados.sumario.despesa[i] ?? 0)}</td>
                    <td className={`${tdNumCls} text-[var(--color-muted)]`}>{fmt(comparativo.sumario.despesa[i] ?? 0)}</td>
                    <td className={`${tdNumCls} ${(dados.sumario.saldo[i] ?? 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {fmt(dados.sumario.saldo[i] ?? 0)}
                    </td>
                    <td className={`${tdNumCls} text-[var(--color-muted)]`}>{fmt(comparativo.sumario.saldo[i] ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TabelaCard>
        </>
      ) : null}
    </ReportShell>
  )
}

/* ================================================================== */
/* 5. Projeção de fim de ano                                           */
/* ================================================================== */

export function ProjecaoAnualReport() {
  const [ano, setAno] = useState(new Date().getFullYear())
  const { dados, loading, error } = useMatrizAnual({ ano, agrupar: 'categoria', base: 'data', cartoes: 'categoria', comparar: true })

  const projecao = dados?.projecao ?? null

  return (
    <ReportShell
      titulo="Projeção de fim de ano"
      descricao="Realizado até agora + projeção com base na média mensal e valores agendados."
      filtros={<AnoFiltro ano={ano} onChange={setAno} />}
      loading={loading}
      error={error}
      exportData={() =>
        projecao
          ? {
              titulo: `Projeção ${ano}`,
              subtitulo: `${projecao.meses_realizados} meses realizados`,
              colunas: ['Indicador', 'Realizado', 'Agendado', 'Média mensal', 'Projetado'],
              linhas: [
                ['Receita', projecao.receita.realizado, projecao.receita.agendado, projecao.receita.media_mensal, projecao.receita.projetado],
                ['Despesa', projecao.despesa.realizado, projecao.despesa.agendado, projecao.despesa.media_mensal, projecao.despesa.projetado],
                ['Investimento', projecao.investimento.realizado, projecao.investimento.agendado, projecao.investimento.media_mensal, projecao.investimento.projetado],
                ['Saldo projetado', '', '', '', projecao.saldo.projetado],
              ],
            }
          : null
      }
    >
      {dados && projecao ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiBox titulo="Receita projetada" valor={fmt(projecao.receita.projetado)} cor={CHART_COLORS.receita} detalhe={`Média mensal ${fmt(projecao.receita.media_mensal)}`} />
            <KpiBox titulo="Despesa projetada" valor={fmt(projecao.despesa.projetado)} cor={CHART_COLORS.despesa} detalhe={`Média mensal ${fmt(projecao.despesa.media_mensal)}`} />
            <KpiBox titulo="Investimento projetado" valor={fmt(projecao.investimento.projetado)} cor={CHART_COLORS.investimento} detalhe={`Média mensal ${fmt(projecao.investimento.media_mensal)}`} />
            <KpiBox
              titulo="Saldo projetado"
              valor={fmt(projecao.saldo.projetado)}
              cor={projecao.saldo.projetado >= 0 ? CHART_COLORS.receita : CHART_COLORS.despesa}
              destaque
              detalhe={`${projecao.meses_realizados} meses realizados`}
            />
          </div>

          <ProjecaoChart dados={dados} />

          <TabelaCard titulo="Detalhamento da projeção" subtitulo="Realizado, agendado e projeção por tipo">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  <th className={thCls}>Indicador</th>
                  <th className={thNumCls}>Realizado</th>
                  <th className={thNumCls}>Agendado</th>
                  <th className={thNumCls}>Média mensal</th>
                  <th className={thNumCls}>Projetado</th>
                </tr>
              </thead>
              <tbody>
                {([
                  ['Receita', projecao.receita],
                  ['Despesa', projecao.despesa],
                  ['Investimento', projecao.investimento],
                ] as const).map(([nome, item]) => (
                  <tr key={nome} className="border-b border-[var(--color-border)]/60">
                    <td className={tdCls}>{nome}</td>
                    <td className={tdNumCls}>{fmt(item.realizado)}</td>
                    <td className={tdNumCls}>{fmt(item.agendado)}</td>
                    <td className={tdNumCls}>{fmt(item.media_mensal)}</td>
                    <td className={`${tdNumCls} font-semibold`}>{fmt(item.projetado)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TabelaCard>

          {dados.insights.length > 0 ? <InsightsPanel insights={dados.insights} /> : null}
        </>
      ) : (
        !loading && <p className="text-sm text-[var(--color-muted)]">Sem dados suficientes para projetar este ano.</p>
      )}
    </ReportShell>
  )
}
