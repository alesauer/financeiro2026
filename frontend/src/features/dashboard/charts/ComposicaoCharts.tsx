import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Pie,
  PieChart,
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

const LIMITE_FATIAS = 8

// ---------------------------------------------------------------------------
// 4. Donut de composição, com seletor de mês
// ---------------------------------------------------------------------------

type ComposicaoProps = {
  dados: MatrizAnual
  linhas: MatrizLinha[]
  onCategoriaClick?: (linha: MatrizLinha) => void
}

export function ComposicaoDonutChart({ dados, linhas, onCategoriaClick }: ComposicaoProps) {
  // -1 representa o ano inteiro
  const [mes, setMes] = useState(-1)

  const series = useMemo(() => {
    const bruto = linhas
      .map((linha) => ({
        nome: linha.chave,
        valor: mes === -1 ? linha.total : (linha.valores[mes] ?? 0),
        linha,
      }))
      .filter((item) => item.valor > 0)
      .sort((a, b) => b.valor - a.valor)

    if (bruto.length <= LIMITE_FATIAS) return bruto

    const principais = bruto.slice(0, LIMITE_FATIAS)
    const restante = bruto.slice(LIMITE_FATIAS).reduce((acc, item) => acc + item.valor, 0)
    return [...principais, { nome: `Outros (${bruto.length - LIMITE_FATIAS})`, valor: restante, linha: null }]
  }, [linhas, mes])

  const total = series.reduce((acc, item) => acc + item.valor, 0)

  const seletor = (
    <select
      value={mes}
      onChange={(event) => setMes(Number(event.target.value))}
      className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-transparent px-2 py-1 text-xs text-[var(--color-text)]"
    >
      <option value={-1}>Ano inteiro</option>
      {dados.meses.map((nome, indice) => (
        <option key={nome} value={indice}>
          {nome}
        </option>
      ))}
    </select>
  )

  return (
    <ChartCard titulo="Composição das despesas" acao={seletor} vazio={series.length === 0}>
      <div className="relative">
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={series}
              dataKey="valor"
              nameKey="nome"
              innerRadius="58%"
              outerRadius="82%"
              paddingAngle={2}
              cursor={onCategoriaClick ? 'pointer' : undefined}
              onClick={(payload: unknown) => {
                const linha = (payload as { linha?: MatrizLinha | null } | undefined)?.linha
                if (linha) onCategoriaClick?.(linha)
              }}
            >
              {series.map((item, indice) => (
                <Cell key={item.nome} fill={corDaSerie(indice)} stroke="#fff" strokeWidth={2} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
            <Legend
              iconType="circle"
              layout="vertical"
              align="right"
              verticalAlign="middle"
              wrapperStyle={{ fontSize: 11, lineHeight: '18px', maxWidth: 150 }}
            />
          </PieChart>
        </ResponsiveContainer>

        {/* Total no centro do donut */}
        <div className="pointer-events-none absolute inset-y-0 left-0 flex w-[calc(100%-150px)] flex-col items-center justify-center">
          <span className="text-[11px] uppercase tracking-wide text-[var(--color-muted)]">Total</span>
          <span className="text-lg font-bold tabular-nums text-[var(--color-text)]">{formatCurrency(total)}</span>
        </div>
      </div>
    </ChartCard>
  )
}

// ---------------------------------------------------------------------------
// 5. Barras empilhadas 100% — evolução do mix de gastos
// ---------------------------------------------------------------------------

export function MixMensalChart({ linhas }: { linhas: MatrizLinha[] }) {
  const [percentual, setPercentual] = useState(true)

  const { series, categorias } = useMemo(() => {
    const principais = [...linhas].sort((a, b) => b.total - a.total).slice(0, LIMITE_FATIAS)
    const restantes = [...linhas].sort((a, b) => b.total - a.total).slice(LIMITE_FATIAS)

    const nomes = principais.map((linha) => linha.chave)
    if (restantes.length > 0) nomes.push('Outros')

    const dados = MESES_CURTOS.map((mes, indice) => {
      const linha: Record<string, string | number> = { mes }

      for (const item of principais) {
        linha[item.chave] = item.valores[indice] ?? 0
      }
      if (restantes.length > 0) {
        linha.Outros = restantes.reduce((acc, item) => acc + (item.valores[indice] ?? 0), 0)
      }

      if (percentual) {
        const total = nomes.reduce((acc, nome) => acc + Number(linha[nome] ?? 0), 0)
        if (total > 0) {
          for (const nome of nomes) {
            linha[nome] = Number(((Number(linha[nome] ?? 0) / total) * 100).toFixed(2))
          }
        }
      }

      return linha
    })

    return { series: dados, categorias: nomes }
  }, [linhas, percentual])

  const alternar = (
    <button
      type="button"
      onClick={() => setPercentual((prev) => !prev)}
      className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-text)] transition-colors hover:bg-slate-50"
    >
      {percentual ? 'Ver em R$' : 'Ver em %'}
    </button>
  )

  return (
    <ChartCard
      titulo="Mix de gastos mês a mês"
      descricao={percentual ? 'Participação relativa de cada categoria' : 'Valores absolutos por categoria'}
      acao={alternar}
      vazio={categorias.length === 0}
    >
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="mes" {...eixoProps} />
          <YAxis
            {...eixoProps}
            width={56}
            tickFormatter={(valor: number) => (percentual ? `${valor}%` : formatarEixo(valor))}
            domain={percentual ? [0, 100] : undefined}
          />
          <Tooltip
            content={percentual ? <PercentualTooltip /> : <ChartTooltip mostrarTotal />}
            cursor={{ fill: 'rgba(148, 163, 184, 0.12)' }}
          />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />

          {categorias.map((nome, indice) => (
            <Bar key={nome} dataKey={nome} stackId="mix" fill={corDaSerie(indice)} maxBarSize={34} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

type TooltipPayload = { name?: string | number; value?: number | string; color?: string }

function PercentualTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: TooltipPayload[]
  label?: string | number
}) {
  if (!active || !payload?.length) return null

  const itens = payload.filter((item) => Number(item.value ?? 0) > 0).reverse()
  if (itens.length === 0) return null

  return (
    <div className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2 shadow-lg">
      <p className="mb-1.5 text-xs font-semibold text-[var(--color-text)]">{label}</p>
      <ul className="space-y-1">
        {itens.map((item, indice) => (
          <li key={indice} className="flex items-center gap-2 text-xs">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="text-[var(--color-muted)]">{item.name}</span>
            <span className="ml-auto font-semibold tabular-nums text-[var(--color-text)]">
              {Number(item.value).toFixed(1).replace('.', ',')}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 6. Waterfall — para onde foi o dinheiro
// ---------------------------------------------------------------------------

type BarraCascata = {
  nome: string
  base: number
  valor: number
  exibicao: number
  cor: string
  ehTotal: boolean
}

export function WaterfallChart({ dados, linhas }: { dados: MatrizAnual; linhas: MatrizLinha[] }) {
  const series = useMemo<BarraCascata[]>(() => {
    const receita = dados.sumario.totais.receita
    if (!receita) return []

    const principais = [...linhas].sort((a, b) => b.total - a.total).slice(0, 7)
    const soma = principais.reduce((acc, item) => acc + item.total, 0)
    const outros = dados.sumario.totais.despesa - soma

    const barras: BarraCascata[] = [
      { nome: 'Receita', base: 0, valor: receita, exibicao: receita, cor: CHART_COLORS.receita, ehTotal: true },
    ]

    let acumulado = receita

    for (const [indice, item] of principais.entries()) {
      acumulado -= item.total
      barras.push({
        nome: item.chave,
        base: acumulado,
        valor: item.total,
        exibicao: -item.total,
        cor: corDaSerie(indice),
        ehTotal: false,
      })
    }

    if (outros > 1) {
      acumulado -= outros
      barras.push({
        nome: 'Outras despesas',
        base: acumulado,
        valor: outros,
        exibicao: -outros,
        cor: CHART_COLORS.anterior,
        ehTotal: false,
      })
    }

    barras.push({
      nome: 'Saldo',
      base: 0,
      valor: acumulado,
      exibicao: acumulado,
      cor: acumulado >= 0 ? CHART_COLORS.saldo : CHART_COLORS.saldoNegativo,
      ehTotal: true,
    })

    return barras
  }, [dados, linhas])

  return (
    <ChartCard
      titulo="Para onde foi o dinheiro"
      descricao={`Da receita ao saldo final de ${dados.ano}`}
      vazio={series.length === 0}
    >
      <ResponsiveContainer width="100%" height={330}>
        <BarChart data={series} margin={{ top: 24, right: 8, bottom: 40, left: 8 }}>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="nome" {...eixoProps} angle={-35} textAnchor="end" height={70} interval={0} />
          <YAxis {...eixoProps} tickFormatter={formatarEixo} width={56} />
          <Tooltip content={<CascataTooltip />} cursor={{ fill: 'rgba(148, 163, 184, 0.12)' }} />

          {/* Barra invisível que posiciona a barra visível na altura correta */}
          <Bar dataKey="base" stackId="cascata" fill="transparent" isAnimationActive={false} />
          <Bar dataKey="valor" stackId="cascata" radius={[3, 3, 0, 0]} maxBarSize={54}>
            {series.map((item) => (
              <Cell key={item.nome} fill={item.cor} />
            ))}
            <LabelList
              dataKey="exibicao"
              position="top"
              fontSize={10}
              formatter={(valor: number) => formatarEixo(valor)}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

function CascataTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: { payload?: BarraCascata }[]
}) {
  if (!active || !payload?.length) return null

  const item = payload[0]?.payload
  if (!item) return null

  return (
    <div className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2 shadow-lg">
      <p className="text-xs font-semibold text-[var(--color-text)]">{item.nome}</p>
      <p className="mt-1 text-sm font-bold tabular-nums" style={{ color: item.cor }}>
        {item.ehTotal ? '' : '− '}
        {formatCurrency(item.valor)}
      </p>
    </div>
  )
}
