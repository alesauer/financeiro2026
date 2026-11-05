import { useEffect, useState } from 'react'
import {
  Sparkles,
  TrendingUp,
  AlertTriangle,
  Bot,
  ArrowRight,
  ShieldAlert,
  CheckCircle2,
  DollarSign,
  PieChart,
} from 'lucide-react'
import { iaService } from '../services/iaService'
import type { IaDashboardData } from '../types'
import { formatCurrency } from '@/shared/utils/date'
import { getErrorMessage } from '@/shared/utils/error'

type IaVisaoGeralTabProps = {
  token?: string
  onNavegarAba: (aba: string) => void
}

export function IaVisaoGeralTab({ token, onNavegarAba }: IaVisaoGeralTabProps) {
  const [data, setData] = useState<IaDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function carregar() {
      setLoading(true)
      setError(null)
      try {
        const res = await iaService.getDashboard(token)
        setData(res)
      } catch (err) {
        setError(getErrorMessage(err, 'Não foi possível carregar o dashboard de IA.'))
      } finally {
        setLoading(false)
      }
    }
    carregar()
  }, [token])

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-muted)]">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 animate-spin text-[var(--color-primary)]" />
          <span>Consolidando dados e inteligência financeira...</span>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="rounded-[var(--radius-md)] border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
        {error || 'Dados indisponíveis.'}
      </div>
    )
  }

  const kpis = data.kpis

  return (
    <div className="space-y-6">
      {/* Resumo executivo da IA */}
      <article className="relative overflow-hidden rounded-[var(--radius-md)] border border-emerald-200 bg-linear-to-r from-emerald-50/70 via-teal-50/40 to-slate-50 p-5 shadow-2xs">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white shadow-xs">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-emerald-900">
                Diagnóstico de Inteligência Financeira · {data.periodo}
              </h3>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                Confiabilidade {kpis.grau_confianca_previsao}%
              </span>
            </div>
            <p className="text-sm leading-relaxed text-slate-700">{data.resumo_previsao}</p>
          </div>
        </div>
      </article>

      {/* Grid de KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-medium text-[var(--color-muted)]">
            <span>Gasto Acumulado</span>
            <DollarSign className="h-4 w-4 text-[var(--color-muted)]" />
          </div>
          <p className="mt-2 text-2xl font-bold text-[var(--color-text)]">
            {formatCurrency(kpis.gasto_acumulado)}
          </p>
          <p className="mt-1 text-xs text-[var(--color-muted)]">Realizado no período</p>
        </div>

        <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-medium text-[var(--color-muted)]">
            <span>Projeção de Fechamento</span>
            <TrendingUp className="h-4 w-4 text-sky-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-sky-700">
            {formatCurrency(kpis.projecao_final)}
          </p>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            {kpis.orcamento_total > 0
              ? `Teto: ${formatCurrency(kpis.orcamento_total)}`
              : 'Estimativa estatística'}
          </p>
        </div>

        <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-medium text-[var(--color-muted)]">
            <span>Alertas de Anomalias</span>
            <ShieldAlert className="h-4 w-4 text-amber-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-[var(--color-text)]">
            {kpis.alertas_pendentes}
          </p>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            {kpis.alertas_pendentes === 0 ? 'Nenhum desvio pendente' : 'Requerem sua atenção'}
          </p>
        </div>

        <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-medium text-[var(--color-muted)]">
            <span>Interações com IA</span>
            <Bot className="h-4 w-4 text-[var(--color-primary)]" />
          </div>
          <p className="mt-2 text-2xl font-bold text-[var(--color-text)]">
            {kpis.total_conversas}
          </p>
          <p className="mt-1 text-xs text-[var(--color-muted)]">Conversas no histórico</p>
        </div>
      </div>

      {/* Grid de Recomendações e Alertas Recentes */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recomendações Inteligentes */}
        <section className="space-y-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              Recomendações Personalizadas
            </h3>
            <Sparkles className="h-4 w-4 text-[var(--color-primary)]" />
          </div>

          <div className="space-y-3 pt-1">
            {data.recomendacoes.length === 0 ? (
              <p className="text-xs text-[var(--color-muted)]">Nenhuma recomendação no momento.</p>
            ) : (
              data.recomendacoes.map((rec, idx) => (
                <div
                  key={idx}
                  className={`flex items-start gap-3 rounded-[var(--radius-sm)] border p-3.5 text-xs transition ${
                    rec.tipo === 'alerta'
                      ? 'border-amber-200 bg-amber-50/50 text-amber-900'
                      : rec.tipo === 'sucesso'
                      ? 'border-emerald-200 bg-emerald-50/50 text-emerald-900'
                      : 'border-slate-200 bg-slate-50/50 text-slate-800'
                  }`}
                >
                  {rec.tipo === 'alerta' ? (
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  ) : rec.tipo === 'sucesso' ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  ) : (
                    <PieChart className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
                  )}
                  <div className="space-y-0.5">
                    <p className="font-semibold text-[13px]">{rec.titulo}</p>
                    <p className="leading-relaxed opacity-90">{rec.texto}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Alertas Recentes de Anomalias */}
        <section className="space-y-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              Anomalias e Alertas Recentes
            </h3>
            <button
              type="button"
              onClick={() => onNavegarAba('anomalias')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-primary)] hover:underline cursor-pointer"
            >
              <span>Ver todas</span>
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>

          <div className="space-y-2.5 pt-1">
            {data.alertas_recentes.length === 0 ? (
              <div className="rounded-[var(--radius-sm)] border border-dashed border-[var(--color-border)] p-6 text-center text-xs text-[var(--color-muted)]">
                <CheckCircle2 className="mx-auto mb-1.5 h-5 w-5 text-emerald-500" />
                <p>Nenhuma anomalia financeira pendente identificada.</p>
              </div>
            ) : (
              data.alertas_recentes.map((alerta) => (
                <div
                  key={alerta.id}
                  className="flex items-start justify-between gap-3 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-block h-2 w-2 rounded-full ${
                          alerta.gravidade === 'critico'
                            ? 'bg-rose-500'
                            : alerta.gravidade === 'atencao'
                            ? 'bg-amber-500'
                            : 'bg-sky-500'
                        }`}
                      />
                      <p className="font-semibold text-[var(--color-text)]">{alerta.titulo}</p>
                    </div>
                    <p className="text-[var(--color-muted)] line-clamp-2">{alerta.descricao}</p>
                  </div>
                  {alerta.valor_envolvido ? (
                    <span className="shrink-0 font-bold text-[var(--color-text)]">
                      {formatCurrency(alerta.valor_envolvido)}
                    </span>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {/* Acesso rápido às funcionalidades */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          Acesso Rápido
        </h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => onNavegarAba('assistente')}
            className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-left transition hover:border-[var(--color-primary)] hover:shadow-xs cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--color-text)]">Assistente Financeiro</p>
                <p className="text-xs text-[var(--color-muted)]">Pergunte em linguagem natural</p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-[var(--color-muted)]" />
          </button>

          <button
            type="button"
            onClick={() => onNavegarAba('previsao')}
            className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-left transition hover:border-[var(--color-primary)] hover:shadow-xs cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-50 text-sky-700">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--color-text)]">Previsão de Gastos</p>
                <p className="text-xs text-[var(--color-muted)]">Projeções e teto do mês</p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-[var(--color-muted)]" />
          </button>

          <button
            type="button"
            onClick={() => onNavegarAba('anomalias')}
            className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-left transition hover:border-[var(--color-primary)] hover:shadow-xs cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--color-text)]">Anomalias e Alertas</p>
                <p className="text-xs text-[var(--color-muted)]">Identificação de desvios</p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-[var(--color-muted)]" />
          </button>
        </div>
      </section>
    </div>
  )
}
