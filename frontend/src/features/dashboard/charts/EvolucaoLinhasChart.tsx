import { useMemo } from 'react'
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
import type { MatrizAnual } from '@/shared/types/relatorio'
import { formatCurrency } from '@/shared/utils/date'
import {
  MESES_CURTOS,
  eixoProps,
  formatarEixo,
  gridProps,
} from '@/features/dashboard/charts/chartTheme'

interface EvolucaoLinhasChartProps {
  dados: MatrizAnual
  onMesClick?: (mes: number, tipo: 'Receita' | 'Despesa') => void
}

export function EvolucaoLinhasChart({ dados, onMesClick }: EvolucaoLinhasChartProps) {
  const series = useMemo(() => {
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

  const totalReceita = useMemo(
    () => dados.sumario.receita.reduce((acc, v) => acc + (v || 0), 0),
    [dados.sumario.receita],
  )
  const totalDespesa = useMemo(
    () => dados.sumario.despesa.reduce((acc, v) => acc + (v || 0), 0),
    [dados.sumario.despesa],
  )

  const vazio = totalReceita === 0 && totalDespesa === 0

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-xs flex flex-col justify-between">
      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-[var(--color-text)]">
              Evolução Mensal (Receitas vs Despesas)
            </h3>
            <p className="text-xs text-[var(--color-muted)]">
              Acompanhamento do fluxo financeiro mês a mês em {dados.ano}
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              Rec: {formatCurrency(totalReceita)}
            </span>
            <span className="inline-flex items-center gap-1 font-semibold text-rose-700">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
              Desp: {formatCurrency(totalDespesa)}
            </span>
          </div>
        </div>

        {vazio ? (
          <div className="flex h-56 items-center justify-center text-sm text-[var(--color-muted)]">
            Sem movimentações registradas para {dados.ano}.
          </div>
        ) : (
          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={series} margin={{ top: 10, right: 12, bottom: 0, left: 0 }}>
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

                {/* Sombra sutil sob a curva */}
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

                {/* Linha de Receitas (Verde) */}
                <Line
                  type="monotone"
                  dataKey="Receita"
                  name="Receitas"
                  stroke="#10B981"
                  strokeWidth={2.5}
                  dot={{ r: 3.5, fill: '#10B981', strokeWidth: 1, stroke: '#ffffff' }}
                  activeDot={{ r: 6, fill: '#059669' }}
                  cursor={onMesClick ? 'pointer' : undefined}
                  onClick={(data: unknown) => {
                    const idx = (data as { mesIndex?: number })?.mesIndex
                    if (idx !== undefined) onMesClick?.(idx, 'Receita')
                  }}
                />

                {/* Linha de Despesas (Vermelha) */}
                <Line
                  type="monotone"
                  dataKey="Despesa"
                  name="Despesas"
                  stroke="#EF4444"
                  strokeWidth={2.5}
                  dot={{ r: 3.5, fill: '#EF4444', strokeWidth: 1, stroke: '#ffffff' }}
                  activeDot={{ r: 6, fill: '#DC2626' }}
                  cursor={onMesClick ? 'pointer' : undefined}
                  onClick={(data: unknown) => {
                    const idx = (data as { mesIndex?: number })?.mesIndex
                    if (idx !== undefined) onMesClick?.(idx, 'Despesa')
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
