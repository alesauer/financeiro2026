import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  AlertCircle,
  BarChart2,
  ChevronLeft,
  ChevronRight,
  TrendingDown,
  Wallet,
} from 'lucide-react'

import { useAuth } from '@/app/providers/AuthProvider'
import { MetasPageHeader } from '@/features/metas/components/MetasPageHeader'
import { metasService } from '@/features/metas/services/metasService'
import type { AnalisesMetasResponse } from '@/features/metas/types/metas'
import { MESES_LISTA, navegarPeriodo } from '@/features/metas/utils/calculosMetas'
import { formatCurrency } from '@/shared/utils/date'
import { getErrorMessage } from '@/shared/utils/error'

type AbaAnalise = 'planejado_realizado' | 'evolucao_categoria' | 'tendencia' | 'comparativo'

const CORES_LINHAS = ['#059669', '#0284c7', '#d97706', '#e11d48', '#7c3aed', '#0d9488']

export function MetasAnalisesPage() {
  const { token } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  const hoje = new Date()
  const [mes, setMes] = useState<number>(() => Number(searchParams.get('mes')) || hoje.getMonth() + 1)
  const [ano, setAno] = useState<number>(() => Number(searchParams.get('ano')) || hoje.getFullYear())
  const [aba, setAba] = useState<AbaAnalise>('planejado_realizado')

  const [dados, setDados] = useState<AnalisesMetasResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const resp = await metasService.analises(token, mes, ano)
      setDados(resp)
    } catch (err) {
      setError(getErrorMessage(err, 'Não foi possível carregar as análises de metas.'))
    } finally {
      setLoading(false)
    }
  }, [token, mes, ano])

  useEffect(() => {
    carregar()
  }, [carregar])

  const atualizarPeriodo = (novoMes: number, novoAno: number) => {
    setMes(novoMes)
    setAno(novoAno)
    setSearchParams({ mes: String(novoMes), ano: String(novoAno) }, { replace: true })
  }

  const opcoesPeriodo = (() => {
    const anos = [ano - 1, ano, ano + 1]
    const lista: { label: string; mes: number; ano: number; value: string }[] = []
    for (const a of anos) {
      for (const m of MESES_LISTA) {
        lista.push({
          label: `${m.nome} / ${a}`,
          mes: m.numero,
          ano: a,
          value: `${a}-${String(m.numero).padStart(2, '0')}`,
        })
      }
    }
    return lista
  })()

  const abas: { id: AbaAnalise; label: string }[] = [
    { id: 'planejado_realizado', label: 'Planejado x Realizado' },
    { id: 'evolucao_categoria', label: 'Evolução por Categoria' },
    { id: 'tendencia', label: 'Tendência' },
    { id: 'comparativo', label: 'Comparativo Mensal' },
  ]

  const resumo = dados?.resumo_periodo

  return (
    <section className="space-y-6">
      <MetasPageHeader subtitulo="Análises" />

      {/* Subnavegacao de abas + Seletor de Mes/Ano */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] pb-3">
        <div className="flex flex-wrap items-center gap-1">
          {abas.map((item) => {
            const ativo = aba === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setAba(item.id)}
                className={`-mb-3.5 border-b-2 px-3.5 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                  ativo
                    ? 'border-emerald-600 text-emerald-700'
                    : 'border-transparent text-[var(--color-muted)] hover:text-[var(--color-text)]'
                }`}
              >
                {item.label}
              </button>
            )
          })}
        </div>

        <div className="inline-flex items-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-0.5 shadow-2xs">
          <button
            type="button"
            onClick={() => {
              const p = navegarPeriodo(mes, ano, -1)
              atualizarPeriodo(p.mes, p.ano)
            }}
            className="rounded-md p-1 text-[var(--color-muted)] hover:bg-slate-100 hover:text-[var(--color-text)] cursor-pointer"
            aria-label="Mês anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <select
            value={`${ano}-${String(mes).padStart(2, '0')}`}
            onChange={(e) => {
              const [y, m] = e.target.value.split('-').map(Number)
              if (y && m) atualizarPeriodo(m, y)
            }}
            className="bg-transparent px-2.5 py-1 text-xs font-semibold text-[var(--color-text)] outline-none cursor-pointer"
          >
            {opcoesPeriodo.map((op) => (
              <option key={op.value} value={op.value}>
                {op.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => {
              const p = navegarPeriodo(mes, ano, 1)
              atualizarPeriodo(p.mes, p.ano)
            }}
            className="rounded-md p-1 text-[var(--color-muted)] hover:bg-slate-100 hover:text-[var(--color-text)] cursor-pointer"
            aria-label="Próximo mês"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {loading && !dados ? (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-12 text-center text-sm text-[var(--color-muted)]">
          Carregando análises...
        </div>
      ) : !dados ? null : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          {/* Painel Esquerdo (8 colunas): Grafico da Aba */}
          <div className="space-y-4 lg:col-span-8">
            {aba === 'planejado_realizado' ? (
              <article className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-2xs">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-[var(--color-text)]">
                    Planejado x Realizado por Categoria
                  </h3>
                  <div className="flex items-center gap-4 text-xs text-[var(--color-muted)]">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-xs bg-slate-300" />
                      Planejado
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-xs bg-emerald-600" />
                      Realizado
                    </span>
                  </div>
                </div>

                {dados.planejado_vs_realizado.length === 0 ? (
                  <p className="py-16 text-center text-xs text-[var(--color-muted)]">
                    Nenhuma meta cadastrada para comparar no período.
                  </p>
                ) : (
                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dados.planejado_vs_realizado} barGap={4}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis
                          dataKey="nome_curto"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 11, fill: '#64748b' }}
                        />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 11, fill: '#64748b' }}
                          tickFormatter={(v) => Number(v).toLocaleString('pt-BR')}
                        />
                        <Tooltip
                          formatter={(val: any) => formatCurrency(Number(val))}
                          contentStyle={{
                            borderRadius: '8px',
                            border: '1px solid #e2e8f0',
                            fontSize: '12px',
                          }}
                        />
                        <Bar
                          dataKey="planejado"
                          name="Planejado"
                          fill="#cbd5e1"
                          radius={[4, 4, 0, 0]}
                          maxBarSize={28}
                        />
                        <Bar
                          dataKey="realizado"
                          name="Realizado"
                          fill="#059669"
                          radius={[4, 4, 0, 0]}
                          maxBarSize={28}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </article>
            ) : aba === 'evolucao_categoria' ? (
              <article className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-2xs">
                <div className="mb-4">
                  <h3 className="text-sm font-bold text-[var(--color-text)]">
                    Evolução Mensal por Categoria (Últimos 6 meses)
                  </h3>
                  <p className="text-xs text-[var(--color-muted)]">
                    Acompanhe a trajetória das categorias com maior peso no orçamento
                  </p>
                </div>

                {dados.evolucao_por_categoria.categorias.length === 0 ? (
                  <p className="py-16 text-center text-xs text-[var(--color-muted)]">
                    Cadastre metas para visualizar a evolução por categoria.
                  </p>
                ) : (
                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={dados.evolucao_por_categoria.series}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis
                          dataKey="rotulo"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 11, fill: '#64748b' }}
                        />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 11, fill: '#64748b' }}
                          tickFormatter={(v) => Number(v).toLocaleString('pt-BR')}
                        />
                        <Tooltip
                          formatter={(val: any) => formatCurrency(Number(val))}
                          contentStyle={{
                            borderRadius: '8px',
                            border: '1px solid #e2e8f0',
                            fontSize: '12px',
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: '12px' }} />
                        {dados.evolucao_por_categoria.categorias.map((catNome, idx) => (
                          <Line
                            key={catNome}
                            type="monotone"
                            dataKey={catNome}
                            name={catNome}
                            stroke={CORES_LINHAS[idx % CORES_LINHAS.length]}
                            strokeWidth={2.5}
                            dot={{ r: 3 }}
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </article>
            ) : aba === 'tendencia' ? (
              <article className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-2xs">
                <div className="mb-4">
                  <h3 className="text-sm font-bold text-[var(--color-text)]">
                    Tendência de Gastos — Histórico dos Últimos 12 Meses
                  </h3>
                  <p className="text-xs text-[var(--color-muted)]">
                    Comparativo entre orçamento planejado, gasto realizado e média móvel trimestral
                  </p>
                </div>

                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={dados.tendencia_12m}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis
                        dataKey="rotulo"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 11, fill: '#64748b' }}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 11, fill: '#64748b' }}
                        tickFormatter={(v) => Number(v).toLocaleString('pt-BR')}
                      />
                      <Tooltip
                        formatter={(val: any) => formatCurrency(Number(val))}
                        contentStyle={{
                          borderRadius: '8px',
                          border: '1px solid #e2e8f0',
                          fontSize: '12px',
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '12px' }} />
                      <Bar
                        dataKey="planejado"
                        name="Planejado"
                        fill="#cbd5e1"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={20}
                      />
                      <Bar
                        dataKey="realizado"
                        name="Realizado"
                        fill="#059669"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={20}
                      />
                      <Line
                        type="monotone"
                        dataKey="media_movel_3m"
                        name="Média móvel (3m)"
                        stroke="#f59e0b"
                        strokeWidth={2.5}
                        dot={{ r: 3 }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </article>
            ) : (
              <article className="space-y-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-2xs">
                <div>
                  <h3 className="text-sm font-bold text-[var(--color-text)]">
                    Comparativo Mensal (Mês Anterior x Mês Atual x Média 6m)
                  </h3>
                  <p className="text-xs text-[var(--color-muted)]">
                    Variação de consumo entre períodos para cada categoria monitorada
                  </p>
                </div>

                {dados.comparativo_mensal.length === 0 ? (
                  <p className="py-12 text-center text-xs text-[var(--color-muted)]">
                    Nenhuma meta configurada para comparativo mensal.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-[var(--color-border)] bg-slate-50 text-[11px] font-semibold text-[var(--color-muted)]">
                        <tr>
                          <th className="px-3 py-2.5">Categoria</th>
                          <th className="px-3 py-2.5 text-right">Mês Anterior</th>
                          <th className="px-3 py-2.5 text-right">Mês Atual</th>
                          <th className="px-3 py-2.5 text-right">Média (6m)</th>
                          <th className="px-3 py-2.5 text-right">Variação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--color-border)]/60">
                        {dados.comparativo_mensal.map((item) => (
                          <tr key={item.meta_id} className="hover:bg-slate-50/70">
                            <td className="px-3 py-2.5 font-bold text-[var(--color-text)]">
                              {item.nome}
                            </td>
                            <td className="px-3 py-2.5 text-right tabular-nums text-[var(--color-muted)]">
                              {formatCurrency(item.mes_anterior)}
                            </td>
                            <td className="px-3 py-2.5 text-right font-bold tabular-nums text-[var(--color-text)]">
                              {formatCurrency(item.mes_atual)}
                            </td>
                            <td className="px-3 py-2.5 text-right tabular-nums text-[var(--color-muted)]">
                              {formatCurrency(item.media_6m)}
                            </td>
                            <td
                              className={`px-3 py-2.5 text-right font-bold tabular-nums ${
                                item.variacao_mensal_pct > 0
                                  ? 'text-rose-600'
                                  : item.variacao_mensal_pct < 0
                                    ? 'text-emerald-600'
                                    : 'text-[var(--color-muted)]'
                              }`}
                            >
                              {item.variacao_mensal_pct > 0 ? '+' : ''}
                              {item.variacao_mensal_pct.toFixed(1)}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </article>
            )}
          </div>

          {/* Card Direito (4 colunas): Resumo do Periodo */}
          <div className="space-y-4 lg:col-span-4">
            <article className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-2xs">
              <h3 className="mb-4 text-sm font-bold text-[var(--color-text)]">Resumo do Período</h3>

              <div className="divide-y divide-[var(--color-border)]/70 text-xs">
                <div className="flex items-center justify-between py-3">
                  <span className="inline-flex items-center gap-2 text-[var(--color-muted)]">
                    <Wallet className="h-4 w-4 text-slate-400" />
                    Total planejado
                  </span>
                  <span className="text-sm font-bold tabular-nums text-[var(--color-text)]">
                    {formatCurrency(resumo?.total_planejado ?? 0)}
                  </span>
                </div>

                <div className="flex items-center justify-between py-3">
                  <span className="inline-flex items-center gap-2 text-[var(--color-muted)]">
                    <AlertCircle className="h-4 w-4 text-slate-400" />
                    Total realizado
                  </span>
                  <span className="text-sm font-bold tabular-nums text-[var(--color-text)]">
                    {formatCurrency(resumo?.total_realizado ?? 0)}
                  </span>
                </div>

                <div className="flex items-center justify-between py-3">
                  <span className="inline-flex items-center gap-2 text-[var(--color-muted)]">
                    <TrendingDown className="h-4 w-4 text-slate-400" />
                    Variação
                  </span>
                  <span
                    className={`text-sm font-bold tabular-nums ${
                      (resumo?.variacao ?? 0) >= 0 ? 'text-emerald-700' : 'text-rose-600'
                    }`}
                  >
                    {(resumo?.variacao ?? 0) >= 0 ? '+ ' : '- '}
                    {formatCurrency(Math.abs(resumo?.variacao ?? 0))}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-3">
                  <span className="inline-flex items-center gap-2 text-[var(--color-muted)]">
                    <BarChart2 className="h-4 w-4 text-emerald-600" />
                    Execução do orçamento
                  </span>
                  <span className="text-sm font-bold tabular-nums text-[var(--color-text)]">
                    {Math.round(resumo?.execucao_orcamento_pct ?? 0)}%
                  </span>
                </div>
              </div>
            </article>
          </div>
        </div>
      )}
    </section>
  )
}

