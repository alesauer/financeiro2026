import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { BarChart3, PieChart as PieIcon, Plus, Sparkles, Target, Wallet } from 'lucide-react'

import { useAuth } from '@/app/providers/AuthProvider'
import { CategoriaIconBadge } from '@/features/metas/components/CategoriaIconBadge'
import { MetasPageHeader } from '@/features/metas/components/MetasPageHeader'
import { MetaStatusBadge } from '@/features/metas/components/MetaStatusBadge'
import { metasService } from '@/features/metas/services/metasService'
import type { PainelMetasResponse } from '@/features/metas/types/metas'
import { getEstiloSituacao } from '@/features/metas/utils/calculosMetas'
import { formatCurrency } from '@/shared/utils/date'
import { getErrorMessage } from '@/shared/utils/error'

export function MetasVisaoGeralPage() {
  const { token } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const hoje = new Date()
  const [mes, setMes] = useState<number>(() => Number(searchParams.get('mes')) || hoje.getMonth() + 1)
  const [ano, setAno] = useState<number>(() => Number(searchParams.get('ano')) || hoje.getFullYear())

  const [dados, setDados] = useState<PainelMetasResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [gerando, setGerando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const resp = await metasService.painel(token, { mes, ano })
      setDados(resp)
    } catch (err) {
      setError(getErrorMessage(err, 'Não foi possível carregar a visão geral de metas.'))
    } finally {
      setLoading(false)
    }
  }, [token, mes, ano])

  useEffect(() => {
    carregar()
  }, [carregar])

  const handleChangePeriodo = (novoMes: number, novoAno: number) => {
    setMes(novoMes)
    setAno(novoAno)
    setSearchParams({ mes: String(novoMes), ano: String(novoAno) }, { replace: true })
  }

  const handleGerarSugestoes = async () => {
    if (!token) return
    setGerando(true)
    setError(null)
    try {
      const res = await metasService.resumo(token, mes, ano)
      const topCats = [...res.catalogo.categorias]
        .filter((c) => c.media_3m >= 50)
        .sort((a, b) => b.media_3m - a.media_3m)
        .slice(0, 6)

      await metasService.salvarLote(token, {
        modo: 'padrao',
        itens: topCats.map((c) => ({
          escopo: 'categoria' as const,
          categoria_id: c.categoria_id,
          valor_limite: Math.round(c.media_3m * 0.9),
        })),
      })
      await carregar()
    } catch (err) {
      setError(getErrorMessage(err, 'Erro ao sugerir metas automáticas.'))
    } finally {
      setGerando(false)
    }
  }

  const ind = dados?.indicadores
  const pctExec = Math.min(100, Math.max(0, ind?.percentual_execucao ?? 0))
  const pctDisp = Math.max(0, Number((100 - pctExec).toFixed(1)))

  const pieData = [
    { name: 'Gasto', value: pctExec > 0 ? pctExec : 0.01, color: '#059669' },
    { name: 'Disponível', value: pctDisp > 0 ? pctDisp : 0, color: '#e2e8f0' },
  ]

  return (
    <section className="space-y-6">
      <MetasPageHeader
        subtitulo="Visão Geral"
        mes={mes}
        ano={ano}
        onChangePeriodo={handleChangePeriodo}
        rightActions={
          <Link
            to={`/metas/nova?mes=${mes}&ano=${ano}`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-800 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Nova Meta
          </Link>
        }
      />

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {loading && !dados ? (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-12 text-center text-sm text-[var(--color-muted)]">
          Carregando indicadores e metas...
        </div>
      ) : !dados ? null : (
        <>
          {/* 4 KPIs Superiores */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <article className="flex items-center gap-3.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-2xs">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <Wallet className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-medium text-[var(--color-muted)]">Orçamento do mês</p>
                <p className="mt-0.5 text-xl font-bold tabular-nums text-[var(--color-text)]">
                  {formatCurrency(ind?.orcamento_total ?? 0)}
                </p>
              </div>
            </article>

            <article className="flex items-center gap-3.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-2xs">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                <BarChart3 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-medium text-[var(--color-muted)]">Gasto até agora</p>
                <p className="mt-0.5 text-xl font-bold tabular-nums text-[var(--color-text)]">
                  {formatCurrency(ind?.gasto_total ?? 0)}
                </p>
              </div>
            </article>

            <article className="flex items-center gap-3.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-2xs">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
                <PieIcon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-medium text-[var(--color-muted)]">
                  {(ind?.excedido_total ?? 0) > 0 ? 'Excedido no mês' : 'Disponível'}
                </p>
                <p
                  className={`mt-0.5 text-xl font-bold tabular-nums ${
                    (ind?.excedido_total ?? 0) > 0 ? 'text-rose-600' : 'text-emerald-700'
                  }`}
                >
                  {(ind?.excedido_total ?? 0) > 0
                    ? formatCurrency(ind?.excedido_total ?? 0)
                    : formatCurrency(ind?.disponivel_total ?? 0)}
                </p>
              </div>
            </article>

            <article
              onClick={() => navigate(`/metas/lista?mes=${mes}&ano=${ano}&situacao=atencao`)}
              className="flex cursor-pointer items-center gap-3.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-2xs transition-colors hover:border-amber-300"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                <Target className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-medium text-[var(--color-muted)]">Metas em atenção</p>
                <p className="mt-0.5 text-xl font-bold tabular-nums text-[var(--color-text)]">
                  {ind?.metas_em_atencao_total ?? 0} de {ind?.total_metas ?? 0}
                </p>
              </div>
            </article>
          </div>

          {/* Linha central: Grafico Donut Execucao do Orcamento + Grafico Barras Evolucao dos Gastos */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            {/* Execucao do orcamento */}
            <article className="flex flex-col justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-2xs lg:col-span-5">
              <div className="flex flex-col items-center gap-6 sm:flex-row">
                <div className="relative h-40 w-40 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={52}
                        outerRadius={70}
                        startAngle={90}
                        endAngle={-270}
                        dataKey="value"
                        stroke="none"
                      >
                        {pieData.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold tabular-nums text-[var(--color-text)]">
                      {Math.round(ind?.percentual_execucao ?? 0)}%
                    </span>
                  </div>
                </div>

                <div className="flex-1 space-y-3 w-full">
                  <h3 className="text-sm font-bold text-[var(--color-text)]">
                    Execução do orçamento
                  </h3>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-2 text-[var(--color-muted)]">
                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />
                        Gasto
                      </span>
                      <span className="font-semibold tabular-nums text-[var(--color-text)]">
                        {formatCurrency(ind?.gasto_total ?? 0)} ({Math.round(ind?.percentual_execucao ?? 0)}%)
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-2 text-[var(--color-muted)]">
                        <span className="h-2.5 w-2.5 rounded-full bg-slate-200" />
                        Disponível
                      </span>
                      <span className="font-semibold tabular-nums text-[var(--color-text)]">
                        {formatCurrency(ind?.disponivel_total ?? 0)} ({Math.round(ind?.percentual_disponivel ?? 0)}%)
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </article>

            {/* Evolucao dos gastos mensais */}
            <article className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-2xs lg:col-span-7">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-[var(--color-text)]">Evolução dos gastos</h3>
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

              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dados.evolucao_mensal} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="rotulo"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12, fill: '#64748b' }}
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
                    <Bar dataKey="planejado" name="Planejado" fill="#cbd5e1" radius={[4, 4, 0, 0]} maxBarSize={26} />
                    <Bar dataKey="realizado" name="Realizado" fill="#059669" radius={[4, 4, 0, 0]} maxBarSize={26} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </article>
          </div>

          {/* Secao Metas do Mes */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[var(--color-text)]">Metas do mês</h3>
              <Link
                to={`/metas/lista?mes=${mes}&ano=${ano}`}
                className="text-xs font-semibold text-emerald-700 hover:underline"
              >
                Ver todas →
              </Link>
            </div>

            {dados.metas.length === 0 ? (
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center">
                <p className="text-sm font-semibold text-[var(--color-text)]">
                  Nenhuma meta cadastrada para {dados.periodo.mes_nome}/{ano}
                </p>
                <p className="mt-1 text-xs text-[var(--color-muted)]">
                  Crie uma meta manualmente ou gere sugestões automáticas com base no seu histórico real de lançamentos.
                </p>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                  <Link
                    to={`/metas/nova?mes=${mes}&ano=${ano}`}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
                  >
                    <Plus className="h-4 w-4" />
                    Criar Nova Meta
                  </Link>
                  <button
                    type="button"
                    disabled={gerando}
                    onClick={handleGerarSugestoes}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50 cursor-pointer"
                  >
                    <Sparkles className="h-4 w-4" />
                    {gerando ? 'Gerando...' : 'Sugerir Metas pelo Histórico'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {dados.metas.map((meta) => {
                  const est = getEstiloSituacao(meta.situacao)
                  const largura = Math.min(100, Math.max(2, meta.percentual_consumido))
                  return (
                    <article
                      key={meta.id}
                      onClick={() => navigate(`/metas/${meta.id}?mes=${mes}&ano=${ano}`)}
                      className="group cursor-pointer rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-2xs transition-all hover:border-emerald-300 hover:shadow-sm"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <CategoriaIconBadge nome={meta.categoria_nome} size="sm" />
                          <h4 className="truncate text-sm font-bold text-[var(--color-text)] group-hover:text-emerald-700">
                            {meta.nome}
                          </h4>
                        </div>
                        <MetaStatusBadge situacao={meta.situacao} />
                      </div>

                      <div className="mt-3 flex items-baseline justify-between gap-2 text-xs">
                        <div>
                          <span className={`text-sm font-bold tabular-nums ${est.textColor}`}>
                            {formatCurrency(meta.valor_realizado)}
                          </span>
                          <span className="text-[var(--color-muted)]">
                            {' '}
                            de {formatCurrency(meta.valor_planejado)}
                          </span>
                        </div>
                        <span className={`font-bold tabular-nums ${est.textColor}`}>
                          {Math.round(meta.percentual_consumido)}%
                        </span>
                      </div>

                      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${est.barColor}`}
                          style={{ width: `${largura}%` }}
                        />
                      </div>

                      <div className="mt-2.5 flex items-center justify-between text-[11px] text-[var(--color-muted)]">
                        {meta.valor_excedido > 0 ? (
                          <span className="font-semibold text-rose-600">
                            Excedido: {formatCurrency(meta.valor_excedido)}
                          </span>
                        ) : (
                          <span>Disponível: {formatCurrency(meta.valor_disponivel)}</span>
                        )}
                        <span className="font-medium text-emerald-700 group-hover:underline">
                          Detalhes →
                        </span>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  )
}

