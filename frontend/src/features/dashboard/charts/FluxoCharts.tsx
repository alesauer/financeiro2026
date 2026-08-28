import { useMemo } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
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
import type { MatrizAnual, MatrizLinha } from '@/shared/types/relatorio'
import { formatCurrency } from '@/shared/utils/date'

type CliqueMes = (mes: number, tipo: 'Receita' | 'Despesa' | 'Investimento') => void
type CliqueCategoria = (linha: MatrizLinha) => void

// ---------------------------------------------------------------------------
// 1. Combo: receita x despesa (barras) + saldo (linha)
// ---------------------------------------------------------------------------

type FluxoMensalProps = {
  dados: MatrizAnual
  onMesClick?: CliqueMes
}

export function FluxoMensalChart({ dados, onMesClick }: FluxoMensalProps) {
  const comparativo = dados.comparativo

  const series = useMemo(() => {
    return MESES_CURTOS.map((mes, i) => ({
      mes,
      indice: i,
      Receita: dados.sumario.receita[i] ?? 0,
      Despesa: dados.sumario.despesa[i] ?? 0,
      Saldo: dados.sumario.saldo[i] ?? 0,
      [`Despesa ${comparativo?.ano ?? ''}`]: comparativo?.sumario.despesa[i] ?? null,
    }))
  }, [dados, comparativo])

  const vazio = !dados.sumario.receita.some(Boolean) && !dados.sumario.despesa.some(Boolean)

  return (
    <ChartCard
      titulo="Fluxo mensal"
      descricao={comparativo ? `Barras de ${dados.ano} com despesas de ${comparativo.ano} em linha tracejada` : 'Receitas, despesas e saldo por mês'}
      vazio={vazio}
    >
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="mes" {...eixoProps} />
          <YAxis {...eixoProps} tickFormatter={formatarEixo} width={56} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(148, 163, 184, 0.12)' }} />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
          <ReferenceLine y={0} stroke={CHART_COLORS.eixo} strokeWidth={1} />

          <Bar
            dataKey="Receita"
            fill={CHART_COLORS.receita}
            radius={[3, 3, 0, 0]}
            maxBarSize={22}
            cursor={onMesClick ? 'pointer' : undefined}
            onClick={(payload: unknown) => {
              const indice = (payload as { indice?: number } | undefined)?.indice
              if (indice !== undefined) onMesClick?.(indice, 'Receita')
            }}
          />
          <Bar
            dataKey="Despesa"
            fill={CHART_COLORS.despesa}
            radius={[3, 3, 0, 0]}
            maxBarSize={22}
            cursor={onMesClick ? 'pointer' : undefined}
            onClick={(payload: unknown) => {
              const indice = (payload as { indice?: number } | undefined)?.indice
              if (indice !== undefined) onMesClick?.(indice, 'Despesa')
            }}
          />
          <Line
            type="monotone"
            dataKey="Saldo"
            stroke={CHART_COLORS.saldo}
            strokeWidth={2.4}
            dot={{ r: 3, fill: CHART_COLORS.saldo }}
            activeDot={{ r: 5 }}
          />

          {comparativo ? (
            <Line
              type="monotone"
              dataKey={`Despesa ${comparativo.ano}`}
              stroke={CHART_COLORS.anterior}
              strokeWidth={1.8}
              strokeDasharray="5 4"
              dot={false}
              connectNulls
            />
          ) : null}
        </ComposedChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

// ---------------------------------------------------------------------------
// 2. Saldo acumulado (área)
// ---------------------------------------------------------------------------

export function SaldoAcumuladoChart({ dados }: { dados: MatrizAnual }) {
  const series = useMemo(() => {
    let acumulado = 0
    let acumuladoInvest = 0
    return MESES_CURTOS.map((mes, i) => {
      acumulado += dados.sumario.saldo[i] ?? 0
      acumuladoInvest += dados.sumario.investimento[i] ?? 0
      return {
        mes,
        'Saldo acumulado': Number(acumulado.toFixed(2)),
        'Investido acumulado': Number(acumuladoInvest.toFixed(2)),
      }
    })
  }, [dados])

  const vazio = !dados.sumario.saldo.some(Boolean)

  return (
    <ChartCard titulo="Evolução do patrimônio" descricao="Saldo e investimentos acumulados no ano" vazio={vazio}>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
          <defs>
            <linearGradient id="grad-saldo" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_COLORS.saldo} stopOpacity={0.28} />
              <stop offset="100%" stopColor={CHART_COLORS.saldo} stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="grad-invest" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_COLORS.investimento} stopOpacity={0.28} />
              <stop offset="100%" stopColor={CHART_COLORS.investimento} stopOpacity={0.02} />
            </linearGradient>
          </defs>

          <CartesianGrid {...gridProps} />
          <XAxis dataKey="mes" {...eixoProps} />
          <YAxis {...eixoProps} tickFormatter={formatarEixo} width={56} />
          <Tooltip content={<ChartTooltip />} />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
          <ReferenceLine y={0} stroke={CHART_COLORS.eixo} />

          <Area
            type="monotone"
            dataKey="Saldo acumulado"
            stroke={CHART_COLORS.saldo}
            strokeWidth={2.2}
            fill="url(#grad-saldo)"
          />
          <Area
            type="monotone"
            dataKey="Investido acumulado"
            stroke={CHART_COLORS.investimento}
            strokeWidth={2.2}
            fill="url(#grad-invest)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

// ---------------------------------------------------------------------------
// 3. Top categorias (barras horizontais)
// ---------------------------------------------------------------------------

type TopCategoriasProps = {
  linhas: MatrizLinha[]
  titulo?: string
  limite?: number
  onCategoriaClick?: CliqueCategoria
  categoriaSelecionada?: string | null
}

export function TopCategoriasChart({
  linhas,
  titulo = 'Maiores despesas',
  limite = 10,
  onCategoriaClick,
  categoriaSelecionada,
}: TopCategoriasProps) {
  const series = useMemo(() => {
    return [...linhas]
      .sort((a, b) => b.total - a.total)
      .slice(0, limite)
      .map((linha) => ({ nome: linha.chave, total: linha.total, linha }))
      .reverse()
  }, [linhas, limite])

  const total = series.reduce((acc, item) => acc + item.total, 0)

  return (
    <ChartCard
      titulo={titulo}
      descricao={`Top ${series.length} do ano · ${formatCurrency(total)}`}
      vazio={series.length === 0}
    >
      <ResponsiveContainer width="100%" height={Math.max(240, series.length * 30)}>
        <BarChart data={series} layout="vertical" margin={{ top: 4, right: 56, bottom: 4, left: 8 }}>
          <CartesianGrid {...gridProps} horizontal={false} vertical />
          <XAxis type="number" {...eixoProps} tickFormatter={formatarEixo} />
          <YAxis type="category" dataKey="nome" {...eixoProps} width={120} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(148, 163, 184, 0.12)' }} />

          <Bar
            dataKey="total"
            name="Total"
            radius={[0, 4, 4, 0]}
            maxBarSize={20}
            cursor={onCategoriaClick ? 'pointer' : undefined}
            onClick={(payload: unknown) => {
              const linha = (payload as { linha?: MatrizLinha } | undefined)?.linha
              if (linha) onCategoriaClick?.(linha)
            }}
          >
            {series.map((item, indice) => {
              const ativo = !categoriaSelecionada || categoriaSelecionada === item.nome
              return <Cell key={item.nome} fill={corDaSerie(series.length - 1 - indice)} fillOpacity={ativo ? 1 : 0.28} />
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
