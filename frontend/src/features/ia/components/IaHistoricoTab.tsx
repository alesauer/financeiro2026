import { useEffect, useState } from 'react'
import {
  Sparkles,
  Zap,
  DollarSign,
  FileText,
} from 'lucide-react'
import { iaService } from '../services/iaService'
import type { IaConsumoData } from '../types'
import { getErrorMessage } from '@/shared/utils/error'

type IaHistoricoTabProps = {
  token?: string
}

export function IaHistoricoTab({ token }: IaHistoricoTabProps) {
  const [subAba, setSubAba] = useState<'consumo' | 'classificar'>('consumo')
  const [consumo, setConsumo] = useState<IaConsumoData | null>(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  // Estados da classificação em lote legada
  const [textoClassificar, setTextoClassificar] = useState('')
  const [resultadoClassificar, setResultadoClassificar] = useState<string[]>([])
  const [loadingClassificar, setLoadingClassificar] = useState(false)
  const [erroClassificar, setErroClassificar] = useState<string | null>(null)

  useEffect(() => {
    async function carregarConsumo() {
      setLoading(true)
      setErro(null)
      try {
        const res = await iaService.getConsumo(token)
        setConsumo(res)
      } catch (err) {
        setErro(getErrorMessage(err, 'Erro ao carregar dados de consumo.'))
      } finally {
        setLoading(false)
      }
    }
    carregarConsumo()
  }, [token])

  const handleClassificarLote = async () => {
    const descricoes = textoClassificar
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)

    if (descricoes.length === 0) {
      setErroClassificar('Informe ao menos uma descrição (uma por linha).')
      return
    }

    setLoadingClassificar(true)
    setErroClassificar(null)

    try {
      const data = await iaService.classificarCategorias({ descricoes }, token)
      setResultadoClassificar(data.categorias)
      if (data.erro) setErroClassificar(data.erro)
    } catch (err) {
      setErroClassificar(getErrorMessage(err, 'Não foi possível classificar as descrições.'))
    } finally {
      setLoadingClassificar(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Sub-navegação */}
      <div className="flex items-center gap-2 border-b border-[var(--color-border)] pb-2 text-xs">
        <button
          type="button"
          onClick={() => setSubAba('consumo')}
          className={`rounded-full px-3.5 py-1.5 font-medium transition cursor-pointer ${
            subAba === 'consumo'
              ? 'bg-slate-800 text-white shadow-2xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Consumo & Tokens da API
        </button>
        <button
          type="button"
          onClick={() => setSubAba('classificar')}
          className={`rounded-full px-3.5 py-1.5 font-medium transition cursor-pointer ${
            subAba === 'classificar'
              ? 'bg-slate-800 text-white shadow-2xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Classificador em Lote de Descrições
        </button>
      </div>

      {subAba === 'consumo' ? (
        <div className="space-y-6">
          {loading ? (
            <div className="flex h-48 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-xs text-[var(--color-muted)]">
              Carregando métricas de consumo...
            </div>
          ) : erro || !consumo ? (
            <div className="rounded-[var(--radius-md)] border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
              {erro || 'Não foi possível obter dados de consumo.'}
            </div>
          ) : (
            <>
              {/* KPIs de Consumo */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-2xs">
                  <div className="flex items-center justify-between text-xs text-[var(--color-muted)]">
                    <span>Total de Chamadas</span>
                    <Zap className="h-4 w-4 text-[var(--color-primary)]" />
                  </div>
                  <p className="mt-1 text-2xl font-bold text-[var(--color-text)]">
                    {consumo.total_chamadas}
                  </p>
                  <p className="mt-1 text-[11px] text-[var(--color-muted)]">Interações registradas</p>
                </div>

                <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-2xs">
                  <div className="flex items-center justify-between text-xs text-[var(--color-muted)]">
                    <span>Tokens Consumidos</span>
                    <Sparkles className="h-4 w-4 text-sky-600" />
                  </div>
                  <p className="mt-1 text-2xl font-bold text-sky-700">
                    {consumo.total_tokens.toLocaleString('pt-BR')}
                  </p>
                  <p className="mt-1 text-[11px] text-[var(--color-muted)]">
                    {consumo.total_tokens_prompt.toLocaleString('pt-BR')} in / {consumo.total_tokens_completion.toLocaleString('pt-BR')} out
                  </p>
                </div>

                <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-2xs">
                  <div className="flex items-center justify-between text-xs text-[var(--color-muted)]">
                    <span>Custo Estimado</span>
                    <DollarSign className="h-4 w-4 text-emerald-600" />
                  </div>
                  <p className="mt-1 text-2xl font-bold text-emerald-700">
                    ${consumo.custo_estimado_usd.toFixed(4)}
                  </p>
                  <p className="mt-1 text-[11px] text-[var(--color-muted)]">Em dólares (USD)</p>
                </div>

                <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-2xs">
                  <div className="flex items-center justify-between text-xs text-[var(--color-muted)]">
                    <span>Modelo Principal</span>
                    <FileText className="h-4 w-4 text-[var(--color-muted)]" />
                  </div>
                  <p className="mt-1 text-xl font-bold text-[var(--color-text)]">gpt-4o-mini</p>
                  <p className="mt-1 text-[11px] text-[var(--color-muted)]">Otimizado para custos e velocidade</p>
                </div>
              </div>

              {/* Tabela de Logs Recentes */}
              <section className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-2xs">
                <h4 className="mb-3 text-sm font-semibold text-[var(--color-text)]">
                  Registro de Requisições Recentes
                </h4>

                {consumo.logs_recentes.length === 0 ? (
                  <p className="text-xs text-[var(--color-muted)]">Nenhuma requisição registrada ainda.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-[var(--color-border)] text-[var(--color-muted)]">
                          <th className="py-2.5 pr-4 font-semibold">Funcionalidade</th>
                          <th className="py-2.5 pr-4 font-semibold">Modelo</th>
                          <th className="py-2.5 pr-4 font-semibold">Tokens</th>
                          <th className="py-2.5 pr-4 font-semibold">Custo Estimado</th>
                          <th className="py-2.5 font-semibold">Data/Hora</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--color-border)]/60">
                        {consumo.logs_recentes.map((log) => (
                          <tr key={log.id} className="hover:bg-slate-50/60">
                            <td className="py-2.5 pr-4 font-medium text-[var(--color-text)]">
                              {log.funcionalidade}
                            </td>
                            <td className="py-2.5 pr-4 text-[var(--color-muted)]">{log.modelo}</td>
                            <td className="py-2.5 pr-4 font-semibold text-[var(--color-text)]">
                              {log.tokens.toLocaleString('pt-BR')}
                            </td>
                            <td className="py-2.5 pr-4 text-emerald-700 font-medium">
                              ${log.custo_usd.toFixed(5)}
                            </td>
                            <td className="py-2.5 text-[var(--color-muted)]">
                              {log.created_at ? new Date(log.created_at).toLocaleString('pt-BR') : ''}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      ) : (
        /* Classificador em Lote de Descrições */
        <div className="space-y-4">
          <article className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-2xs">
            <h4 className="mb-1 text-sm font-semibold text-[var(--color-text)]">
              Classificar Descrições em Massa
            </h4>
            <p className="mb-3 text-xs text-[var(--color-muted)]">
              Cole uma descrição de transação por linha para obter a categoria recomendada.
            </p>
            <textarea
              rows={8}
              value={textoClassificar}
              onChange={(e) => setTextoClassificar(e.target.value)}
              placeholder="UBER *TRIP&#10;PADARIA ARTE DO TRIGO&#10;POSTO IPIRANGA..."
              className="w-full resize-y rounded-[var(--radius-sm)] border border-[var(--color-border)] p-3 text-xs outline-none focus:border-[var(--color-primary)]"
            />
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={handleClassificarLote}
                disabled={loadingClassificar}
                className="rounded-[var(--radius-sm)] bg-[var(--color-primary)] px-3 py-1.5 text-xs font-semibold text-white shadow-2xs transition hover:opacity-90 disabled:opacity-50 cursor-pointer"
              >
                {loadingClassificar ? 'Classificando...' : 'Classificar com IA'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setTextoClassificar('')
                  setResultadoClassificar([])
                  setErroClassificar(null)
                }}
                className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                Limpar
              </button>
            </div>
            {erroClassificar ? (
              <p className="mt-3 text-xs text-rose-600">{erroClassificar}</p>
            ) : null}
          </article>

          {resultadoClassificar.length > 0 ? (
            <article className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-2xs">
              <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-[var(--color-muted)]">
                Resultado da Classificação
              </h4>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[var(--color-border)] text-[var(--color-muted)]">
                      <th className="py-2 pr-4 font-semibold">Descrição</th>
                      <th className="py-2 font-semibold">Categoria Sugerida</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)]/60">
                    {resultadoClassificar.map((cat, idx) => {
                      const desc = textoClassificar.split('\n').filter(Boolean)[idx] ?? '-'
                      return (
                        <tr key={idx}>
                          <td className="py-2 pr-4 font-medium text-[var(--color-text)]">{desc}</td>
                          <td className="py-2 font-semibold text-[var(--color-primary)]">{cat}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </article>
          ) : null}
        </div>
      )}
    </div>
  )
}
