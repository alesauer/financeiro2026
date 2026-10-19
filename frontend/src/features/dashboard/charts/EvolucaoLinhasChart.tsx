import { useEffect, useMemo, useState } from 'react'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ChevronLeft, ChevronRight, Calendar, Loader2 } from 'lucide-react'
import { useAuth } from '@/app/providers/AuthProvider'
import { dashboardService } from '@/features/dashboard/services/dashboardService'
import type { EvolucaoDiariaResponse, MatrizAnual } from '@/shared/types/relatorio'
import { formatCurrency } from '@/shared/utils/date'
import {
  MESES_CURTOS,
  eixoProps,
  formatarEixo,
  gridProps,
} from '@/features/dashboard/charts/chartTheme'

const MESES_NOMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
]

interface EvolucaoLinhasChartProps {
  dados: MatrizAnual
  onMesClick?: (mes: number, tipo: 'Receita' | 'Despesa') => void
  onDiaClick?: (dataIso: string) => void
}

export function EvolucaoLinhasChart({ dados, onMesClick, onDiaClick }: EvolucaoLinhasChartProps) {
  const { token } = useAuth()

  const hoje = useMemo(() => new Date(), [])
  const anoAtual = hoje.getFullYear()
  const mesAtual = hoje.getMonth() + 1 // 1..12

  const [modo, setModo] = useState<'mensal' | 'diario'>('mensal')
  const [mesSelecionado, setMesSelecionado] = useState<number>(() => {
    return dados.ano === anoAtual ? mesAtual : 10
  })

  // Sincroniza mês selecionado ao alterar o ano do dashboard
  useEffect(() => {
    if (dados.ano === anoAtual) {
      setMesSelecionado(mesAtual)
    }
  }, [dados.ano, anoAtual, mesAtual])

  const [dadosDiarios, setDadosDiarios] = useState<EvolucaoDiariaResponse | null>(null)
  const [cacheDiario, setCacheDiario] = useState<Record<string, EvolucaoDiariaResponse>>({})
  const [loadingDiario, setLoadingDiario] = useState(false)
  const [erroDiario, setErroDiario] = useState<string | null>(null)

  // Carrega dados diários sob demanda
  useEffect(() => {
    if (modo !== 'diario' || !token) return

    const cacheKey = `${dados.ano}-${mesSelecionado}-${dados.base || 'transacao'}`
    if (cacheDiario[cacheKey]) {
      setDadosDiarios(cacheDiario[cacheKey])
      return
    }

    let cancelado = false
    setLoadingDiario(true)
    setErroDiario(null)

    dashboardService
      .evolucaoDiaria(token, {
        ano: dados.ano,
        mes: mesSelecionado,
        base: dados.base,
      })
      .then((resp) => {
        if (!cancelado) {
          setDadosDiarios(resp)
          setCacheDiario((prev) => ({ ...prev, [cacheKey]: resp }))
        }
      })
      .catch(() => {
        if (!cancelado) {
          setErroDiario('Não foi possível carregar os dados diários.')
        }
      })
      .finally(() => {
        if (!cancelado) setLoadingDiario(false)
      })

    return () => {
      cancelado = true
    }
  }, [modo, token, dados.ano, mesSelecionado, dados.base, cacheDiario])

  // Séries da visão mensal
  const seriesMensal = useMemo(() => {
    return MESES_CURTOS.map((mes, i) => {
      const receita = dados.sumario.receita[i] ?? 0
      const despesa = dados.sumario.despesa[i] ?? 0
      const saldo = dados.sumario.saldo[i] ?? 0

      return {
        mes,
        mesIndex: i,
        Receita: receita,
        Despesa: despesa,
        Saldo: saldo,
      }
    })
  }, [dados])

  const totalReceitaMensal = useMemo(
    () => dados.sumario.receita.reduce((acc, v) => acc + (v || 0), 0),
    [dados.sumario.receita],
  )
  const totalDespesaMensal = useMemo(
    () => dados.sumario.despesa.reduce((acc, v) => acc + (v || 0), 0),
    [dados.sumario.despesa],
  )

  const vazioMensal = totalReceitaMensal === 0 && totalDespesaMensal === 0

  // Séries da visão diária
  const seriesDiario = useMemo(() => {
    return dadosDiarios?.dias ?? []
  }, [dadosDiarios])

  const totalReceitaDiaria = dadosDiarios?.total_receita ?? 0
  const totalDespesaDiaria = dadosDiarios?.total_despesa ?? 0
  const vazioDiario = !loadingDiario && totalReceitaDiaria === 0 && totalDespesaDiaria === 0
  const ehMesCorrente = dados.ano === anoAtual && mesSelecionado === mesAtual

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-xs flex flex-col justify-between">
      <div>
        {/* Header do Card */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)]/50 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-[var(--color-text)]">
                {modo === 'mensal'
                  ? 'Evolução Mensal (Receitas vs Despesas)'
                  : `Evolução Diária - ${MESES_NOMES[mesSelecionado - 1]}`}
              </h3>
              {modo === 'diario' && ehMesCorrente && (
                <span className="inline-flex items-center rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-semibold text-teal-800 dark:bg-teal-900/40 dark:text-teal-300">
                  Mês Corrente
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--color-muted)] mt-0.5">
              {modo === 'mensal'
                ? `Acompanhamento do fluxo financeiro mês a mês em ${dados.ano}`
                : `Acompanhamento diário do fluxo financeiro dia a dia em ${MESES_NOMES[mesSelecionado - 1]} / ${dados.ano}`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Navegador de Mês (somente no modo diário) */}
            {modo === 'diario' && (
              <div className="flex items-center gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]/80 p-0.5 text-xs">
                <button
                  type="button"
                  disabled={mesSelecionado <= 1 || loadingDiario}
                  onClick={() => setMesSelecionado((m) => Math.max(1, m - 1))}
                  className="rounded p-1 text-[var(--color-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text)] disabled:opacity-30 disabled:cursor-not-allowed transition"
                  title="Mês anterior"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>

                <select
                  value={mesSelecionado}
                  onChange={(e) => setMesSelecionado(Number(e.target.value))}
                  className="bg-transparent text-xs font-semibold text-[var(--color-text)] border-none outline-none cursor-pointer px-1 py-0.5"
                >
                  {MESES_NOMES.map((nome, i) => (
                    <option key={i + 1} value={i + 1} className="bg-[var(--color-surface)] text-[var(--color-text)]">
                      {nome} {i + 1 === mesAtual && dados.ano === anoAtual ? '★' : ''}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  disabled={mesSelecionado >= 12 || loadingDiario}
                  onClick={() => setMesSelecionado((m) => Math.min(12, m + 1))}
                  className="rounded p-1 text-[var(--color-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text)] disabled:opacity-30 disabled:cursor-not-allowed transition"
                  title="Próximo mês"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {/* Alternador Mensal / Diário */}
            <div className="flex items-center rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]/80 p-0.5 text-xs font-semibold shadow-2xs">
              <button
                type="button"
                onClick={() => setModo('mensal')}
                className={`rounded-md px-3 py-1 transition-all ${
                  modo === 'mensal'
                    ? 'bg-[var(--color-surface)] text-[var(--color-text)] shadow-xs font-bold'
                    : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
                }`}
              >
                Mensal
              </button>
              <button
                type="button"
                onClick={() => {
                  setModo('diario')
                  if (dados.ano === anoAtual && mesSelecionado !== mesAtual) {
                    setMesSelecionado(mesAtual)
                  }
                }}
                className={`rounded-md px-3 py-1 transition-all flex items-center gap-1.5 ${
                  modo === 'diario'
                    ? 'bg-[var(--color-surface)] text-[var(--color-text)] shadow-xs font-bold'
                    : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
                }`}
              >
                <Calendar className="h-3 w-3 text-teal-600" />
                <span>Diário</span>
                {modo !== 'diario' && (
                  <span className="rounded bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300 px-1 py-0.2 text-[9px] font-bold">
                    {dados.ano === anoAtual ? MESES_CURTOS[mesAtual - 1] : MESES_CURTOS[mesSelecionado - 1]}
                  </span>
                )}
              </button>
            </div>

            {/* Badges de Totais */}
            <div className="flex items-center gap-2.5 text-xs">
              <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Rec: {formatCurrency(modo === 'mensal' ? totalReceitaMensal : totalReceitaDiaria)}
              </span>
              <span className="inline-flex items-center gap-1 font-semibold text-rose-700">
                <span className="h-2 w-2 rounded-full bg-rose-500" />
                Desp: {formatCurrency(modo === 'mensal' ? totalDespesaMensal : totalDespesaDiaria)}
              </span>
            </div>
          </div>
        </div>

        {/* Corpo do Gráfico */}
        {modo === 'mensal' ? (
          vazioMensal ? (
            <div className="flex h-56 items-center justify-center text-sm text-[var(--color-muted)]">
              Sem movimentações registradas para {dados.ano}.
            </div>
          ) : (
            <div className="h-64 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={seriesMensal} margin={{ top: 10, right: 12, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="grad-receita" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10B981" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#10B981" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="grad-despesa" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#EF4444" stopOpacity={0.15} />
                      <stop offset="100%" stopColor="#EF4444" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>

                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="mes" {...eixoProps} />
                  <YAxis {...eixoProps} tickFormatter={formatarEixo} width={52} />

                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null
                      const r = Number(payload.find((p) => p.dataKey === 'Receita')?.value ?? 0)
                      const d = Number(payload.find((p) => p.dataKey === 'Despesa')?.value ?? 0)
                      const s = r - d

                      return (
                        <div className="rounded-xl border border-[var(--color-border)] bg-slate-900/95 p-3 text-xs text-white shadow-xl backdrop-blur-sm">
                          <p className="font-bold text-slate-200 border-b border-slate-700 pb-1 mb-2">
                            Mês: {label} / {dados.ano}
                          </p>
                          <div className="space-y-1">
                            <p className="flex items-center justify-between gap-4 font-semibold text-emerald-400">
                              <span>Receitas:</span>
                              <span>{formatCurrency(r)}</span>
                            </p>
                            <p className="flex items-center justify-between gap-4 font-semibold text-rose-400">
                              <span>Despesas:</span>
                              <span>{formatCurrency(d)}</span>
                            </p>
                            <p className="flex items-center justify-between gap-4 border-t border-slate-800 pt-1 font-bold text-slate-300">
                              <span>Resultado:</span>
                              <span className={s >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                                {formatCurrency(s)}
                              </span>
                            </p>
                          </div>
                          <div className="flex items-center justify-between gap-2 mt-2 pt-1 border-t border-slate-800 text-[10px]">
                            <span className="text-teal-400 font-medium">
                              💡 Clique no ponto para ver dia a dia
                            </span>
                            {onMesClick && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  const mesIdx = MESES_CURTOS.indexOf(String(label))
                                  if (mesIdx >= 0) onMesClick(mesIdx, 'Despesa')
                                }}
                                className="text-slate-300 hover:text-white underline cursor-pointer"
                              >
                                Ver lançamentos →
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    }}
                  />

                  <Legend
                    iconType="circle"
                    wrapperStyle={{ fontSize: 12, paddingTop: 10 }}
                    formatter={(value) => (
                      <span className="text-xs font-medium text-[var(--color-text)]">
                        {value}
                      </span>
                    )}
                  />

                  <Area
                    type="monotone"
                    dataKey="Receita"
                    fill="url(#grad-receita)"
                    stroke="none"
                  />
                  <Area
                    type="monotone"
                    dataKey="Despesa"
                    fill="url(#grad-despesa)"
                    stroke="none"
                  />

                  <Line
                    type="monotone"
                    dataKey="Receita"
                    name="Receitas"
                    stroke="#10B981"
                    strokeWidth={2.5}
                    dot={{ r: 3.5, fill: '#10B981', strokeWidth: 1, stroke: '#ffffff' }}
                    activeDot={{ r: 6, fill: '#059669' }}
                    cursor="pointer"
                    onClick={(dataPoint: unknown) => {
                      const idx = (dataPoint as { mesIndex?: number })?.mesIndex
                      if (idx !== undefined) {
                        setMesSelecionado(idx + 1)
                        setModo('diario')
                      }
                    }}
                  />

                  <Line
                    type="monotone"
                    dataKey="Despesa"
                    name="Despesas"
                    stroke="#EF4444"
                    strokeWidth={2.5}
                    dot={{ r: 3.5, fill: '#EF4444', strokeWidth: 1, stroke: '#ffffff' }}
                    activeDot={{ r: 6, fill: '#DC2626' }}
                    cursor="pointer"
                    onClick={(dataPoint: unknown) => {
                      const idx = (dataPoint as { mesIndex?: number })?.mesIndex
                      if (idx !== undefined) {
                        setMesSelecionado(idx + 1)
                        setModo('diario')
                      }
                    }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )
        ) : loadingDiario ? (
          <div className="flex h-64 flex-col items-center justify-center gap-2 text-sm text-[var(--color-muted)]">
            <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
            <span>Carregando evolução diária de {MESES_NOMES[mesSelecionado - 1]}...</span>
          </div>
        ) : erroDiario ? (
          <div className="flex h-56 items-center justify-center text-sm text-rose-600">
            {erroDiario}
          </div>
        ) : vazioDiario ? (
          <div className="flex h-56 items-center justify-center text-sm text-[var(--color-muted)]">
            Sem movimentações registradas em {MESES_NOMES[mesSelecionado - 1]} de {dados.ano}.
          </div>
        ) : (
          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={seriesDiario} margin={{ top: 10, right: 12, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="grad-receita-dia" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10B981" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#10B981" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="grad-despesa-dia" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#EF4444" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#EF4444" stopOpacity={0.0} />
                  </linearGradient>
                </defs>

                <CartesianGrid {...gridProps} />
                <XAxis dataKey="label" {...eixoProps} />
                <YAxis {...eixoProps} tickFormatter={formatarEixo} width={52} />

                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null
                    const pItem = payload[0]?.payload
                    const r = Number(payload.find((p) => p.dataKey === 'Receita')?.value ?? 0)
                    const d = Number(payload.find((p) => p.dataKey === 'Despesa')?.value ?? 0)
                    const s = r - d
                    const qtd = pItem?.qtd_transacoes ?? 0

                    return (
                      <div className="rounded-xl border border-[var(--color-border)] bg-slate-900/95 p-3 text-xs text-white shadow-xl backdrop-blur-sm">
                        <p className="font-bold text-slate-200 border-b border-slate-700 pb-1 mb-2 flex items-center justify-between gap-4">
                          <span>Dia {label} de {MESES_NOMES[mesSelecionado - 1]} / {dados.ano}</span>
                          {qtd > 0 && <span className="text-[10px] text-slate-400 font-normal">{qtd} lançamento(s)</span>}
                        </p>
                        <div className="space-y-1">
                          <p className="flex items-center justify-between gap-4 font-semibold text-emerald-400">
                            <span>Receitas:</span>
                            <span>{formatCurrency(r)}</span>
                          </p>
                          <p className="flex items-center justify-between gap-4 font-semibold text-rose-400">
                            <span>Despesas:</span>
                            <span>{formatCurrency(d)}</span>
                          </p>
                          <p className="flex items-center justify-between gap-4 border-t border-slate-800 pt-1 font-bold text-slate-300">
                            <span>Saldo do Dia:</span>
                            <span className={s >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                              {formatCurrency(s)}
                            </span>
                          </p>
                        </div>
                        {onDiaClick && pItem?.data && (
                          <span className="text-[10px] text-teal-400 block mt-2 pt-1 border-t border-slate-800 font-medium">
                            💡 Clique para abrir os lançamentos deste dia
                          </span>
                        )}
                      </div>
                    )
                  }}
                />

                <Legend
                  iconType="circle"
                  wrapperStyle={{ fontSize: 12, paddingTop: 10 }}
                  formatter={(value) => (
                    <span className="text-xs font-medium text-[var(--color-text)]">
                      {value}
                    </span>
                  )}
                />

                <Area
                  type="monotone"
                  dataKey="Receita"
                  fill="url(#grad-receita-dia)"
                  stroke="none"
                />
                <Area
                  type="monotone"
                  dataKey="Despesa"
                  fill="url(#grad-despesa-dia)"
                  stroke="none"
                />

                <Line
                  type="monotone"
                  dataKey="Receita"
                  name="Receitas"
                  stroke="#10B981"
                  strokeWidth={2}
                  dot={{ r: 2.5, fill: '#10B981', strokeWidth: 1, stroke: '#ffffff' }}
                  activeDot={{ r: 5, fill: '#059669' }}
                  cursor={onDiaClick ? 'pointer' : undefined}
                  onClick={(pt: unknown) => {
                    const dataIso = (pt as { payload?: { data?: string } })?.payload?.data
                    if (dataIso) onDiaClick?.(dataIso)
                  }}
                />

                <Line
                  type="monotone"
                  dataKey="Despesa"
                  name="Despesas"
                  stroke="#EF4444"
                  strokeWidth={2}
                  dot={{ r: 2.5, fill: '#EF4444', strokeWidth: 1, stroke: '#ffffff' }}
                  activeDot={{ r: 5, fill: '#DC2626' }}
                  cursor={onDiaClick ? 'pointer' : undefined}
                  onClick={(pt: unknown) => {
                    const dataIso = (pt as { payload?: { data?: string } })?.payload?.data
                    if (dataIso) onDiaClick?.(dataIso)
                  }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )
}

