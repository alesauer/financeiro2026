import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Eye, Pencil, Plus, Search, Trash2 } from 'lucide-react'

import { useAuth } from '@/app/providers/AuthProvider'
import { CategoriaIconBadge } from '@/features/metas/components/CategoriaIconBadge'
import { MetasPageHeader } from '@/features/metas/components/MetasPageHeader'
import { MetaStatusBadge } from '@/features/metas/components/MetaStatusBadge'
import { metasService } from '@/features/metas/services/metasService'
import type { PainelMetasResponse, SituacaoMeta } from '@/features/metas/types/metas'
import {
  MESES_LISTA,
   getEstiloSituacao,
  navegarPeriodo,
} from '@/features/metas/utils/calculosMetas'
import { formatCurrency } from '@/shared/utils/date'
import { getErrorMessage } from '@/shared/utils/error'

type FiltroSituacao = 'todas' | SituacaoMeta

export function MinhasMetasPage() {
  const { token } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const hoje = new Date()
  const [mes, setMes] = useState<number>(() => Number(searchParams.get('mes')) || hoje.getMonth() + 1)
  const [ano, setAno] = useState<number>(() => Number(searchParams.get('ano')) || hoje.getFullYear())
  const [situacao, setSituacao] = useState<FiltroSituacao>(
    () => (searchParams.get('situacao') as FiltroSituacao) || 'todas',
  )
  const [busca, setBusca] = useState<string>(() => searchParams.get('q') || '')

  const [dados, setDados] = useState<PainelMetasResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const resp = await metasService.painel(token, {
        mes,
        ano,
        situacao,
        q: busca,
      })
      setDados(resp)
    } catch (err) {
      setError(getErrorMessage(err, 'Não foi possível carregar a lista de metas.'))
    } finally {
      setLoading(false)
    }
  }, [token, mes, ano, situacao, busca])

  useEffect(() => {
    carregar()
  }, [carregar])

  const atualizarUrl = (novoMes: number, novoAno: number, novaSit: FiltroSituacao) => {
    const params: Record<string, string> = {
      mes: String(novoMes),
      ano: String(novoAno),
    }
    if (novaSit !== 'todas') params.situacao = novaSit
    setSearchParams(params, { replace: true })
  }

  const handleExcluir = async (id: number, nome: string) => {
    if (!token) return
    if (!window.confirm(`Deseja realmente excluir a meta "${nome}"?`)) return
    try {
      await metasService.remover(token, id)
      await carregar()
    } catch (err) {
      setError(getErrorMessage(err, 'Não foi possível excluir a meta.'))
    }
  }

  const ind = dados?.indicadores
  const itens = dados?.metas_filtradas ?? []

  const abas: { id: FiltroSituacao; label: string; count: number }[] = [
    { id: 'todas', label: 'Todas', count: ind?.total_metas ?? 0 },
    { id: 'dentro', label: 'Dentro da meta', count: ind?.metas_dentro ?? 0 },
    { id: 'atencao', label: 'Em atenção', count: ind?.metas_atencao ?? 0 },
    { id: 'ultrapassada', label: 'Ultrapassadas', count: ind?.metas_ultrapassadas ?? 0 },
  ]

  const opcoesPeriodo = (() => {
    const anos = [ano - 1, ano, ano + 1]
    const lista: { label: string; mes: number; ano: number; value: string }[] = []
    for (const a of anos) {
      for (const m of MESES_LISTA) {
        lista.push({
          label: `${m.nome} / ${a}`,
          mes: m.numero,
          ano: a,
          value: `${a}-${String(m.numero).padStart(2, '0')}`,
        })
      }
    }
    return lista
  })()

  return (
    <section className="space-y-6">
      <MetasPageHeader
        subtitulo="Minhas Metas"
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

      {/* Barra de filtros por situacao, busca e seletor de periodo */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] pb-3">
        <div className="flex flex-wrap items-center gap-1">
          {abas.map((aba) => {
            const ativo = situacao === aba.id
            return (
              <button
                key={aba.id}
                type="button"
                onClick={() => {
                  setSituacao(aba.id)
                  atualizarUrl(mes, ano, aba.id)
                }}
                className={`-mb-3.5 border-b-2 px-3 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                  ativo
                    ? 'border-emerald-600 text-emerald-700'
                    : 'border-transparent text-[var(--color-muted)] hover:text-[var(--color-text)]'
                }`}
              >
                {aba.label} ({aba.count})
              </button>
            )
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-muted)]" />
            <input
              type="text"
              placeholder="Pesquisar meta ou categoria..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-52 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] py-1.5 pl-8 pr-3 text-xs text-[var(--color-text)] outline-none focus:border-emerald-600"
            />
          </div>

          <div className="inline-flex items-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-0.5 shadow-2xs">
            <button
              type="button"
              onClick={() => {
                const p = navegarPeriodo(mes, ano, -1)
                setMes(p.mes)
                setAno(p.ano)
                atualizarUrl(p.mes, p.ano, situacao)
              }}
              className="rounded-md p-1 text-[var(--color-muted)] hover:bg-slate-100 hover:text-[var(--color-text)] cursor-pointer"
              aria-label="Mês anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <select
              value={`${ano}-${String(mes).padStart(2, '0')}`}
              onChange={(e) => {
                const [y, m] = e.target.value.split('-').map(Number)
                if (y && m) {
                  setMes(m)
                  setAno(y)
                  atualizarUrl(m, y, situacao)
                }
              }}
              className="bg-transparent px-2.5 py-1 text-xs font-semibold text-[var(--color-text)] outline-none cursor-pointer"
            >
              {opcoesPeriodo.map((op) => (
                <option key={op.value} value={op.value}>
                  {op.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => {
                const p = navegarPeriodo(mes, ano, 1)
                setMes(p.mes)
                setAno(p.ano)
                atualizarUrl(p.mes, p.ano, situacao)
              }}
              className="rounded-md p-1 text-[var(--color-muted)] hover:bg-slate-100 hover:text-[var(--color-text)] cursor-pointer"
              aria-label="Próximo mês"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {loading && !dados ? (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-10 text-center text-sm text-[var(--color-muted)]">
          Carregando metas...
        </div>
      ) : itens.length === 0 ? (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-10 text-center">
          <p className="text-sm font-semibold text-[var(--color-text)]">
            Nenhuma meta encontrada para os filtros selecionados.
          </p>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            Crie uma nova meta ou altere o filtro de situação/busca acima.
          </p>
          <Link
            to={`/metas/nova?mes=${mes}&ano=${ano}`}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
          >
            <Plus className="h-4 w-4" />
            Nova Meta
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xs">
          {/* Tabela Desktop */}
          <div className="hidden md:block">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[var(--color-border)] bg-slate-50/70 text-[11px] font-semibold text-[var(--color-muted)]">
                <tr>
                  <th className="px-5 py-3">Meta / Categoria</th>
                  <th className="px-4 py-3 text-right">Planejado</th>
                  <th className="px-4 py-3 text-right">Realizado</th>
                  <th className="px-5 py-3">Progresso</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-5 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]/70">
                {itens.map((item) => {
                  const est = getEstiloSituacao(item.situacao)
                  const largura = Math.min(100, Math.max(2, item.percentual_consumido))
                  return (
                    <tr
                      key={item.id}
                      onClick={() => navigate(`/metas/${item.id}?mes=${mes}&ano=${ano}`)}
                      className="cursor-pointer transition-colors hover:bg-slate-50/80"
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <CategoriaIconBadge nome={item.categoria_nome} size="sm" />
                          <div>
                            <p className="font-bold text-[var(--color-text)] text-sm">{item.nome}</p>
                            {item.nome !== item.categoria_nome ? (
                              <p className="text-[11px] text-[var(--color-muted)]">{item.categoria_nome}</p>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-right font-medium tabular-nums text-[var(--color-text)] text-sm">
                        {formatCurrency(item.valor_planejado)}
                      </td>
                      <td className="px-4 py-3.5 text-right font-bold tabular-nums text-[var(--color-text)] text-sm">
                        {formatCurrency(item.valor_realizado)}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <span className={`w-10 text-right font-bold tabular-nums ${est.textColor}`}>
                            {Math.round(item.percentual_consumido)}%
                          </span>
                          <div className="h-2 w-32 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${est.barColor}`}
                              style={{ width: `${largura}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <MetaStatusBadge situacao={item.situacao} />
                      </td>
                      <td
                        className="px-5 py-3.5 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => navigate(`/metas/${item.id}?mes=${mes}&ano=${ano}`)}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-emerald-700 cursor-pointer"
                            title="Visualizar detalhes da meta"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => navigate(`/metas/${item.id}/editar?mes=${mes}&ano=${ano}`)}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-sky-700 cursor-pointer"
                            title="Editar meta"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleExcluir(item.id, item.nome)}
                            className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 hover:text-rose-700 cursor-pointer"
                            title="Excluir meta"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Cards Mobile */}
          <div className="divide-y divide-[var(--color-border)] md:hidden">
            {itens.map((item) => {
              const est = getEstiloSituacao(item.situacao)
              const largura = Math.min(100, Math.max(2, item.percentual_consumido))
              return (
                <div
                  key={item.id}
                  onClick={() => navigate(`/metas/${item.id}?mes=${mes}&ano=${ano}`)}
                  className="p-4 space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <CategoriaIconBadge nome={item.categoria_nome} size="sm" />
                      <span className="font-bold text-sm text-[var(--color-text)]">{item.nome}</span>
                    </div>
                    <MetaStatusBadge situacao={item.situacao} />
                  </div>

                  <div className="flex items-baseline justify-between text-xs">
                    <span>
                      <strong>{formatCurrency(item.valor_realizado)}</strong> de{' '}
                      {formatCurrency(item.valor_planejado)}
                    </span>
                    <span className={`font-bold ${est.textColor}`}>
                      {Math.round(item.percentual_consumido)}%
                    </span>
                  </div>

                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full ${est.barColor}`}
                      style={{ width: `${largura}%` }}
                    />
                  </div>

                  <div
                    className="flex justify-end gap-2 pt-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => navigate(`/metas/${item.id}/editar?mes=${mes}&ano=${ano}`)}
                      className="rounded border border-[var(--color-border)] px-2.5 py-1 text-xs font-medium"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExcluir(item.id, item.nome)}
                      className="rounded border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700"
                    >
                      Excluir
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}

