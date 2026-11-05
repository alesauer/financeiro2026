import { useEffect, useMemo, useState } from 'react'
import { CreditCard, Search, Sparkles, Target, TrendingDown, X } from 'lucide-react'

import { metasService } from '@/features/metas/services/metasService'
import type { ResumoMetasResponse, SalvarMetaItemPayload } from '@/features/metas/services/metasService'
import { formatCurrency } from '@/shared/utils/date'
import { getErrorMessage } from '@/shared/utils/error'

interface ConfigurarMetasModalProps {
  open: boolean
  token: string | null
  dados: ResumoMetasResponse | null
  mesNome: string
  onClose: () => void
  onSuccess: () => void
}

export function ConfigurarMetasModal({
  open,
  token,
  dados,
  mesNome,
  onClose,
  onSuccess,
}: ConfigurarMetasModalProps) {
  const [modo, setModo] = useState<'padrao' | 'mes_especifico'>('padrao')
  const [busca, setBusca] = useState('')
  const [apenasComMovimento, setApenasComMovimento] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [globalDespesa, setGlobalDespesa] = useState<string>('')
  const [globalInvestimento, setGlobalInvestimento] = useState<string>('')
  const [cartoesValores, setCartoesValores] = useState<Record<number, string>>({})
  const [categoriasValores, setCategoriasValores] = useState<Record<number, string>>({})

  useEffect(() => {
    if (!open || !dados) return
    setError(null)

    const catGlobalDesp = dados.catalogo.global_despesa
    const catGlobalInv = dados.catalogo.global_investimento

    const valDesp =
      modo === 'padrao'
        ? catGlobalDesp.valor_padrao ?? catGlobalDesp.valor_limite
        : catGlobalDesp.valor_override ?? catGlobalDesp.valor_limite

    const valInv =
      modo === 'padrao'
        ? catGlobalInv.valor_padrao ?? catGlobalInv.valor_limite
        : catGlobalInv.valor_override ?? catGlobalInv.valor_limite

    setGlobalDespesa(valDesp && valDesp > 0 ? String(valDesp) : '')
    setGlobalInvestimento(valInv && valInv > 0 ? String(valInv) : '')

    const mapCartoes: Record<number, string> = {}
    for (const c of dados.catalogo.cartoes) {
      const v = modo === 'padrao' ? c.valor_padrao ?? c.valor_limite : c.valor_override ?? c.valor_limite
      mapCartoes[c.forma_pagamento_id] = v && v > 0 ? String(v) : ''
    }
    setCartoesValores(mapCartoes)

    const mapCats: Record<number, string> = {}
    for (const cat of dados.catalogo.categorias) {
      const v = modo === 'padrao' ? cat.valor_padrao ?? cat.valor_limite : cat.valor_override ?? cat.valor_limite
      mapCats[cat.categoria_id] = v && v > 0 ? String(v) : ''
    }
    setCategoriasValores(mapCats)
  }, [open, dados, modo])

  const categoriasFiltradas = useMemo(() => {
    if (!dados) return []
    const termo = busca.trim().toLowerCase()
    return dados.catalogo.categorias.filter((cat) => {
      if (termo && !cat.nome.toLowerCase().includes(termo)) return false
      if (
        apenasComMovimento &&
        cat.media_3m <= 0 &&
        cat.valor_realizado <= 0 &&
        !(Number(categoriasValores[cat.categoria_id]) > 0)
      ) {
        return false
      }
      return true
    })
  }, [dados, busca, apenasComMovimento, categoriasValores])

  if (!open || !dados) return null

  const aplicarAutoPreenchimento = (fatorDespesa: number) => {
    const mediaGlobalDesp = dados.catalogo.global_despesa.media_3m
    if (mediaGlobalDesp > 0) {
      setGlobalDespesa(String(Math.round(mediaGlobalDesp * fatorDespesa)))
    }
    const mediaGlobalInv = dados.catalogo.global_investimento.media_3m
    if (mediaGlobalInv > 0) {
      setGlobalInvestimento(String(Math.round(mediaGlobalInv)))
    }

    const novosCartoes: Record<number, string> = { ...cartoesValores }
    for (const c of dados.catalogo.cartoes) {
      if (c.media_3m > 0) {
        novosCartoes[c.forma_pagamento_id] = String(Math.round(c.media_3m * fatorDespesa))
      }
    }
    setCartoesValores(novosCartoes)

    const novasCats: Record<number, string> = { ...categoriasValores }
    for (const cat of dados.catalogo.categorias) {
      if (cat.media_3m > 0) {
        novasCats[cat.categoria_id] = String(Math.round(cat.media_3m * fatorDespesa))
      }
    }
    setCategoriasValores(novasCats)
  }

  const handleSalvar = async () => {
    if (!token) return
    setSaving(true)
    setError(null)

    const itens: SalvarMetaItemPayload[] = [
      {
        escopo: 'global_despesa',
        valor_limite: globalDespesa ? Number(globalDespesa) : 0,
      },
      {
        escopo: 'global_investimento',
        valor_limite: globalInvestimento ? Number(globalInvestimento) : 0,
      },
    ]

    for (const c of dados.catalogo.cartoes) {
      const raw = cartoesValores[c.forma_pagamento_id]
      itens.push({
        escopo: 'cartao',
        forma_pagamento_id: c.forma_pagamento_id,
        valor_limite: raw ? Number(raw) : 0,
      })
    }

    for (const cat of dados.catalogo.categorias) {
      const raw = categoriasValores[cat.categoria_id]
      itens.push({
        escopo: 'categoria',
        categoria_id: cat.categoria_id,
        valor_limite: raw ? Number(raw) : 0,
      })
    }

    try {
      await metasService.salvarLote(token, {
        modo,
        mes: dados.periodo.mes,
        ano: dados.periodo.ano,
        itens,
      })
      onSuccess()
      onClose()
    } catch (err) {
      setError(getErrorMessage(err, 'Erro ao salvar metas de orçamento.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl">
        {/* Cabecalho */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-slate-50/70 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-600 text-white shadow-xs">
              <Target className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[var(--color-text)]">
                Configurar Metas e Orçamento
              </h3>
              <p className="text-xs text-[var(--color-muted)]">
                Defina tetos apenas onde deseja controlar gastos — deixe em branco o que não quiser monitorar.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--color-muted)] hover:bg-slate-200/60 hover:text-[var(--color-text)]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Barra de modo + Auto-preenchimento inteligente */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] bg-teal-50/40 px-6 py-3">
          <div className="flex items-center gap-1 rounded-lg border border-[var(--color-border)] bg-white p-1">
            <button
              type="button"
              onClick={() => setModo('padrao')}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                modo === 'padrao'
                  ? 'bg-teal-600 text-white'
                  : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
              }`}
            >
              Meta Padrão (Todos os meses)
            </button>
            <button
              type="button"
              onClick={() => setModo('mes_especifico')}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                modo === 'mes_especifico'
                  ? 'bg-amber-600 text-white'
                  : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
              }`}
            >
              Exceção só para {mesNome}/{dados.periodo.ano}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-[var(--color-muted)]">Auto-preencher tudo:</span>
            <button
              type="button"
              onClick={() => aplicarAutoPreenchimento(1.0)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-xs font-semibold text-sky-700 hover:bg-sky-100 transition-colors cursor-pointer"
              title="Preenche todos os campos usando a sua média real dos últimos 3 meses"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Usar Média 3m
            </button>
            <button
              type="button"
              onClick={() => aplicarAutoPreenchimento(0.9)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors cursor-pointer"
              title="Sugere uma meta 10% abaixo da sua média dos últimos 3 meses para gerar economia"
            >
              <TrendingDown className="h-3.5 w-3.5" />
              Economizar 10% vs Média
            </button>
          </div>
        </div>

        {error ? (
          <div className="mx-6 mt-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-medium text-rose-700">
            {error}
          </div>
        ) : null}

        {/* Conteudo rolavel */}
        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
          {/* 1. Metas Globais */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-muted)]">
              1. Metas Globais do Mês
            </h4>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {/* Teto Global de Despesas */}
              <div className="rounded-xl border border-[var(--color-border)] bg-slate-50/50 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-[var(--color-text)]">
                      Teto Global de Gastos Mensais
                    </p>
                    <p className="text-xs text-[var(--color-muted)]">
                      Soma de Despesas de Conta + Fatura do Cartão
                    </p>
                  </div>
                  <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
                    Despesas
                  </span>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <div className="relative flex-1">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-[var(--color-muted)]">
                      R$
                    </span>
                    <input
                      type="number"
                      min={0}
                      step="10"
                      placeholder="Sem limite"
                      value={globalDespesa}
                      onChange={(e) => setGlobalDespesa(e.target.value)}
                      className="w-full rounded-lg border border-[var(--color-border)] bg-white py-2 pl-8 pr-3 text-sm font-semibold text-[var(--color-text)] outline-none focus:border-teal-600"
                    />
                  </div>
                  {dados.catalogo.global_despesa.media_3m > 0 ? (
                    <button
                      type="button"
                      onClick={() =>
                        setGlobalDespesa(String(Math.round(dados.catalogo.global_despesa.media_3m)))
                      }
                      className="rounded-lg border border-[var(--color-border)] bg-white px-2.5 py-2 text-xs font-medium text-[var(--color-muted)] hover:bg-slate-100 hover:text-[var(--color-text)]"
                      title="Preencher com a média dos últimos 3 meses"
                    >
                      Média: {formatCurrency(dados.catalogo.global_despesa.media_3m)}
                    </button>
                  ) : null}
                </div>
              </div>

              {/* Meta de Investimento / Aporte */}
              <div className="rounded-xl border border-[var(--color-border)] bg-slate-50/50 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-[var(--color-text)]">
                      Meta de Aporte / Investimento Mensal
                    </p>
                    <p className="text-xs text-[var(--color-muted)]">
                      Quanto você planeja investir neste mês
                    </p>
                  </div>
                  <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700">
                    Investimento
                  </span>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <div className="relative flex-1">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-[var(--color-muted)]">
                      R$
                    </span>
                    <input
                      type="number"
                      min={0}
                      step="10"
                      placeholder="Sem meta definida"
                      value={globalInvestimento}
                      onChange={(e) => setGlobalInvestimento(e.target.value)}
                      className="w-full rounded-lg border border-[var(--color-border)] bg-white py-2 pl-8 pr-3 text-sm font-semibold text-[var(--color-text)] outline-none focus:border-teal-600"
                    />
                  </div>
                  {dados.catalogo.global_investimento.media_3m > 0 ? (
                    <button
                      type="button"
                      onClick={() =>
                        setGlobalInvestimento(
                          String(Math.round(dados.catalogo.global_investimento.media_3m)),
                        )
                      }
                      className="rounded-lg border border-[var(--color-border)] bg-white px-2.5 py-2 text-xs font-medium text-[var(--color-muted)] hover:bg-slate-100 hover:text-[var(--color-text)]"
                      title="Preencher com a média dos últimos 3 meses"
                    >
                      Média: {formatCurrency(dados.catalogo.global_investimento.media_3m)}
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          {/* 2. Teto por Cartao de Credito */}
          {dados.catalogo.cartoes.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-muted)]">
                  2. Teto de Fatura por Cartão de Crédito
                </h4>
                <span className="text-xs text-[var(--color-muted)]">
                  Separa automaticamente parcelas já comprometidas vs novos gastos
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {dados.catalogo.cartoes.map((cartao) => (
                  <div
                    key={cartao.forma_pagamento_id}
                    className="flex flex-col justify-between rounded-xl border border-[var(--color-border)] bg-white p-4 shadow-2xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="flex h-7 w-7 items-center justify-center rounded-md text-white"
                          style={{ backgroundColor: cartao.cor || '#820AD1' }}
                        >
                          <CreditCard className="h-4 w-4" />
                        </span>
                        <div>
                          <p className="text-sm font-bold text-[var(--color-text)]">{cartao.nome}</p>
                          <p className="text-[11px] text-[var(--color-muted)]">
                            Já em parcelas no mês:{' '}
                            <strong className="text-purple-700">
                              {formatCurrency(cartao.parcelado_comprometido)}
                            </strong>
                          </p>
                        </div>
                      </div>
                      <div className="text-right text-[11px] text-[var(--color-muted)]">
                        <div>Atual: {formatCurrency(cartao.valor_realizado)}</div>
                        <div>Média 3m: {formatCurrency(cartao.media_3m)}</div>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center gap-2">
                      <div className="relative flex-1">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-[var(--color-muted)]">
                          R$
                        </span>
                        <input
                          type="number"
                          min={0}
                          step="50"
                          placeholder="Teto da fatura"
                          value={cartoesValores[cartao.forma_pagamento_id] ?? ''}
                          onChange={(e) =>
                            setCartoesValores((prev) => ({
                              ...prev,
                              [cartao.forma_pagamento_id]: e.target.value,
                            }))
                          }
                          className="w-full rounded-lg border border-[var(--color-border)] bg-slate-50/60 py-1.5 pl-8 pr-3 text-sm font-semibold text-[var(--color-text)] outline-none focus:border-teal-600 focus:bg-white"
                        />
                      </div>
                      {cartao.media_3m > 0 ? (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              setCartoesValores((prev) => ({
                                ...prev,
                                [cartao.forma_pagamento_id]: String(Math.round(cartao.media_3m)),
                              }))
                            }
                            className="rounded-md border border-[var(--color-border)] px-2 py-1.5 text-[11px] font-medium text-[var(--color-muted)] hover:bg-slate-100"
                          >
                            Média
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setCartoesValores((prev) => ({
                                ...prev,
                                [cartao.forma_pagamento_id]: String(cartao.sugestao_economia_10),
                              }))
                            }
                            className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100"
                          >
                            -10%
                          </button>
                        </>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* 3. Limites por Categoria de Despesa */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-muted)]">
                3. Envelopes Mensais por Categoria de Despesa ({categoriasFiltradas.length})
              </h4>

              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex items-center gap-1.5 text-xs text-[var(--color-muted)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={apenasComMovimento}
                    onChange={(e) => setApenasComMovimento(e.target.checked)}
                    className="rounded"
                  />
                  Ocultar categorias sem histórico
                </label>

                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-muted)]" />
                  <input
                    type="text"
                    placeholder="Filtrar categoria..."
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    className="rounded-lg border border-[var(--color-border)] bg-white py-1 pl-8 pr-3 text-xs outline-none focus:border-teal-600"
                  />
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-white">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[var(--color-border)] bg-slate-50 text-[11px] font-bold uppercase text-[var(--color-muted)]">
                  <tr>
                    <th className="px-4 py-2.5">Categoria</th>
                    <th className="px-3 py-2.5 text-right">Gasto no Mês</th>
                    <th className="px-3 py-2.5 text-right">Média (3m)</th>
                    <th className="px-3 py-2.5 text-center">Sugestões Rápidas</th>
                    <th className="px-4 py-2.5 text-right">Meta Mensal (R$)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]/60">
                  {categoriasFiltradas.map((cat) => {
                    const valAtual = categoriasValores[cat.categoria_id] ?? ''
                    const temMeta = Number(valAtual) > 0
                    return (
                      <tr
                        key={cat.categoria_id}
                        className={temMeta ? 'bg-teal-50/20' : 'hover:bg-slate-50/70'}
                      >
                        <td className="px-4 py-2.5 font-semibold text-[var(--color-text)]">
                          {cat.nome}
                          {cat.is_override && modo === 'mes_especifico' ? (
                            <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                              Exceção do mês
                            </span>
                          ) : null}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-[var(--color-muted)]">
                          {cat.valor_realizado > 0 ? formatCurrency(cat.valor_realizado) : '—'}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums font-medium text-[var(--color-text)]">
                          {cat.media_3m > 0 ? formatCurrency(cat.media_3m) : '—'}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          {cat.media_3m > 0 ? (
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() =>
                                  setCategoriasValores((prev) => ({
                                    ...prev,
                                    [cat.categoria_id]: String(Math.round(cat.media_3m)),
                                  }))
                                }
                                className="rounded border border-[var(--color-border)] bg-white px-2 py-1 text-[11px] font-medium text-[var(--color-muted)] hover:bg-slate-100 hover:text-[var(--color-text)]"
                                title="Usar média histórica dos últimos 3 meses"
                              >
                                Média
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setCategoriasValores((prev) => ({
                                    ...prev,
                                    [cat.categoria_id]: String(cat.sugestao_economia_10),
                                  }))
                                }
                                className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100"
                                title="Reduzir 10% sobre a média dos últimos 3 meses"
                              >
                                -10% ({formatCurrency(cat.sugestao_economia_10)})
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-[var(--color-muted)]">Sem histórico</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <input
                              type="number"
                              min={0}
                              step="10"
                              placeholder="Sem meta"
                              value={valAtual}
                              onChange={(e) =>
                                setCategoriasValores((prev) => ({
                                  ...prev,
                                  [cat.categoria_id]: e.target.value,
                                }))
                              }
                              className="w-32 rounded-lg border border-[var(--color-border)] bg-white px-2.5 py-1.5 text-right text-xs font-bold tabular-nums text-[var(--color-text)] outline-none focus:border-teal-600"
                            />
                            {temMeta ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setCategoriasValores((prev) => ({
                                    ...prev,
                                    [cat.categoria_id]: '',
                                  }))
                                }
                                className="text-slate-400 hover:text-rose-600"
                                title="Limpar meta desta categoria"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Rodape */}
        <div className="flex items-center justify-between border-t border-[var(--color-border)] bg-slate-50 px-6 py-4">
          <p className="text-xs text-[var(--color-muted)]">
            {modo === 'padrao'
              ? 'Salvando como Meta Padrão recorrente (valerá para todos os meses sem exceção).'
              : `Salvando como Exceção apenas para ${mesNome}/${dados.periodo.ano}.`}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-lg border border-[var(--color-border)] bg-white px-4 py-2 text-sm font-medium text-[var(--color-text)] hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSalvar}
              disabled={saving}
              className="rounded-lg bg-teal-600 px-5 py-2 text-sm font-semibold text-white shadow-xs hover:bg-teal-700 disabled:opacity-50 cursor-pointer"
            >
              {saving ? 'Salvando...' : 'Salvar Metas'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

