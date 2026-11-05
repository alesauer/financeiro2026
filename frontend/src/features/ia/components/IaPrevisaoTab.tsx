import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Sparkles,
} from 'lucide-react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts'
import { iaService } from '../services/iaService'
import type { IaPrevisaoData } from '../types'
import { formatCurrency } from '@/shared/utils/date'
import { getErrorMessage } from '@/shared/utils/error'

type IaPrevisaoTabProps = {
  token?: string
}

export function IaPrevisaoTab({ token }: IaPrevisaoTabProps) {
  const hoje = new Date()
  const [mes, setMes] = useState(hoje.getMonth() + 1)
  const [ano, setAno] = useState(hoje.getFullYear())
  const [data, setData] = useState<IaPrevisaoData | null>(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    async function carregar() {
      setLoading(true)
      setErro(null)
      try {
        const res = await iaService.getPrevisao(mes, ano, token)
        setData(res)
      } catch (err) {
        setErro(getErrorMessage(err, 'Não foi possível carregar a previsão de gastos.'))
      } finally {
        setLoading(false)
      }
    }
    carregar()
  }, [mes, ano, token])

  return (
    <div className="space-y-6">
      {/* Controles de Período */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-2xs">
        <div className="space-y-0.5">
          <h3 className="text-sm font-semibold text-[var(--color-text)]">
            Previsão e Projeção de Gastos
          </h3>
          <p className="text-xs text-[var(--color-muted)]">
            Modelagem estatística combinando ritmo recente, despesas recorrentes e média histórica
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={mes}
            onChange={(e) => setMes(Number(e.target.value))}
            className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-text)]"
          >
            {[
              'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
              'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
            ].map((nomeMes, idx) => (
              <option key={idx + 1} value={idx + 1}>
                {nomeMes}
              </option>
            ))}
          </select>

          <input
            type="number"
            value={ano}
            onChange={(e) => setAno(Number(e.target.value))}
            className="w-20 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-center text-xs font-semibold text-[var(--color-text)]"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-muted)]">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 animate-spin text-[var(--color-primary)]" />
            <span>Processando projeções estatísticas...</span>
          </div>
        </div>
      ) : erro || !data ? (
        <div className="rounded-[var(--radius-md)] border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {erro || 'Erro ao carregar dados de previsão.'}
        </div>
      ) : (
        <>
          {/* Card de Explicação Gerada pela IA */}
          <article className="rounded-[var(--radius-md)] border border-sky-200 bg-sky-50/60 p-4 shadow-2xs">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-600 text-white shadow-2xs">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-sky-950">
                    Análise e Interpretação Preditiva
                  </h4>
                  <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-800">
                    Confiabilidade {data.confiabilidade} ({data.grau_confianca}%)
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-slate-700">{data.explicacao_ia}</p>
              </div>
            </div>
          </article>

          {/* Cards de Métricas */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-2xs">
              <span className="text-xs text-[var(--color-muted)]">Gasto Acumulado</span>
              <p className="mt-1 text-2xl font-bold text-[var(--color-text)]">
                {formatCurrency(data.gasto_acumulado)}
              </p>
              <p className="mt-1 text-[11px] text-[var(--color-muted)]">
                {data.dias_transcorridos} de {data.ultimo_dia_mes} dias transcorridos
              </p>
            </div>

            <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-2xs">
              <span className="text-xs text-[var(--color-muted)]">Previsão Restante</span>
              <p className="mt-1 text-2xl font-bold text-teal-700">
                {formatCurrency(data.previsao_restante)}
              </p>
              <p className="mt-1 text-[11px] text-[var(--color-muted)]">
                Para os próximos {data.dias_restantes} dias
              </p>
            </div>

            <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-2xs">
              <span className="text-xs text-[var(--color-muted)]">Projeção Final</span>
              <p className="mt-1 text-2xl font-bold text-sky-700">
                {formatCurrency(data.projecao_final)}
              </p>
              <p className="mt-1 text-[11px] text-[var(--color-muted)]">
                Média histórica: {formatCurrency(data.media_historica)}
              </p>
            </div>

            <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-2xs">
              <span className="text-xs text-[var(--color-muted)]">Situação do Orçamento</span>
              <p
                className={`mt-1 text-2xl font-bold ${
                  data.excedente_previsto > 0 ? 'text-rose-600' : 'text-emerald-600'
                }`}
              >
                {data.orcamento_total > 0
                  ? data.excedente_previsto > 0
                    ? `+ ${formatCurrency(data.excedente_previsto)}`
                    : `- ${formatCurrency(Math.abs(data.excedente_previsto))}`
                  : 'Sem meta cadastrada'}
              </p>
              <p className="mt-1 text-[11px] text-[var(--color-muted)]">
                {data.orcamento_total > 0
                  ? `Meta total: ${formatCurrency(data.orcamento_total)}`
                  : 'Cadastre metas para comparar'}
              </p>
            </div>
          </div>

          {/* Gráfico de Projeção Diária */}
          <section className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-2xs">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold text-[var(--color-text)]">
                  Evolução e Projeção Diária Cumulativa
                </h4>
                <p className="text-xs text-[var(--color-muted)]">
                  Linha real realizada vs projeção estatística esperada para o mês
                </p>
              </div>
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.projecao_diaria}>
                  <defs>
                    <linearGradient id="corRealizado" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#14b8a6" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="dia" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                  <YAxis
                    stroke="#94a3b8"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => `R$${v}`}
                  />
                  <Tooltip
                    formatter={(valor: any) => [formatCurrency(Number(valor)), '']}
                    labelFormatter={(d) => `Dia ${d}`}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="realizado_acumulado"
                    name="Gasto Realizado"
                    stroke="#0d9488"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#corRealizado)"
                  />
                  <Line
                    type="monotone"
                    dataKey="projetado_acumulado"
                    name="Linha Projetada"
                    stroke="#64748b"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Tabela de Previsão por Categoria */}
          <section className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-2xs">
            <h4 className="mb-3 text-sm font-semibold text-[var(--color-text)]">
              Projeção de Gastos por Categoria
            </h4>

            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-[var(--color-muted)]">
                    <th className="py-2.5 pr-4 font-semibold">Categoria</th>
                    <th className="py-2.5 pr-4 font-semibold">Gasto Atual</th>
                    <th className="py-2.5 pr-4 font-semibold">Projeção Final</th>
                    <th className="py-2.5 pr-4 font-semibold">Teto Orçado</th>
                    <th className="py-2.5 font-semibold">Diagnóstico</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]/60">
                  {data.categorias_projecao.map((cat) => (
                    <tr key={cat.categoria_id} className="hover:bg-slate-50/60">
                      <td className="py-2.5 pr-4 font-medium text-[var(--color-text)]">
                        {cat.categoria}
                      </td>
                      <td className="py-2.5 pr-4 font-semibold text-[var(--color-text)]">
                        {formatCurrency(cat.realizado_ate_agora)}
                      </td>
                      <td className="py-2.5 pr-4 font-bold text-sky-700">
                        {formatCurrency(cat.projecao_fim_mes)}
                      </td>
                      <td className="py-2.5 pr-4 text-[var(--color-muted)]">
                        {cat.orcamento_limite > 0 ? formatCurrency(cat.orcamento_limite) : '—'}
                      </td>
                      <td className="py-2.5">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            cat.status === 'Risco de exceder'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {cat.status === 'Risco de exceder' ? (
                            <AlertTriangle className="h-3 w-3" />
                          ) : (
                            <CheckCircle2 className="h-3 w-3" />
                          )}
                          <span>{cat.status}</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
