import { useEffect, useState } from 'react'
import {
  CheckCircle2,
  Sparkles,
  Eye,
  Check,
  XCircle,
  RotateCw,
} from 'lucide-react'
import { iaService } from '../services/iaService'
import type { IaAlertaCompleto } from '../types'
import { formatCurrency } from '@/shared/utils/date'
import { getErrorMessage } from '@/shared/utils/error'

type IaAnomaliasTabProps = {
  token?: string
}

export function IaAnomaliasTab({ token }: IaAnomaliasTabProps) {
  const [alertas, setAlertas] = useState<IaAlertaCompleto[]>([])
  const [statusFiltro, setStatusFiltro] = useState<string>('pendente')
  const [gravidadeFiltro, setGravidadeFiltro] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [executandoVarredura, setExecutandoVarredura] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const carregarAlertas = async () => {
    setLoading(true)
    setErro(null)
    try {
      const res = await iaService.listAnomalias(statusFiltro, gravidadeFiltro, token)
      setAlertas(res.alertas)
    } catch (err) {
      setErro(getErrorMessage(err, 'Erro ao carregar anomalias e alertas.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarAlertas()
  }, [statusFiltro, gravidadeFiltro, token])

  const dispararVarredura = async () => {
    setExecutandoVarredura(true)
    setFeedback(null)
    setErro(null)
    try {
      const res = await iaService.analisarAnomalias(token)
      setFeedback(
        res.novos_alertas_criados > 0
          ? `Varredura concluída! ${res.novos_alertas_criados} nova(s) ocorrência(s) detectada(s).`
          : 'Varredura concluída! Nenhuma nova anomalia identificada nos lançamentos recentes.'
      )
      await carregarAlertas()
    } catch (err) {
      setErro(getErrorMessage(err, 'Erro ao executar varredura de anomalias.'))
    } finally {
      setExecutandoVarredura(false)
    }
  }

  const handleMudarStatus = async (
    id: number,
    novoStatus: 'pendente' | 'lido' | 'resolvido' | 'ignorado'
  ) => {
    try {
      await iaService.updateAnomaliaStatus(id, novoStatus, token)
      setAlertas((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: novoStatus } : a))
      )
    } catch (err) {
      setErro(getErrorMessage(err, 'Erro ao atualizar alerta.'))
    }
  }

  return (
    <div className="space-y-6">
      {/* Header e Barra de Ações */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-2xs">
        <div className="space-y-0.5">
          <h3 className="text-sm font-semibold text-[var(--color-text)]">
            Central de Monitoramento e Anomalias
          </h3>
          <p className="text-xs text-[var(--color-muted)]">
            Identificação de desvios padrão, possíveis lançamentos duplicados e estouros de teto
          </p>
        </div>

        <button
          type="button"
          onClick={dispararVarredura}
          disabled={executandoVarredura}
          className="inline-flex items-center gap-2 rounded-[var(--radius-sm)] bg-[var(--color-primary)] px-3.5 py-2 text-xs font-semibold text-white shadow-2xs transition hover:opacity-90 disabled:opacity-50 cursor-pointer"
        >
          {executandoVarredura ? (
            <RotateCw className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          <span>{executandoVarredura ? 'Executando Varredura...' : 'Executar Varredura com IA'}</span>
        </button>
      </div>

      {feedback ? (
        <div className="rounded-[var(--radius-md)] border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
          {feedback}
        </div>
      ) : null}

      {erro ? (
        <div className="rounded-[var(--radius-md)] border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
          {erro}
        </div>
      ) : null}

      {/* Barra de Filtros */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] pb-3">
        {/* Status */}
        <div className="flex items-center gap-1.5">
          {[
            { id: 'pendente', label: 'Pendentes' },
            { id: 'lido', label: 'Lidos' },
            { id: 'resolvido', label: 'Resolvidos' },
            { id: 'todos', label: 'Todos' },
          ].map((st) => (
            <button
              key={st.id}
              type="button"
              onClick={() => setStatusFiltro(st.id)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition cursor-pointer ${
                statusFiltro === st.id
                  ? 'bg-slate-800 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>

        {/* Gravidade */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-[var(--color-muted)]">Gravidade:</span>
          <select
            value={gravidadeFiltro}
            onChange={(e) => setGravidadeFiltro(e.target.value)}
            className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1 text-xs text-[var(--color-text)]"
          >
            <option value="">Todas</option>
            <option value="critico">Crítico</option>
            <option value="atencao">Atenção</option>
            <option value="info">Informativo</option>
          </select>
        </div>
      </div>

      {/* Lista de Alertas */}
      {loading ? (
        <div className="flex h-56 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-muted)]">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 animate-spin text-[var(--color-primary)]" />
            <span>Consultando anomalias...</span>
          </div>
        </div>
      ) : alertas.length === 0 ? (
        <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-12 text-center">
          <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-emerald-500" />
          <h4 className="text-sm font-semibold text-[var(--color-text)]">
            Nenhuma anomalia identificada
          </h4>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            Não há alertas {statusFiltro !== 'todos' ? `com status '${statusFiltro}'` : ''} para o filtro selecionado.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {alertas.map((alerta) => (
            <article
              key={alerta.id}
              className={`flex flex-col justify-between gap-4 rounded-[var(--radius-md)] border p-4 shadow-2xs transition sm:flex-row sm:items-center ${
                alerta.status === 'resolvido' || alerta.status === 'ignorado'
                  ? 'border-slate-200 bg-slate-50/50 opacity-70'
                  : alerta.gravidade === 'critico'
                  ? 'border-rose-200 bg-rose-50/30'
                  : alerta.gravidade === 'atencao'
                  ? 'border-amber-200 bg-amber-50/30'
                  : 'border-[var(--color-border)] bg-[var(--color-surface)]'
              }`}
            >
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      alerta.gravidade === 'critico'
                        ? 'bg-rose-100 text-rose-800'
                        : alerta.gravidade === 'atencao'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-sky-100 text-sky-800'
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        alerta.gravidade === 'critico'
                          ? 'bg-rose-600'
                          : alerta.gravidade === 'atencao'
                          ? 'bg-amber-600'
                          : 'bg-sky-600'
                      }`}
                    />
                    <span>{alerta.gravidade.toUpperCase()}</span>
                  </span>

                  {alerta.categoria_nome ? (
                    <span className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-2 py-0.5 text-[10px] font-medium text-slate-700">
                      {alerta.categoria_nome}
                    </span>
                  ) : null}

                  <span className="text-[11px] text-[var(--color-muted)]">
                    {alerta.created_at ? new Date(alerta.created_at).toLocaleDateString('pt-BR') : ''}
                  </span>
                </div>

                <h4 className="text-sm font-semibold text-[var(--color-text)]">
                  {alerta.titulo}
                </h4>
                <p className="text-xs text-slate-700 leading-relaxed max-w-2xl">
                  {alerta.descricao}
                </p>
              </div>

              {/* Lado Direito: Valor e Ações */}
              <div className="flex flex-row items-center justify-between gap-4 sm:flex-col sm:items-end">
                {alerta.valor_envolvido ? (
                  <span className="text-base font-bold text-[var(--color-text)]">
                    {formatCurrency(alerta.valor_envolvido)}
                  </span>
                ) : (
                  <span />
                )}

                <div className="flex items-center gap-1.5">
                  {alerta.status === 'pendente' ? (
                    <button
                      type="button"
                      onClick={() => handleMudarStatus(alerta.id, 'lido')}
                      title="Marcar como lido"
                      className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-100 cursor-pointer"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>Lido</span>
                    </button>
                  ) : null}

                  {alerta.status !== 'resolvido' ? (
                    <button
                      type="button"
                      onClick={() => handleMudarStatus(alerta.id, 'resolvido')}
                      title="Marcar como resolvido"
                      className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800 hover:bg-emerald-100 cursor-pointer"
                    >
                      <Check className="h-3.5 w-3.5" />
                      <span>Resolver</span>
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Resolvido</span>
                    </span>
                  )}

                  {alerta.status !== 'ignorado' ? (
                    <button
                      type="button"
                      onClick={() => handleMudarStatus(alerta.id, 'ignorado')}
                      title="Ignorar alerta"
                      className="rounded-[var(--radius-sm)] p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer"
                    >
                      <XCircle className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
