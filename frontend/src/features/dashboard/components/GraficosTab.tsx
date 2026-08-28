import { useMemo, useRef, useState } from 'react'

import {
  FluxoSankeyChart,
  InsightsPanel,
  ProjecaoChart,
} from '@/features/dashboard/charts/AvancadosCharts'
import {
  ComposicaoDonutChart,
  MixMensalChart,
  WaterfallChart,
} from '@/features/dashboard/charts/ComposicaoCharts'
import {
  FluxoMensalChart,
  SaldoAcumuladoChart,
  TopCategoriasChart,
} from '@/features/dashboard/charts/FluxoCharts'
import { KpiCard } from '@/features/dashboard/charts/KpiCard'
import { CHART_COLORS } from '@/features/dashboard/charts/chartTheme'
import { exportarGraficosPdf } from '@/features/dashboard/utils/exportarGraficos'
import type { MatrizAnual, MatrizLinha } from '@/shared/types/relatorio'
import { getErrorMessage } from '@/shared/utils/error'

export type Granularidade = 'ano' | 'trimestre' | 'mes'

type Props = {
  dados: MatrizAnual
  onDrillDown: (params: { mes: number | null; tipo: 'Receita' | 'Despesa' | 'Investimento'; linha?: MatrizLinha | null }) => void
}

const TRIMESTRES = [
  { rotulo: '1º trimestre', meses: [0, 1, 2] },
  { rotulo: '2º trimestre', meses: [3, 4, 5] },
  { rotulo: '3º trimestre', meses: [6, 7, 8] },
  { rotulo: '4º trimestre', meses: [9, 10, 11] },
]

/** Zera os meses fora do recorte, preservando o formato de 12 posições. */
function recortarSerie(serie: number[], meses: number[] | null) {
  if (!meses) return serie
  return serie.map((valor, indice) => (meses.includes(indice) ? valor : 0))
}

function recortarLinhas(linhas: MatrizLinha[], meses: number[] | null): MatrizLinha[] {
  if (!meses) return linhas
  return linhas
    .map((linha) => {
      const valores = recortarSerie(linha.valores, meses)
      return { ...linha, valores, total: Number(valores.reduce((acc, v) => acc + v, 0).toFixed(2)) }
    })
    .filter((linha) => linha.total > 0)
}

export function GraficosTab({ dados, onDrillDown }: Props) {
  const [granularidade, setGranularidade] = useState<Granularidade>('ano')
  const [periodo, setPeriodo] = useState(0)
  const [categoriaFoco, setCategoriaFoco] = useState<string | null>(null)
  const [exportando, setExportando] = useState(false)
  const [erroExport, setErroExport] = useState<string | null>(null)

  const areaRef = useRef<HTMLDivElement | null>(null)

  const mesAtual = useMemo(() => {
    const hoje = new Date()
    return hoje.getFullYear() === dados.ano ? hoje.getMonth() : 11
  }, [dados.ano])

  // Meses considerados no recorte atual
  const mesesRecorte = useMemo<number[] | null>(() => {
    if (granularidade === 'ano') return null
    if (granularidade === 'trimestre') return TRIMESTRES[periodo]?.meses ?? null
    return [periodo]
  }, [granularidade, periodo])

  // Dados após aplicar recorte de período e cross-filter de categoria
  const visao = useMemo(() => {
    const despesasBase = [
      ...(dados.secoes.Despesa ?? []),
      ...(dados.secoes.Cartoes ?? []),
    ]

    const despesas = recortarLinhas(despesasBase, mesesRecorte)
    const receitas = recortarLinhas(dados.secoes.Receita ?? [], mesesRecorte)

    const sumario = {
      ...dados.sumario,
      receita: recortarSerie(dados.sumario.receita, mesesRecorte),
      despesa: recortarSerie(dados.sumario.despesa, mesesRecorte),
      investimento: recortarSerie(dados.sumario.investimento, mesesRecorte),
      saldo: recortarSerie(dados.sumario.saldo, mesesRecorte),
    }

    const totais = {
      receita: Number(sumario.receita.reduce((a, b) => a + b, 0).toFixed(2)),
      despesa: Number(sumario.despesa.reduce((a, b) => a + b, 0).toFixed(2)),
      investimento: Number(sumario.investimento.reduce((a, b) => a + b, 0).toFixed(2)),
      saldo: Number(sumario.saldo.reduce((a, b) => a + b, 0).toFixed(2)),
    }

    const recortado: MatrizAnual = {
      ...dados,
      sumario: { ...sumario, totais },
      secoes: { ...dados.secoes, Despesa: despesas, Receita: receitas },
    }

    const despesasFiltradas = categoriaFoco ? despesas.filter((item) => item.chave === categoriaFoco) : despesas

    return { matriz: recortado, despesas, despesasFiltradas, receitas }
  }, [dados, mesesRecorte, categoriaFoco])

  const variacoes = granularidade === 'ano' ? dados.comparativo?.variacoes : undefined
  const anoComparado = dados.comparativo?.ano

  const handleCategoriaClick = (linha: MatrizLinha) => {
    setCategoriaFoco((prev) => (prev === linha.chave ? null : linha.chave))
  }

  const handleExportarPdf = async () => {
    if (!areaRef.current) return

    setExportando(true)
    setErroExport(null)
    try {
      await exportarGraficosPdf(areaRef.current, `Dashboard financeiro ${dados.ano}`, `dashboard-${dados.ano}`)
    } catch (err) {
      setErroExport(getErrorMessage(err, 'Não foi possível exportar os gráficos.'))
    } finally {
      setExportando(false)
    }
  }

  const totais = visao.matriz.sumario.totais

  return (
    <div className="space-y-5">
      {/* ---------------------- Controles ---------------------- */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-1">
          {(['ano', 'trimestre', 'mes'] as Granularidade[]).map((opcao) => (
            <button
              key={opcao}
              type="button"
              onClick={() => {
                setGranularidade(opcao)
                setPeriodo(opcao === 'mes' ? mesAtual : 0)
              }}
              className={`rounded px-3 py-1.5 text-sm capitalize transition-colors ${
                granularidade === opcao ? 'bg-sky-600 text-white' : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
              }`}
            >
              {opcao === 'mes' ? 'Mês' : opcao === 'trimestre' ? 'Trimestre' : 'Ano'}
            </button>
          ))}
        </div>

        {granularidade !== 'ano' ? (
          <select
            value={periodo}
            onChange={(event) => setPeriodo(Number(event.target.value))}
            className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)]"
          >
            {granularidade === 'trimestre'
              ? TRIMESTRES.map((item, indice) => (
                  <option key={item.rotulo} value={indice}>
                    {item.rotulo}
                  </option>
                ))
              : dados.meses.map((nome, indice) => (
                  <option key={nome} value={indice}>
                    {nome}
                  </option>
                ))}
          </select>
        ) : null}

        {categoriaFoco ? (
          <button
            type="button"
            onClick={() => setCategoriaFoco(null)}
            className="flex items-center gap-2 rounded-full border border-sky-300 bg-sky-50 px-3 py-1.5 text-sm text-sky-800 transition-colors hover:bg-sky-100"
          >
            Filtrando: <strong>{categoriaFoco}</strong>
            <span aria-hidden>&times;</span>
          </button>
        ) : null}

        <button
          type="button"
          onClick={handleExportarPdf}
          disabled={exportando}
          className="ml-auto rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-sm font-medium text-[var(--color-text)] transition-colors hover:bg-slate-50 disabled:opacity-50"
        >
          {exportando ? 'Gerando PDF...' : 'Exportar PDF'}
        </button>
      </div>

      {erroExport ? (
        <div className="rounded-[var(--radius-md)] border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
          {erroExport}
        </div>
      ) : null}

      <InsightsPanel insights={dados.insights ?? []} />

      {/* ---------------------- Gráficos ---------------------- */}
      <div ref={areaRef} className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            titulo="Receitas"
            valor={totais.receita}
            serie={visao.matriz.sumario.receita}
            cor={CHART_COLORS.receita}
            variacao={variacoes?.receita}
            anoComparado={anoComparado}
          />
          <KpiCard
            titulo="Despesas"
            valor={totais.despesa}
            serie={visao.matriz.sumario.despesa}
            cor={CHART_COLORS.despesa}
            variacao={variacoes?.despesa}
            anoComparado={anoComparado}
            inverterCorVariacao
          />
          <KpiCard
            titulo="Saldo"
            valor={totais.saldo}
            serie={visao.matriz.sumario.saldo}
            cor={totais.saldo >= 0 ? CHART_COLORS.saldo : CHART_COLORS.saldoNegativo}
            variacao={variacoes?.saldo}
            anoComparado={anoComparado}
          />
          <KpiCard
            titulo="Investimentos"
            valor={totais.investimento}
            serie={visao.matriz.sumario.investimento}
            cor={CHART_COLORS.investimento}
            variacao={variacoes?.investimento}
            anoComparado={anoComparado}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <FluxoMensalChart
            dados={visao.matriz}
            onMesClick={(mes, tipo) => onDrillDown({ mes, tipo })}
          />
          <SaldoAcumuladoChart dados={visao.matriz} />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <TopCategoriasChart
            linhas={visao.despesas}
            onCategoriaClick={handleCategoriaClick}
            categoriaSelecionada={categoriaFoco}
          />
          <ComposicaoDonutChart
            dados={visao.matriz}
            linhas={visao.despesas}
            onCategoriaClick={handleCategoriaClick}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <MixMensalChart linhas={visao.despesasFiltradas} />
          <WaterfallChart dados={visao.matriz} linhas={visao.despesas} />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <FluxoSankeyChart dados={visao.matriz} linhas={visao.despesas} />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <ProjecaoChart dados={dados} />
        </div>
      </div>
    </div>
  )
}
