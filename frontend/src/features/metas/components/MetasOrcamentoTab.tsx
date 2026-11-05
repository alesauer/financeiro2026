import { useCallback, useEffect, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  Flame,
  PiggyBank,
  Settings2,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react'

import { useAuth } from '@/app/providers/AuthProvider'
import { ConfigurarMetasModal } from '@/features/metas/components/ConfigurarMetasModal'
import { metasService } from '@/features/metas/services/metasService'
import type {
  ResumoMetasResponse,
  SalvarMetaItemPayload,
  StatusMetaDespesa,
} from '@/features/metas/services/metasService'
import { formatCurrency } from '@/shared/utils/date'
import { getErrorMessage } from '@/shared/utils/error'

const MESES_NOMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

const MESES_CURTOS = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
]

function corStatusDespesa(status: StatusMetaDespesa) {
  if (status === 'estourado') {
    return {
      bar: 'bg-rose-500',
      badge: 'border-rose-200 bg-rose-50 text-rose-700',
      text: 'text-rose-600',
      label: 'Meta estourada',
    }
  }
  if (status === 'atencao') {
    return {
      bar: 'bg-amber-500',
      badge: 'border-amber-200 bg-amber-50 text-amber-800',
      text: 'text-amber-600',
      label: 'Atenção / Acima do ritmo',
    }
  }
  return {
    bar: 'bg-emerald-500',
    badge: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    text: 'text-emerald-600',
    label: 'Dentro da meta',
  }
}

interface MetasOrcamentoTabProps {
  ano: number
  onVerTransacoesCategoria?: (mesIndexZero: number, categoriaId: number) => void
  onVerTransacoesCartao?: (mesIndexZero: number) => void
}

export function MetasOrcamentoTab({
  ano,
  onVerTransacoesCategoria,
  onVerTransacoesCartao,
}: MetasOrcamentoTabProps) {
  const { token } = useAuth()
  const [mes, setMes] = useState<number>(() => new Date().getMonth() + 1)
  const [dados, setDados] = useState<ResumoMetasResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [gerandoSugestao, setGerandoSugestao] = useState(false)

  const carregarResumo = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const resp = await metasService.resumo(token, mes, ano)
      setDados(resp)
    } catch (err) {
      setError(getErrorMessage(err, 'Não foi possível carregar as metas de orçamento.'))
    } finally {
      setLoading(false)
    }
  }, [token, mes, ano])

  useEffect(() => {
    carregarResumo()
  }, [carregarResumo])

  const handleGerarSugestoesUmClique = async (fatorDespesa = 0.9) => {
    if (!token || !dados) return
    setGerandoSugestao(true)
    setError(null)
    try {
      const itens: SalvarMetaItemPayload[] = []

      if (dados.catalogo.global_despesa.media_3m > 0) {
        itens.push({
          escopo: 'global_despesa',
          valor_limite: Math.round(dados.catalogo.global_despesa.media_3m * fatorDespesa),
        })
      }

      if (dados.catalogo.global_investimento.media_3m > 0) {
        itens.push({
          escopo: 'global_investimento',
          valor_limite: Math.round(dados.catalogo.global_investimento.media_3m),
        })
      }

      for (const c of dados.catalogo.cartoes) {
        if (c.media_3m > 0) {
          itens.push({
            escopo: 'cartao',
            forma_pagamento_id: c.forma_pagamento_id,
            valor_limite: Math.round(c.media_3m * fatorDespesa),
          })
        }
      }

      // Pega as top 8 categorias com maior média histórica para não poluir categorias irrelevantes
      const topCats = [...dados.catalogo.categorias]
        .filter((cat) => cat.media_3m >= 50)
        .sort((a, b) => b.media_3m - a.media_3m)
        .slice(0, 8)

      for (const cat of topCats) {
        itens.push({
          escopo: 'categoria',
          categoria_id: cat.categoria_id,
          valor_limite: Math.round(cat.media_3m * fatorDespesa),
        })
      }

      await metasService.salvarLote(token, {
        modo: 'padrao',
        itens,
      })
      await carregarResumo()
    } catch (err) {
      setError(getErrorMessage(err, 'Não foi possível gerar metas sugeridas.'))
    } finally {
      setGerandoSugestao(false)
    }
  }

  const mesNome = MESES_NOMES[mes - 1] ?? 'Mês'
  const pctMes = dados?.periodo.percentual_mes_decorrido ?? 0
  const temAlgumaMeta = (dados?.sumario_alertas.total_metas_ativas ?? 0) > 0

  return (
    <div className="space-y-5">
      {/* Barra de selecao de Mes + Acoes */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-2xs">
        <div className="flex flex-wrap items-center gap-1">
          {MESES_CURTOS.map((rotulo, idx) => {
            const mNum = idx + 1
            const ativo = mNum === mes
            return (
              <button
                key={rotulo}
                type="button"
                onClick={() => setMes(mNum)}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                  ativo
                    ? 'bg-teal-600 text-white shadow-2xs'
                    : 'text-[var(--color-muted)] hover:bg-slate-100 hover:text-[var(--color-text)]'
                }`}
              >
                {rotulo}
              </button>
            )
          })}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {dados && pctMes > 0 && pctMes < 100 ? (
            <div
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700"
              title="A linha vertical escura nas barras representa onde seu gasto deveria estar hoje pelo dia do mês"
            >
              <span className="inline-block h-3 w-0.5 bg-slate-800" />
              <span>
                Ritmo do mês: <strong>Dia {dados.periodo.dia_referencia}/{dados.periodo.dias_no_mes}</strong> ({pctMes}%)
              </span>
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-teal-700 transition-colors cursor-pointer"
          >
            <Settings2 className="h-4 w-4" />
            Configurar Metas
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {loading && !dados ? (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-10 text-center text-sm text-[var(--color-muted)]">
          Calculando metas e histórico de {mesNome}/{ano}...
        </div>
      ) : !dados ? null : !temAlgumaMeta ? (
        /* Empty state com gerador inteligente em 1 clique */
        <div className="rounded-2xl border border-teal-200 bg-gradient-to-br from-teal-50/70 via-white to-sky-50/50 p-8 text-center shadow-xs">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-600 text-white shadow-md">
            <Target className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-bold text-[var(--color-text)]">
            Você ainda não configurou metas para {mesNome}/{ano}
          </h3>
          <p className="mx-auto mt-1 max-w-xl text-sm text-[var(--color-muted)]">
            Analisamos suas transações dos últimos 3 meses. Sua média de gastos mensais é de{' '}
            <strong className="text-[var(--color-text)]">
              {formatCurrency(dados.catalogo.global_despesa.media_3m)}
            </strong>
            . Quer criar um orçamento inteligente com 1 clique ou personalizar manualmente?
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              disabled={gerandoSugestao}
              onClick={() => handleGerarSugestoesUmClique(0.9)}
              className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 disabled:opacity-50 cursor-pointer"
            >
              <Sparkles className="h-4 w-4" />
              {gerandoSugestao
                ? 'Criando metas...'
                : 'Criar Metas Sugeridas (Economia de 10%)'}
            </button>

            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-white px-5 py-2.5 text-sm font-semibold text-[var(--color-text)] hover:bg-slate-50 cursor-pointer"
            >
              <Settings2 className="h-4 w-4" />
              Personalizar Manualmente
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Resumo rapido de status */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/50 p-3.5">
              <CheckCircle2 className="h-8 w-8 shrink-0 text-emerald-600" />
              <div>
                <p className="text-xs font-medium text-emerald-800">Dentro do planejado</p>
                <p className="text-lg font-bold text-emerald-950">
                  {dados.sumario_alertas.ok} {dados.sumario_alertas.ok === 1 ? 'meta' : 'metas'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50/50 p-3.5">
              <AlertTriangle className="h-8 w-8 shrink-0 text-amber-600" />
              <div>
                <p className="text-xs font-medium text-amber-800">Em atenção / Acima do ritmo</p>
                <p className="text-lg font-bold text-amber-950">
                  {dados.sumario_alertas.atencao} {dados.sumario_alertas.atencao === 1 ? 'meta' : 'metas'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50/50 p-3.5">
              <Flame className="h-8 w-8 shrink-0 text-rose-600" />
              <div>
                <p className="text-xs font-medium text-rose-800">Limite ultrapassado</p>
                <p className="text-lg font-bold text-rose-950">
                  {dados.sumario_alertas.estouradas}{' '}
                  {dados.sumario_alertas.estouradas === 1 ? 'meta' : 'metas'}
                </p>
              </div>
            </div>
          </div>

          {/* 1. Metas Globais (Teto Global de Gastos + Meta de Aporte) */}
          {dados.meta_global_despesa || dados.meta_global_investimento ? (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {dados.meta_global_despesa ? (
                <CardMetaGlobalDespesa
                  meta={dados.meta_global_despesa}
                  pctMes={pctMes}
                  mesNome={mesNome}
                />
              ) : null}

              {dados.meta_global_investimento ? (
                <CardMetaGlobalInvestimento
                  meta={dados.meta_global_investimento}
                  mesNome={mesNome}
                />
              ) : null}
            </div>
          ) : null}

          {/* 2. Teto de Fatura por Cartao de Credito */}
          {dados.metas_cartoes.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-[var(--color-text)]">
                    Teto de Fatura — Cartões de Crédito
                  </h3>
                  <p className="text-xs text-[var(--color-muted)]">
                    Acompanhe quanto já está comprometido com parcelas antigas e sua margem livre para compras à vista em {mesNome}.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {dados.metas_cartoes.map((cartao) => {
                  const cores = corStatusDespesa(cartao.status)
                  const pctParc = Math.min(100, cartao.percentual_parcelado)
                  const pctAvulso = Math.min(100 - pctParc, cartao.percentual_avulso)
                  return (
                    <article
                      key={cartao.forma_pagamento_id}
                      onClick={() => onVerTransacoesCartao?.(mes - 1)}
                      className="group cursor-pointer rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-2xs transition-all hover:border-purple-300 hover:shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <span
                            className="flex h-9 w-9 items-center justify-center rounded-lg text-white shadow-2xs"
                            style={{ backgroundColor: cartao.cor || '#820AD1' }}
                          >
                            <CreditCard className="h-5 w-5" />
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-[var(--color-text)]">{cartao.nome}</h4>
                              {cartao.is_override ? (
                                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                                  Exceção {mesNome}
                                </span>
                              ) : null}
                            </div>
                            <p className="text-xs text-[var(--color-muted)]">
                              Média últimos 3 meses: {formatCurrency(cartao.media_3m)}
                            </p>
                          </div>
                        </div>

                        <span
                          className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cores.badge}`}
                        >
                          {cartao.percentual.toFixed(0)}% • {cores.label}
                        </span>
                      </div>

                      {/* Numeros principais */}
                      <div className="mt-4 flex items-baseline justify-between">
                        <div>
                          <span className="text-xs text-[var(--color-muted)]">Fatura atual: </span>
                          <span className={`text-xl font-bold tabular-nums ${cores.text}`}>
                            {formatCurrency(cartao.valor_realizado)}
                          </span>
                          <span className="text-xs text-[var(--color-muted)]">
                            {' '}
                            de {formatCurrency(cartao.valor_limite)}
                          </span>
                        </div>
                        <div className="text-right">
                          {cartao.margem_livre >= 0 ? (
                            <span className="text-xs font-semibold text-emerald-700">
                              Livre no teto: {formatCurrency(cartao.margem_livre)}
                            </span>
                          ) : (
                            <span className="text-xs font-bold text-rose-600">
                              Excedeu em {formatCurrency(Math.abs(cartao.margem_livre))}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Barra segmentada: Parcelas vs Avulsos + Pacing Marker */}
                      <div className="relative mt-2.5 h-3.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div className="flex h-full w-full">
                          <div
                            className="h-full bg-purple-600 transition-all duration-300"
                            style={{ width: `${pctParc}%` }}
                            title={`Comprometido em parcelas: ${formatCurrency(cartao.parcelado_comprometido)}`}
                          />
                          <div
                            className={`h-full transition-all duration-300 ${
                              cartao.status === 'estourado'
                                ? 'bg-rose-500'
                                : cartao.status === 'atencao'
                                  ? 'bg-amber-500'
                                  : 'bg-sky-500'
                            }`}
                            style={{ width: `${pctAvulso}%` }}
                            title={`Gastos à vista do mês: ${formatCurrency(cartao.gastos_avulsos)}`}
                          />
                        </div>

                        {pctMes > 0 && pctMes < 100 ? (
                          <div
                            className="pointer-events-none absolute top-0 bottom-0 w-0.5 bg-slate-900"
                            style={{ left: `${pctMes}%` }}
                            title={`Ritmo esperado hoje (${pctMes}%)`}
                          />
                        ) : null}
                      </div>

                      {/* Legenda da decomposicao da fatura */}
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--color-muted)]">
                        <div className="flex items-center gap-4">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="h-2.5 w-2.5 rounded-xs bg-purple-600" />
                            Parcelas: <strong>{formatCurrency(cartao.parcelado_comprometido)}</strong>
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <span
                              className={`h-2.5 w-2.5 rounded-xs ${
                                cartao.status === 'estourado'
                                  ? 'bg-rose-500'
                                  : cartao.status === 'atencao'
                                    ? 'bg-amber-500'
                                    : 'bg-sky-500'
                              }`}
                            />
                            À vista no mês: <strong>{formatCurrency(cartao.gastos_avulsos)}</strong>
                          </span>
                        </div>
                        <span className="text-[11px] font-medium text-teal-700 group-hover:underline">
                          Ver fatura →
                        </span>
                      </div>
                    </article>
                  )
                })}
              </div>
            </div>
          ) : null}

          {/* 3. Envelopes por Categoria de Despesa */}
          {dados.metas_categorias.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-[var(--color-text)]">
                    Envelopes por Categoria ({dados.metas_categorias.length})
                  </h3>
                  <p className="text-xs text-[var(--color-muted)]">
                    Clique em qualquer categoria para inspecionar os lançamentos de {mesNome}/{ano}.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {dados.metas_categorias.map((item) => {
                  const cores = corStatusDespesa(item.status)
                  const larguraBarra = Math.min(100, Math.max(2, item.percentual))
                  return (
                    <article
                      key={item.categoria_id}
                      onClick={() => onVerTransacoesCategoria?.(mes - 1, item.categoria_id)}
                      className="group cursor-pointer rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-2xs transition-all hover:border-teal-300 hover:shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="font-bold text-[var(--color-text)] group-hover:text-teal-700">
                            {item.nome}
                          </h4>
                          <p className="text-[11px] text-[var(--color-muted)]">
                            Média 3m: {formatCurrency(item.media_3m)}
                          </p>
                        </div>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[11px] font-bold tabular-nums ${cores.badge}`}
                        >
                          {item.percentual.toFixed(0)}%
                        </span>
                      </div>

                      <div className="mt-3 flex items-baseline justify-between text-xs">
                        <span className="font-bold tabular-nums text-[var(--color-text)] text-sm">
                          {formatCurrency(item.valor_realizado)}
                        </span>
                        <span className="text-[var(--color-muted)]">
                          Meta: {formatCurrency(item.valor_limite)}
                        </span>
                      </div>

                      <div className="relative mt-2 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${cores.bar}`}
                          style={{ width: `${larguraBarra}%` }}
                        />
                        {pctMes > 0 && pctMes < 100 ? (
                          <div
                            className="pointer-events-none absolute top-0 bottom-0 w-0.5 bg-slate-900"
                            style={{ left: `${pctMes}%` }}
                            title={`Dia atual do mês (${pctMes}%)`}
                          />
                        ) : null}
                      </div>

                      <div className="mt-2.5 flex items-center justify-between text-[11px]">
                        {item.saldo_disponivel >= 0 ? (
                          <span className="font-medium text-emerald-700">
                            Restam {formatCurrency(item.saldo_disponivel)}
                          </span>
                        ) : (
                          <span className="font-bold text-rose-600">
                            Estourou {formatCurrency(Math.abs(item.saldo_disponivel))}
                          </span>
                        )}

                        {item.acima_do_ritmo && item.status !== 'estourado' ? (
                          <span className="inline-flex items-center gap-1 font-semibold text-amber-700">
                            <TrendingUp className="h-3 w-3" />
                            Acima do ritmo
                          </span>
                        ) : (
                          <span className="text-[var(--color-muted)] group-hover:text-teal-700">
                            Ver itens →
                          </span>
                        )}
                      </div>
                    </article>
                  )
                })}
              </div>
            </div>
          ) : null}
        </div>
      )}

      <ConfigurarMetasModal
        open={modalOpen}
        token={token}
        dados={dados}
        mesNome={mesNome}
        onClose={() => setModalOpen(false)}
        onSuccess={carregarResumo}
      />
    </div>
  )
}

function CardMetaGlobalDespesa({
  meta,
  pctMes,
  mesNome,
}: {
  meta: NonNullable<ResumoMetasResponse['meta_global_despesa']>
  pctMes: number
  mesNome: string
}) {
  const cores = corStatusDespesa(meta.status)
  const largura = Math.min(100, Math.max(2, meta.percentual))

  return (
    <article className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-2xs">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
            <Target className="h-5 w-5" />
          </div>
          <div>
            <h4 className="font-bold text-[var(--color-text)]">
              Teto Global de Gastos ({mesNome})
            </h4>
            <p className="text-xs text-[var(--color-muted)]">
              Média últimos 3 meses: {formatCurrency(meta.media_3m)}
            </p>
          </div>
        </div>
        <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cores.badge}`}>
          {meta.percentual.toFixed(1)}% • {cores.label}
        </span>
      </div>

      <div className="mt-4 flex items-baseline justify-between">
        <div>
          <span className={`text-2xl font-bold tabular-nums ${cores.text}`}>
            {formatCurrency(meta.valor_realizado)}
          </span>
          <span className="text-xs text-[var(--color-muted)]">
            {' '}
            de {formatCurrency(meta.valor_limite)}
          </span>
        </div>
        <div>
          {meta.saldo_disponivel >= 0 ? (
            <span className="text-xs font-semibold text-emerald-700">
              Disponível: {formatCurrency(meta.saldo_disponivel)}
            </span>
          ) : (
            <span className="text-xs font-bold text-rose-600">
              Excedido em {formatCurrency(Math.abs(meta.saldo_disponivel))}
            </span>
          )}
        </div>
      </div>

      <div className="relative mt-2.5 h-3 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-all duration-300 ${cores.bar}`}
          style={{ width: `${largura}%` }}
        />
        {pctMes > 0 && pctMes < 100 ? (
          <div
            className="pointer-events-none absolute top-0 bottom-0 w-0.5 bg-slate-900"
            style={{ left: `${pctMes}%` }}
            title={`Ritmo esperado hoje (${pctMes}%)`}
          />
        ) : null}
      </div>
    </article>
  )
}

function CardMetaGlobalInvestimento({
  meta,
  mesNome,
}: {
  meta: NonNullable<ResumoMetasResponse['meta_global_investimento']>
  mesNome: string
}) {
  const largura = Math.min(100, Math.max(2, meta.percentual))
  const atingida = meta.status === 'atingida'

  return (
    <article className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-2xs">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-600">
            <PiggyBank className="h-5 w-5" />
          </div>
          <div>
            <h4 className="font-bold text-[var(--color-text)]">
              Meta de Aporte / Investimento ({mesNome})
            </h4>
            <p className="text-xs text-[var(--color-muted)]">
              Média últimos 3 meses: {formatCurrency(meta.media_3m)}
            </p>
          </div>
        </div>
        <span
          className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
            atingida
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-violet-200 bg-violet-50 text-violet-700'
          }`}
        >
          {meta.percentual.toFixed(0)}% • {atingida ? 'Meta atingida! 🎉' : 'Em progresso'}
        </span>
      </div>

      <div className="mt-4 flex items-baseline justify-between">
        <div>
          <span className="text-2xl font-bold tabular-nums text-violet-600">
            {formatCurrency(meta.valor_realizado)}
          </span>
          <span className="text-xs text-[var(--color-muted)]">
            {' '}
            de {formatCurrency(meta.valor_limite)}
          </span>
        </div>
        <div>
          {meta.faltante > 0 ? (
            <span className="text-xs font-medium text-[var(--color-muted)]">
              Faltam {formatCurrency(meta.faltante)}
            </span>
          ) : (
            <span className="text-xs font-semibold text-emerald-700">Objetivo concluído!</span>
          )}
        </div>
      </div>

      <div className="relative mt-2.5 h-3 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            atingida ? 'bg-emerald-500' : 'bg-violet-600'
          }`}
          style={{ width: `${largura}%` }}
        />
      </div>
    </article>
  )
}

