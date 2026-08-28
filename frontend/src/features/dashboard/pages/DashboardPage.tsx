import { Suspense, lazy, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { PlanilhaAnual } from '@/features/dashboard/components/PlanilhaAnual'
import type { CelulaClickPayload } from '@/features/dashboard/components/PlanilhaAnual'
import { useMatrizAnual } from '@/features/dashboard/hooks/useMatrizAnual'
import { exportarMatrizAnual } from '@/features/dashboard/utils/exportarPlanilha'
import type {
  MatrizAgrupamento,
  MatrizBase,
  MatrizCartoesModo,
  MatrizLinha,
} from '@/shared/types/relatorio'
import { formatCurrency } from '@/shared/utils/date'
import { getErrorMessage } from '@/shared/utils/error'

// A aba de gráficos carrega o Recharts sob demanda, mantendo o bundle inicial leve.
const GraficosTab = lazy(() =>
  import('@/features/dashboard/components/GraficosTab').then((mod) => ({ default: mod.GraficosTab })),
)

type Aba = 'visao' | 'graficos' | 'planilha'

const ABAS: { id: Aba; rotulo: string }[] = [
  { id: 'visao', rotulo: 'Visão geral' },
  { id: 'graficos', rotulo: 'Gráficos' },
  { id: 'planilha', rotulo: 'Planilha' },
]

function ultimoDiaDoMes(ano: number, mes: number) {
  return new Date(ano, mes + 1, 0).getDate()
}

export function DashboardPage() {
  const navigate = useNavigate()

  const [aba, setAba] = useState<Aba>('visao')
  const [ano, setAno] = useState(() => new Date().getFullYear())
  const [agrupar, setAgrupar] = useState<MatrizAgrupamento>('categoria')
  const [base, setBase] = useState<MatrizBase>('data')
  const [cartoes, setCartoes] = useState<MatrizCartoesModo>('categoria')

  const [exportando, setExportando] = useState(false)
  const [erroLocal, setErroLocal] = useState<string | null>(null)

  const { dados, loading, error } = useMatrizAnual({ ano, agrupar, base, cartoes, comparar: true })

  const kpis = useMemo(() => {
    const totais = dados?.sumario.totais
    const variacoes = dados?.comparativo?.variacoes
    return [
      { titulo: 'Receitas', valor: totais?.receita ?? 0, cor: 'text-emerald-600', variacao: variacoes?.receita },
      { titulo: 'Despesas', valor: totais?.despesa ?? 0, cor: 'text-rose-600', variacao: variacoes?.despesa },
      {
        titulo: 'Saldo',
        valor: totais?.saldo ?? 0,
        cor: (totais?.saldo ?? 0) < 0 ? 'text-rose-600' : 'text-sky-600',
        variacao: variacoes?.saldo,
      },
      {
        titulo: 'Investimentos',
        valor: totais?.investimento ?? 0,
        cor: 'text-violet-600',
        variacao: variacoes?.investimento,
      },
    ]
  }, [dados])

  const handleExportar = async () => {
    if (!dados) return

    setExportando(true)
    setErroLocal(null)
    try {
      await exportarMatrizAnual(dados)
    } catch (err) {
      setErroLocal(getErrorMessage(err, 'Não foi possível exportar a planilha.'))
    } finally {
      setExportando(false)
    }
  }

  const irParaTransacoes = ({
    mes,
    tipo,
    linha,
    apenasCartao,
  }: {
    mes: number | null
    tipo: 'Receita' | 'Despesa' | 'Investimento'
    linha?: MatrizLinha | null
    apenasCartao?: boolean
  }) => {
    const params = new URLSearchParams({ tipo })

    if (mes === null) {
      params.set('inicio', `${ano}-01-01`)
      params.set('fim', `${ano}-12-31`)
    } else {
      const mesFormatado = String(mes + 1).padStart(2, '0')
      params.set('inicio', `${ano}-${mesFormatado}-01`)
      params.set('fim', `${ano}-${mesFormatado}-${String(ultimoDiaDoMes(ano, mes)).padStart(2, '0')}`)
    }

    if (apenasCartao) {
      params.set('cartao_credito', 'true')
    } else if (linha?.categoria_id) {
      params.set('categoria_id', String(linha.categoria_id))
    }

    navigate(`/transacoes?${params.toString()}`)
  }

  const handleCelulaClick = ({ secao, tipo, mes, linha }: CelulaClickPayload) => {
    irParaTransacoes({ mes, tipo, linha, apenasCartao: secao === 'Cartoes' })
  }

  const mensagemErro = error ?? erroLocal

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold text-[var(--color-text)]">Dashboard</h2>
          <p className="text-sm text-[var(--color-muted)]">
            Visão consolidada de {ano}. Clique nos valores para ver as transações do período.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)]">
            <button
              type="button"
              onClick={() => setAno((prev) => prev - 1)}
              className="px-3 py-2 text-sm text-[var(--color-muted)] transition-colors hover:text-[var(--color-text)]"
              aria-label="Ano anterior"
            >
              &#9664;
            </button>
            <input
              type="number"
              value={ano}
              onChange={(event) => setAno(Number(event.target.value) || new Date().getFullYear())}
              className="w-20 border-x border-[var(--color-border)] bg-transparent px-2 py-2 text-center text-sm font-semibold text-[var(--color-text)] outline-none"
            />
            <button
              type="button"
              onClick={() => setAno((prev) => prev + 1)}
              className="px-3 py-2 text-sm text-[var(--color-muted)] transition-colors hover:text-[var(--color-text)]"
              aria-label="Próximo ano"
            >
              &#9654;
            </button>
          </div>

          {aba === 'planilha' ? (
            <>
              <div className="flex rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-1">
                {(['categoria', 'descricao'] as MatrizAgrupamento[]).map((opcao) => (
                  <button
                    key={opcao}
                    type="button"
                    onClick={() => setAgrupar(opcao)}
                    className={`rounded px-3 py-1.5 text-sm transition-colors ${
                      agrupar === opcao ? 'bg-sky-600 text-white' : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
                    }`}
                  >
                    {opcao === 'categoria' ? 'Categoria' : 'Descrição'}
                  </button>
                ))}
              </div>

              <label className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)]">
                <input
                  type="checkbox"
                  checked={base === 'competencia'}
                  onChange={(event) => setBase(event.target.checked ? 'competencia' : 'data')}
                />
                Competência da fatura
              </label>

              <label className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)]">
                <input
                  type="checkbox"
                  checked={cartoes === 'separado'}
                  onChange={(event) => setCartoes(event.target.checked ? 'separado' : 'categoria')}
                />
                Cartões em bloco
              </label>

              <button
                type="button"
                onClick={handleExportar}
                disabled={!dados || exportando}
                className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-sm font-medium text-[var(--color-text)] transition-colors hover:bg-slate-50 disabled:opacity-50"
              >
                {exportando ? 'Exportando...' : 'Exportar XLSX'}
              </button>
            </>
          ) : null}
        </div>
      </header>

      {/* ------------------------- Abas ------------------------- */}
      <nav className="flex gap-1 border-b border-[var(--color-border)]">
        {ABAS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setAba(item.id)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              aba === item.id
                ? 'border-sky-600 text-sky-700'
                : 'border-transparent text-[var(--color-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            {item.rotulo}
          </button>
        ))}
      </nav>

      {mensagemErro ? (
        <div className="rounded-[var(--radius-md)] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {mensagemErro}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-10 text-center text-sm text-[var(--color-muted)]">
          Carregando dados...
        </div>
      ) : !dados ? null : aba === 'visao' ? (
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-4">
            {kpis.map((kpi) => (
              <article
                key={kpi.titulo}
                className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
              >
                <h3 className="text-sm font-medium text-[var(--color-muted)]">{kpi.titulo}</h3>
                <p className={`mt-2 text-2xl font-bold tabular-nums ${kpi.cor}`}>{formatCurrency(kpi.valor)}</p>
                {kpi.variacao !== null && kpi.variacao !== undefined ? (
                  <p className="mt-1 text-xs text-[var(--color-muted)]">
                    {kpi.variacao > 0 ? '▲' : kpi.variacao < 0 ? '▼' : '—'} {Math.abs(kpi.variacao).toFixed(1).replace('.', ',')}% vs{' '}
                    {dados.comparativo?.ano}
                  </p>
                ) : null}
              </article>
            ))}
          </div>

          <ResumoVisaoGeral dados={dados} onVerTudo={() => setAba('graficos')} />
        </div>
      ) : aba === 'graficos' ? (
        <Suspense
          fallback={
            <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-10 text-center text-sm text-[var(--color-muted)]">
              Carregando gráficos...
            </div>
          }
        >
          <GraficosTab dados={dados} onDrillDown={irParaTransacoes} />
        </Suspense>
      ) : (
        <PlanilhaAnual dados={dados} onCelulaClick={handleCelulaClick} />
      )}
    </section>
  )
}

/** Painel enxuto da aba inicial: insights + ranking das maiores despesas. */
function ResumoVisaoGeral({
  dados,
  onVerTudo,
}: {
  dados: import('@/shared/types/relatorio').MatrizAnual
  onVerTudo: () => void
}) {
  const topDespesas = useMemo(() => {
    const linhas = [...(dados.secoes.Despesa ?? []), ...(dados.secoes.Cartoes ?? [])]
    return linhas.sort((a, b) => b.total - a.total).slice(0, 8)
  }, [dados])

  const maior = topDespesas[0]?.total ?? 1

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--color-text)]">Maiores despesas do ano</h3>
          <button
            type="button"
            onClick={onVerTudo}
            className="text-xs font-medium text-sky-600 transition-colors hover:text-sky-800"
          >
            Ver gráficos
          </button>
        </div>

        {topDespesas.length === 0 ? (
          <p className="py-6 text-center text-sm text-[var(--color-muted)]">Sem despesas no período.</p>
        ) : (
          <ul className="space-y-2.5">
            {topDespesas.map((linha) => (
              <li key={linha.chave}>
                <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
                  <span className="truncate text-[var(--color-text)]">{linha.chave}</span>
                  <span className="shrink-0 font-semibold tabular-nums text-[var(--color-text)]">
                    {formatCurrency(linha.total)}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-rose-500"
                    style={{ width: `${Math.max(2, (linha.total / maior) * 100)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <h3 className="mb-3 text-sm font-semibold text-[var(--color-text)]">Destaques</h3>
        {(dados.insights ?? []).length === 0 ? (
          <p className="py-6 text-center text-sm text-[var(--color-muted)]">Sem destaques no período.</p>
        ) : (
          <ul className="space-y-3">
            {(dados.insights ?? []).slice(0, 5).map((insight, indice) => (
              <li key={`${insight.titulo}-${indice}`} className="flex gap-2.5">
                <span
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                    insight.tipo === 'positivo'
                      ? 'bg-emerald-500'
                      : insight.tipo === 'alerta'
                        ? 'bg-amber-500'
                        : 'bg-sky-500'
                  }`}
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--color-text)]">{insight.titulo}</p>
                  <p className="text-xs text-[var(--color-muted)]">{insight.texto}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
