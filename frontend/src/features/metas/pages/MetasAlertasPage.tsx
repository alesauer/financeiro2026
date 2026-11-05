import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Flame,
  Info,
  RotateCcw,
} from 'lucide-react'

import { useAuth } from '@/app/providers/AuthProvider'
import { MetasPageHeader } from '@/features/metas/components/MetasPageHeader'
import { metasService } from '@/features/metas/services/metasService'
import type { AlertaMetaItem, AlertasMetasResponse } from '@/features/metas/types/metas'
import { getErrorMessage } from '@/shared/utils/error'

type AbaAlerta = 'ativos' | 'historico' | 'configuracoes'

export function MetasAlertasPage() {
  const { token } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const hoje = new Date()
  const [mes, setMes] = useState<number>(() => Number(searchParams.get('mes')) || hoje.getMonth() + 1)
  const [ano, setAno] = useState<number>(() => Number(searchParams.get('ano')) || hoje.getFullYear())
  const [aba, setAba] = useState<AbaAlerta>('ativos')

  const [dados, setDados] = useState<AlertasMetasResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [savingConfig, setSavingConfig] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [limiteAtencao, setLimiteAtencao] = useState<number>(75)
  const [limiteUltrapassada, setLimiteUltrapassada] = useState<number>(100)
  const [toleranciaRitmo, setToleranciaRitmo] = useState<number>(10)
  const [alertaRitmoAtivo, setAlertaRitmoAtivo] = useState<boolean>(true)

  const carregar = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const resp = await metasService.alertas(token, mes, ano)
      setDados(resp)
      if (resp.configuracoes) {
        setLimiteAtencao(resp.configuracoes.limite_atencao ?? 75)
        setLimiteUltrapassada(resp.configuracoes.limite_ultrapassada ?? 100)
        setToleranciaRitmo(resp.configuracoes.tolerancia_ritmo_pct ?? 10)
        setAlertaRitmoAtivo(resp.configuracoes.alerta_ritmo_ativo ?? true)
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Não foi possível carregar os alertas.'))
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

  const handleMarcarLido = async (alerta: AlertaMetaItem, lido: boolean) => {
    if (!token) return
    try {
      await metasService.marcarAlertaLido(token, {
        chave: alerta.chave,
        lido,
        meta_id: alerta.meta_id,
        tipo: alerta.tipo,
        titulo: alerta.titulo,
        mensagem: alerta.mensagem,
      })
      await carregar()
    } catch (err) {
      setError(getErrorMessage(err, 'Erro ao atualizar status do alerta.'))
    }
  }

  const handleMarcarTodosLidos = async () => {
    if (!token || !dados || dados.ativos.length === 0) return
    try {
      await metasService.marcarAlertaLido(token, {
        chaves: dados.ativos.map((a) => a.chave),
        lido: true,
      })
      await carregar()
    } catch (err) {
      setError(getErrorMessage(err, 'Erro ao marcar alertas como lidos.'))
    }
  }

  const handleSalvarConfig = async () => {
    if (!token) return
    setSavingConfig(true)
    setFeedback(null)
    setError(null)
    try {
      await metasService.salvarConfigAlertas(token, {
        limite_atencao: limiteAtencao,
        limite_ultrapassada: limiteUltrapassada,
        tolerancia_ritmo_pct: toleranciaRitmo,
        alerta_ritmo_ativo: alertaRitmoAtivo,
      })
      setFeedback('Configurações de classificação e alertas salvas com sucesso!')
      await carregar()
    } catch (err) {
      setError(getErrorMessage(err, 'Erro ao salvar configurações de alertas.'))
    } finally {
      setSavingConfig(false)
    }
  }

  const getEstiloAlerta = (alerta: AlertaMetaItem) => {
    if (alerta.severidade === 'critica') {
      return {
        cardBg: 'border-rose-200 bg-rose-50/50',
        iconBg: 'text-rose-600',
        titleColor: 'text-rose-700',
        Icon: Flame,
      }
    }
    if (alerta.severidade === 'aviso') {
      return {
        cardBg: 'border-amber-200 bg-amber-50/50',
        iconBg: 'text-amber-600',
        titleColor: 'text-amber-800',
        Icon: AlertTriangle,
      }
    }
    if (alerta.severidade === 'sucesso') {
      return {
        cardBg: 'border-emerald-200 bg-emerald-50/50',
        iconBg: 'text-emerald-600',
        titleColor: 'text-emerald-800',
        Icon: CheckCircle2,
      }
    }
    return {
      cardBg: 'border-sky-200 bg-sky-50/50',
      iconBg: 'text-sky-600',
      titleColor: 'text-sky-800',
      Icon: Info,
    }
  }

  const listaAtual = aba === 'ativos' ? dados?.ativos ?? [] : dados?.historico ?? []

  return (
    <section className="space-y-6">
      <MetasPageHeader
        subtitulo="Alertas"
        mes={mes}
        ano={ano}
        onChangePeriodo={handleChangePeriodo}
        rightActions={
          aba === 'ativos' && (dados?.ativos.length ?? 0) > 0 ? (
            <button
              type="button"
              onClick={handleMarcarTodosLidos}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text)] hover:bg-slate-50 cursor-pointer"
            >
              <Check className="h-3.5 w-3.5 text-emerald-600" />
              Marcar todos como lidos
            </button>
          ) : null
        }
      />

      {/* Abas */}
      <div className="flex items-center gap-2 border-b border-[var(--color-border)]">
        <button
          type="button"
          onClick={() => setAba('ativos')}
          className={`-mb-px border-b-2 px-4 py-2 text-xs font-semibold transition-colors cursor-pointer ${
            aba === 'ativos'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-[var(--color-muted)] hover:text-[var(--color-text)]'
          }`}
        >
          Ativos ({dados?.ativos.length ?? 0})
        </button>

        <button
          type="button"
          onClick={() => setAba('historico')}
          className={`-mb-px border-b-2 px-4 py-2 text-xs font-semibold transition-colors cursor-pointer ${
            aba === 'historico'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-[var(--color-muted)] hover:text-[var(--color-text)]'
          }`}
        >
          Histórico ({dados?.historico.length ?? 0})
        </button>

        <button
          type="button"
          onClick={() => setAba('configuracoes')}
          className={`-mb-px border-b-2 px-4 py-2 text-xs font-semibold transition-colors cursor-pointer ${
            aba === 'configuracoes'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-[var(--color-muted)] hover:text-[var(--color-text)]'
          }`}
        >
          Configurações
        </button>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {feedback ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {feedback}
        </div>
      ) : null}

      {loading && !dados ? (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-12 text-center text-sm text-[var(--color-muted)]">
          Carregando central de alertas...
        </div>
      ) : aba === 'configuracoes' ? (
        <div className="max-w-2xl space-y-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-2xs">
          <div>
            <h3 className="text-base font-bold text-[var(--color-text)]">
              Parâmetros de Classificação e Alertas
            </h3>
            <p className="text-xs text-[var(--color-muted)]">
              Defina os percentuais que determinam quando uma meta entra em atenção ou é considerada ultrapassada.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-[var(--color-muted)]">
                Limite para "Em atenção" (%)
              </label>
              <input
                type="number"
                min={10}
                max={99}
                value={limiteAtencao}
                onChange={(e) => setLimiteAtencao(Number(e.target.value))}
                className="w-full rounded-lg border border-[var(--color-border)] bg-white px-3.5 py-2 text-sm font-bold text-[var(--color-text)] outline-none focus:border-emerald-600"
              />
              <p className="text-[11px] text-[var(--color-muted)]">
                Padrão recomendado: 75% (abaixo disso fica "Dentro da meta").
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-[var(--color-muted)]">
                Limite para "Ultrapassada" (%)
              </label>
              <input
                type="number"
                min={50}
                max={200}
                value={limiteUltrapassada}
                onChange={(e) => setLimiteUltrapassada(Number(e.target.value))}
                className="w-full rounded-lg border border-[var(--color-border)] bg-white px-3.5 py-2 text-sm font-bold text-[var(--color-text)] outline-none focus:border-emerald-600"
              />
              <p className="text-[11px] text-[var(--color-muted)]">
                Padrão recomendado: 100% do orçamento planejado.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 pt-2">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-[var(--color-muted)]">
                Tolerância de ritmo do mês (%)
              </label>
              <input
                type="number"
                min={1}
                max={50}
                value={toleranciaRitmo}
                onChange={(e) => setToleranciaRitmo(Number(e.target.value))}
                className="w-full rounded-lg border border-[var(--color-border)] bg-white px-3.5 py-2 text-sm font-bold text-[var(--color-text)] outline-none focus:border-emerald-600"
              />
              <p className="text-[11px] text-[var(--color-muted)]">
                Dispara alerta quando o consumo supera o % de dias decorridos + tolerância.
              </p>
            </div>

            <div className="flex items-center pt-5">
              <label className="inline-flex cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={alertaRitmoAtivo}
                  onChange={(e) => setAlertaRitmoAtivo(e.target.checked)}
                  className="h-4 w-4 rounded accent-emerald-600"
                />
                <span className="text-xs font-medium text-[var(--color-text)]">
                  Monitorar ritmo de gastos acelerado
                </span>
              </label>
            </div>
          </div>

          <div className="flex justify-end pt-3">
            <button
              type="button"
              disabled={savingConfig}
              onClick={handleSalvarConfig}
              className="rounded-lg bg-emerald-700 px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-800 disabled:opacity-50 cursor-pointer"
            >
              {savingConfig ? 'Salvando...' : 'Salvar Configurações'}
            </button>
          </div>
        </div>
      ) : listaAtual.length === 0 ? (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-10 text-center">
          <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-emerald-600" />
          <p className="text-sm font-semibold text-[var(--color-text)]">
            {aba === 'ativos'
              ? 'Nenhum alerta ativo neste período!'
              : 'Nenhum alerta arquivado no histórico deste período.'}
          </p>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            Suas metas monitoradas estão sendo acompanhadas automaticamente conforme novos lançamentos entram.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {listaAtual.map((alerta) => {
            const est = getEstiloAlerta(alerta)
            const Icon = est.Icon
            return (
              <article
                key={alerta.chave}
                className={`flex flex-col justify-between gap-4 rounded-xl border p-4 shadow-2xs sm:flex-row sm:items-center ${est.cardBg}`}
              >
                <div className="flex items-start gap-3.5">
                  <div className={`mt-0.5 shrink-0 ${est.iconBg}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className={`text-sm font-bold ${est.titleColor}`}>{alerta.titulo}</h4>
                    <p className="mt-0.5 text-xs text-[var(--color-text)]">{alerta.mensagem}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-3 shrink-0">
                  <span className="text-xs text-[var(--color-muted)]">{alerta.data_hora}</span>

                  <button
                    type="button"
                    onClick={() => {
                      if (alerta.acao_tipo === 'ver_analise') {
                        navigate(`/metas/analises?mes=${mes}&ano=${ano}`)
                      } else {
                        navigate(`/metas/${alerta.meta_id}?mes=${mes}&ano=${ano}`)
                      }
                    }}
                    className="rounded-lg border border-[var(--color-border)] bg-white px-3.5 py-1.5 text-xs font-semibold text-[var(--color-text)] shadow-2xs hover:bg-slate-50 cursor-pointer"
                  >
                    {alerta.acao_label}
                  </button>

                  {aba === 'ativos' ? (
                    <button
                      type="button"
                      onClick={() => handleMarcarLido(alerta, true)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-white/70 hover:text-emerald-700 cursor-pointer"
                      title="Marcar como lido"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleMarcarLido(alerta, false)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-white/70 hover:text-slate-700 cursor-pointer"
                      title="Restaurar para alertas ativos"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}

