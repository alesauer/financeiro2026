import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Info,
  Pencil,
  TrendingUp,
  Wallet,
} from 'lucide-react'

import { useAuth } from '@/app/providers/AuthProvider'
import { CategoriaIconBadge } from '@/features/metas/components/CategoriaIconBadge'
import { MetasPageHeader } from '@/features/metas/components/MetasPageHeader'
import { metasService } from '@/features/metas/services/metasService'
import type { DetalheMetaResponse } from '@/features/metas/types/metas'
import {
  formatarDataCurtaPt,
  getEstiloSituacao,
} from '@/features/metas/utils/calculosMetas'
import { formatCurrency } from '@/shared/utils/date'
import { getErrorMessage } from '@/shared/utils/error'

export function MetaDetalhePage() {
  const { token } = useAuth()
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [searchParams, setSearchParams] = useSearchParams()

  const hoje = new Date()
  const [mes, setMes] = useState<number>(() => Number(searchParams.get('mes')) || hoje.getMonth() + 1)
  const [ano, setAno] = useState<number>(() => Number(searchParams.get('ano')) || hoje.getFullYear())

  const [dados, setDados] = useState<DetalheMetaResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    if (!token || !id) return
    setLoading(true)
    setError(null)
    try {
      const resp = await metasService.detalhe(token, Number(id), mes, ano)
      setDados(resp)
    } catch (err) {
      setError(getErrorMessage(err, 'Não foi possível carregar os detalhes da meta.'))
    } finally {
      setLoading(false)
    }
  }, [token, id, mes, ano])

  useEffect(() => {
    carregar()
  }, [carregar])

  const handleChangePeriodo = (novoMes: number, novoAno: number) => {
    setMes(novoMes)
    setAno(novoAno)
    setSearchParams({ mes: String(novoMes), ano: String(novoAno) }, { replace: true })
  }

  const meta = dados?.meta
  const periodo = dados?.periodo
  const est = getEstiloSituacao(meta?.situacao ?? 'dentro')
  const largura = Math.min(100, Math.max(2, meta?.percentual_consumido ?? 0))

  const ultimoDiaStr = String(periodo?.dias_no_mes ?? 30).padStart(2, '0')
  const mesFormatado = String(mes).padStart(2, '0')
  const linkTransacoes = meta
    ? `/transacoes?tipo=Despesa&inicio=${ano}-${mesFormatado}-01&fim=${ano}-${mesFormatado}-${ultimoDiaStr}&mes=${ano}-${mesFormatado}&categoria_id=${meta.categoria_id}`
    : '/transacoes'

  return (
    <section className="space-y-6">
      <MetasPageHeader
        subtitulo={meta?.nome ?? 'Detalhamento'}
        mes={mes}
        ano={ano}
        onChangePeriodo={handleChangePeriodo}
        rightActions={
          meta ? (
            <Link
              to={`/metas/${meta.id}/editar?mes=${mes}&ano=${ano}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2 text-xs font-semibold text-[var(--color-text)] shadow-2xs hover:bg-slate-50"
            >
              <Pencil className="h-3.5 w-3.5 text-emerald-700" />
              Editar Meta
            </Link>
          ) : null
        }
      />

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {loading && !dados ? (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-12 text-center text-sm text-[var(--color-muted)]">
          Carregando detalhamento da meta...
        </div>
      ) : !dados || !meta || !periodo ? null : (
        <div className="space-y-5">
          {/* Identificacao da Meta */}
          <div className="flex items-center gap-3.5">
            <CategoriaIconBadge nome={meta.categoria_nome} size="lg" />
            <div>
              <h2 className="text-xl font-bold text-[var(--color-text)]">{meta.nome}</h2>
              <p className="text-xs text-[var(--color-muted)]">
                Meta {meta.periodicidade.toLowerCase()} • {periodo.mes_nome} / {periodo.ano}
              </p>
            </div>
          </div>

          {/* Linha 1: Barra principal + Subcards (Esquerda) e Projecao do Mes (Direita) */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            <div className="space-y-4 lg:col-span-8">
              {/* Card da Barra de Progresso Principal */}
              <article className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-2xs">
                <div className="flex items-baseline justify-between gap-2">
                  <div>
                    <span className="text-2xl font-bold tabular-nums text-[var(--color-text)]">
                      {formatCurrency(meta.valor_realizado)}
                    </span>
                    <span className="text-sm text-[var(--color-muted)]">
                      {' '}
                      de {formatCurrency(meta.valor_planejado)}
                    </span>
                  </div>
                  <span className={`text-xl font-bold tabular-nums ${est.textColor}`}>
                    {Math.round(meta.percentual_consumido)}%
                  </span>
                </div>

                <div className="mt-3 h-3.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${est.barColor}`}
                    style={{ width: `${largura}%` }}
                  />
                </div>
              </article>

              {/* 3 Subcards: Disponivel, Dias Restantes, Ritmo de Gasto */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <article className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-2xs">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                    <Wallet className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs text-[var(--color-muted)]">
                      {meta.valor_excedido > 0 ? 'Excedido' : 'Disponível'}
                    </p>
                    <p
                      className={`text-base font-bold tabular-nums ${
                        meta.valor_excedido > 0 ? 'text-rose-600' : 'text-[var(--color-text)]'
                      }`}
                    >
                      {meta.valor_excedido > 0
                        ? formatCurrency(meta.valor_excedido)
                        : formatCurrency(meta.valor_disponivel)}
                    </p>
                  </div>
                </article>

                <article className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-2xs">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-600">
                    <Calendar className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs text-[var(--color-muted)]">Dias restantes</p>
                    <p className="text-base font-bold text-[var(--color-text)]">
                      {meta.dias_restantes} {meta.dias_restantes === 1 ? 'dia' : 'dias'}
                    </p>
                  </div>
                </article>

                <article className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-2xs">
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                      meta.ritmo_elevado
                        ? 'bg-amber-50 text-amber-600'
                        : 'bg-emerald-50 text-emerald-600'
                    }`}
                  >
                    <TrendingUp className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs text-[var(--color-muted)]">Ritmo de gasto</p>
                    <p
                      className={`text-sm font-bold ${
                        meta.ritmo_elevado ? 'text-amber-700' : 'text-emerald-700'
                      }`}
                    >
                      {meta.ritmo_label}
                    </p>
                  </div>
                </article>
              </div>
            </div>

            {/* Card Lateral: Projecao do Mes */}
            <article className="flex flex-col justify-between rounded-xl border border-emerald-200/80 bg-emerald-50/40 p-5 shadow-2xs lg:col-span-4">
              <div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--color-text)]">
                  <span>Projeção do mês</span>
                  <span title="Calculada projetando sua média diária atual até o último dia do mês" className="inline-flex cursor-help">
                    <Info className="h-3.5 w-3.5 text-slate-400" />
                  </span>
                </div>
                <p className="mt-2 text-2xl font-bold tabular-nums text-[var(--color-text)]">
                  {formatCurrency(meta.projecao_mes)}
                </p>
                <p className="mt-1 text-xs text-[var(--color-muted)]">
                  Estimativa com base no seu ritmo atual ({formatCurrency(meta.gasto_diario_medio)}/dia)
                </p>
              </div>

              <div className="mt-4">
                {meta.projecao_mes <= meta.valor_planejado ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-semibold text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Dentro da meta
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Risco de ultrapassar o limite
                  </span>
                )}
              </div>
            </article>
          </div>

          {/* Linha 2: Evolucao Diaria dos Gastos + Ultimos Lancamentos da Categoria */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            {/* Grafico Evolucao Diaria */}
            <article className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-2xs lg:col-span-7">
              <h3 className="mb-3 text-sm font-bold text-[var(--color-text)]">
                Evolução diária dos gastos
              </h3>

              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={dados.evolucao_diaria}>
                    <defs>
                      <linearGradient id="colorGastoAcum" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#059669" stopOpacity={0.28} />
                        <stop offset="95%" stopColor="#059669" stopOpacity={0.03} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="rotulo"
                      axisLine={false}
                      tickLine={false}
                      interval={4}
                      tick={{ fontSize: 11, fill: '#64748b' }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      tickFormatter={(v) => Number(v).toLocaleString('pt-BR')}
                    />
                    <Tooltip
                      formatter={(val: any, name: any) => [
                        formatCurrency(Number(val)),
                        name === 'gasto_acumulado' ? 'Gasto acumulado' : 'Meta',
                      ]}
                      contentStyle={{
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0',
                        fontSize: '12px',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="gasto_acumulado"
                      name="gasto_acumulado"
                      stroke="#059669"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#colorGastoAcum)"
                      connectNulls
                    />
                    <Line
                      type="monotone"
                      dataKey="meta"
                      name="meta"
                      stroke="#64748b"
                      strokeDasharray="5 5"
                      strokeWidth={1.5}
                      dot={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-2 flex flex-wrap items-center justify-center gap-6 text-xs text-[var(--color-muted)]">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />
                  Gasto acumulado
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-4 border-t-2 border-dashed border-slate-500" />
                  Meta ({formatCurrency(meta.valor_planejado)})
                </span>
              </div>
            </article>

            {/* Ultimos lancamentos da categoria */}
            <article className="flex flex-col justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-2xs lg:col-span-5">
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-[var(--color-text)]">
                    Últimos lançamentos da categoria
                  </h3>
                  <Link
                    to={linkTransacoes}
                    className="text-xs font-semibold text-emerald-700 hover:underline"
                  >
                    Ver todos →
                  </Link>
                </div>

                {dados.lancamentos.length === 0 ? (
                  <p className="py-12 text-center text-xs text-[var(--color-muted)]">
                    Nenhum lançamento registrado nesta categoria em {periodo.mes_nome}/{periodo.ano}.
                  </p>
                ) : (
                  <ul className="divide-y divide-[var(--color-border)]/60">
                    {dados.lancamentos.slice(0, 6).map((tx) => (
                      <li
                        key={tx.id}
                        onClick={() => navigate(linkTransacoes)}
                        className="flex cursor-pointer items-center justify-between gap-3 py-2.5 transition-colors hover:bg-slate-50/70"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <CategoriaIconBadge nome={meta.categoria_nome} size="sm" />
                          <div className="min-w-0">
                            <p className="truncate text-xs font-bold text-[var(--color-text)]">
                              {tx.descricao}
                              {tx.parcelado && tx.parcela_atual && tx.total_parcelas ? (
                                <span className="ml-1.5 rounded bg-purple-50 px-1.5 py-0.5 text-[10px] font-semibold text-purple-700">
                                  {tx.parcela_atual}/{tx.total_parcelas}
                                </span>
                              ) : null}
                            </p>
                            <p className="text-[11px] text-[var(--color-muted)]">
                              {formatarDataCurtaPt(tx.data_transacao)} • {tx.forma_pagamento_nome}
                            </p>
                          </div>
                        </div>

                        <span className="shrink-0 text-xs font-bold tabular-nums text-[var(--color-text)]">
                          {formatCurrency(tx.valor)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </article>
          </div>
        </div>
      )}
    </section>
  )
}

