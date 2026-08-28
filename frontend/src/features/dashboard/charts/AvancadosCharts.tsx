import { useMemo } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Layer,
  Rectangle,
  ResponsiveContainer,
  Sankey,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { ChartCard, ChartTooltip } from '@/features/dashboard/charts/ChartCard'
import {
  CHART_COLORS,
  MESES_CURTOS,
  corDaSerie,
  eixoProps,
  formatarEixo,
  gridProps,
} from '@/features/dashboard/charts/chartTheme'
import type { MatrizAnual, MatrizInsight, MatrizLinha } from '@/shared/types/relatorio'
import { formatCurrency } from '@/shared/utils/date'

// ---------------------------------------------------------------------------
// 7. Sankey — fluxo da renda até as categorias
// ---------------------------------------------------------------------------

type NoSankey = { name: string; cor: string }

export function FluxoSankeyChart({ dados, linhas }: { dados: MatrizAnual; linhas: MatrizLinha[] }) {
  const grafico = useMemo(() => {
    const receitas = [...(dados.secoes.Receita ?? [])].filter((item) => item.total > 0).sort((a, b) => b.total - a.total)
    const despesas = [...linhas].filter((item) => item.total > 0).sort((a, b) => b.total - a.total).slice(0, 9)

    if (receitas.length === 0 || despesas.length === 0) return null

    const nos: NoSankey[] = []
    const links: { source: number; target: number; value: number }[] = []

    // Fontes de renda -> nó central
    const indiceCentral = receitas.length
    for (const [indice, receita] of receitas.entries()) {
      nos.push({ name: receita.chave, cor: CHART_COLORS.receita })
      links.push({ source: indice, target: indiceCentral, value: Math.round(receita.total) })
    }

    nos.push({ name: 'Renda total', cor: CHART_COLORS.saldo })

    // Nó central -> categorias de despesa
    const somaDespesas = despesas.reduce((acc, item) => acc + item.total, 0)
    for (const [indice, despesa] of despesas.entries()) {
      nos.push({ name: despesa.chave, cor: corDaSerie(indice) })
      links.push({ source: indiceCentral, target: nos.length - 1, value: Math.round(despesa.total) })
    }

    // Demais despesas agrupadas
    const outras = dados.sumario.totais.despesa - somaDespesas
    if (outras > 1) {
      nos.push({ name: 'Outras despesas', cor: CHART_COLORS.anterior })
      links.push({ source: indiceCentral, target: nos.length - 1, value: Math.round(outras) })
    }

    // Sobra
    const saldo = dados.sumario.totais.saldo
    if (saldo > 1) {
      nos.push({ name: 'Sobrou', cor: CHART_COLORS.receita })
      links.push({ source: indiceCentral, target: nos.length - 1, value: Math.round(saldo) })
    }

    return { nodes: nos, links }
  }, [dados, linhas])

  return (
    <ChartCard
      titulo="Fluxo do dinheiro"
      descricao="Da origem da renda até o destino final"
      vazio={!grafico}
      className="lg:col-span-2"
    >
      {grafico ? (
        <ResponsiveContainer width="100%" height={420}>
          <Sankey
            data={grafico}
            nodePadding={18}
            nodeWidth={12}
            margin={{ top: 10, right: 150, bottom: 10, left: 10 }}
            link={{ stroke: CHART_COLORS.anterior, strokeOpacity: 0.22 }}
            node={<NoCustomizado />}
          >
            <Tooltip content={<ChartTooltip />} />
          </Sankey>
        </ResponsiveContainer>
      ) : null}
    </ChartCard>
  )
}

type NoProps = {
  x?: number
  y?: number
  width?: number
  height?: number
  index?: number
  payload?: { name?: string; value?: number; cor?: string }
  containerWidth?: number
}

function NoCustomizado({ x = 0, y = 0, width = 0, height = 0, payload, containerWidth = 0 }: NoProps) {
  const cor = payload?.cor ?? CHART_COLORS.saldo
  const naDireita = x + width + 160 > containerWidth
  const textoX = naDireita ? x - 8 : x + width + 8
  const ancora = naDireita ? 'end' : 'start'

  return (
    <Layer>
      <Rectangle x={x} y={y} width={width} height={height} fill={cor} fillOpacity={0.9} radius={2} />
      {height > 12 ? (
        <>
          <text x={textoX} y={y + height / 2 - 4} textAnchor={ancora} fontSize={11} fill="#334155">
            {payload?.name}
          </text>
          <text x={textoX} y={y + height / 2 + 9} textAnchor={ancora} fontSize={10} fill="#94a3b8">
            {formatCurrency(payload?.value ?? 0)}
          </text>
        </>
      ) : null}
    </Layer>
  )
}

// ---------------------------------------------------------------------------
// 8. Projeção de fechamento do ano
// ---------------------------------------------------------------------------

export function ProjecaoChart({ dados }: { dados: MatrizAnual }) {
  const projecao = dados.projecao

  const series = useMemo(() => {
    if (!projecao) return []
    const realizados = projecao.meses_realizados

    return MESES_CURTOS.map((mes, indice) => {
      const futuro = indice >= realizados
      const receita = dados.sumario.receita[indice] ?? 0
      const despesa = dados.sumario.despesa[indice] ?? 0

      return {
        mes,
        futuro,
        Receita: futuro ? Math.max(receita, projecao.receita.media_mensal) : receita,
        Despesa: futuro ? Math.max(despesa, projecao.despesa.media_mensal) : despesa,
      }
    })
  }, [dados, projecao])

  if (!projecao) {
    return (
      <ChartCard titulo="Projeção de fechamento" descricao="Disponível apenas durante o ano corrente" vazio>
        <div />
      </ChartCard>
    )
  }

  const cards = [
    { rotulo: 'Receita projetada', valor: projecao.receita.projetado, cor: CHART_COLORS.receita },
    { rotulo: 'Despesa projetada', valor: projecao.despesa.projetado, cor: CHART_COLORS.despesa },
    {
      rotulo: 'Saldo projetado',
      valor: projecao.saldo.projetado,
      cor: projecao.saldo.projetado >= 0 ? CHART_COLORS.saldo : CHART_COLORS.saldoNegativo,
    },
  ]

  return (
    <ChartCard
      titulo="Projeção de fechamento do ano"
      descricao={`${projecao.meses_realizados} meses realizados · meses futuros estimados pela média e pelos lançamentos já agendados`}
      className="lg:col-span-2"
    >
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        {cards.map((card) => (
          <div key={card.rotulo} className="rounded-[var(--radius-sm)] border border-dashed border-[var(--color-border)] p-3">
            <p className="text-xs text-[var(--color-muted)]">{card.rotulo}</p>
            <p className="mt-1 text-lg font-bold tabular-nums" style={{ color: card.cor }}>
              {formatCurrency(card.valor)}
            </p>
          </div>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="mes" {...eixoProps} />
          <YAxis {...eixoProps} tickFormatter={formatarEixo} width={56} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(148, 163, 184, 0.12)' }} />

          <Bar dataKey="Receita" radius={[3, 3, 0, 0]} maxBarSize={22}>
            {series.map((item) => (
              <Cell
                key={`r-${item.mes}`}
                fill={CHART_COLORS.receita}
                fillOpacity={item.futuro ? 0.35 : 1}
                strokeDasharray={item.futuro ? '3 2' : undefined}
                stroke={item.futuro ? CHART_COLORS.receita : undefined}
              />
            ))}
          </Bar>
          <Bar dataKey="Despesa" radius={[3, 3, 0, 0]} maxBarSize={22}>
            {series.map((item) => (
              <Cell
                key={`d-${item.mes}`}
                fill={CHART_COLORS.despesa}
                fillOpacity={item.futuro ? 0.35 : 1}
                strokeDasharray={item.futuro ? '3 2' : undefined}
                stroke={item.futuro ? CHART_COLORS.despesa : undefined}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <p className="mt-2 text-xs text-[var(--color-muted)]">
        Barras esmaecidas representam meses estimados.
      </p>
    </ChartCard>
  )
}

// ---------------------------------------------------------------------------
// 9. Insights automáticos
// ---------------------------------------------------------------------------

const ESTILO_INSIGHT: Record<MatrizInsight['tipo'], { borda: string; fundo: string; icone: string; cor: string }> = {
  positivo: { borda: 'border-emerald-200', fundo: 'bg-emerald-50', icone: '↑', cor: 'text-emerald-700' },
  alerta: { borda: 'border-amber-200', fundo: 'bg-amber-50', icone: '!', cor: 'text-amber-700' },
  info: { borda: 'border-sky-200', fundo: 'bg-sky-50', icone: 'i', cor: 'text-sky-700' },
}

export function InsightsPanel({ insights }: { insights: MatrizInsight[] }) {
  if (insights.length === 0) return null

  return (
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {insights.map((insight, indice) => {
        const estilo = ESTILO_INSIGHT[insight.tipo]
        return (
          <article
            key={`${insight.titulo}-${indice}`}
            className={`flex gap-3 rounded-[var(--radius-md)] border ${estilo.borda} ${estilo.fundo} p-3`}
          >
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold ${estilo.cor}`}
            >
              {estilo.icone}
            </span>
            <div className="min-w-0">
              <h4 className={`text-sm font-semibold ${estilo.cor}`}>{insight.titulo}</h4>
              <p className="mt-0.5 text-xs text-slate-600">{insight.texto}</p>
            </div>
          </article>
        )
      })}
    </section>
  )
}
