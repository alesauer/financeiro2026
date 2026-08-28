import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { useAuth } from '@/app/providers/AuthProvider'
import { categoriasService } from '@/features/categorias/services/categoriasService'
import { formasPagamentoService } from '@/features/formasPagamento/services/formasPagamentoService'
import { transacoesService } from '@/features/transacoes/services/transacoesService'
import type { Categoria } from '@/shared/types/categoria'
import type { FormaPagamento } from '@/shared/types/formaPagamento'
import type {
  FrequenciaRecorrencia,
  PaginatedResponse,
  Transacao,
  TransacaoPayload,
  TransacaoStatus,
  TransacaoSummary,
} from '@/shared/types/transacao'
import { formatCurrency, getCurrentMonthRange } from '@/shared/utils/date'
import { getErrorMessage } from '@/shared/utils/error'

const TIPOS = ['Receita', 'Despesa', 'Investimento'] as const
const STATUS: TransacaoStatus[] = ['Pago', 'Pendente']
const FREQUENCIAS: FrequenciaRecorrencia[] = ['Diária', 'Semanal', 'Mensal', 'Semestral', 'Anual']
const MESES_NOME = [
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

function isoToday() {
  return new Date().toISOString().slice(0, 10)
}

function isoMonthToday() {
  return new Date().toISOString().slice(0, 7)
}

const EMPTY_FORM: TransacaoPayload = {
  descricao: '',
  valor: 0,
  tipo: 'Despesa',
  categoria_id: 0,
  data_transacao: isoToday(),
  forma_pagamento_id: 0,
  status: 'Pendente',
  recorrente: false,
  recorrencia_tipo: null,
  frequencia: null,
  data_fim: null,
  parcelado: false,
  total_parcelas: null,
  observacoes: null,
}

export function TransacoesPage() {
  const { token } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [formas, setFormas] = useState<FormaPagamento[]>([])

  const [listagem, setListagem] = useState<PaginatedResponse<Transacao> | null>(null)
  const [resumo, setResumo] = useState<TransacaoSummary | null>(null)
  const [cartaoTransacoes, setCartaoTransacoes] = useState<Transacao[]>([])

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [statusUpdatingId, setStatusUpdatingId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [inicio, setInicio] = useState(() => searchParams.get('inicio') || getCurrentMonthRange().firstDay)
  const [fim, setFim] = useState(() => searchParams.get('fim') || getCurrentMonthRange().lastDay)
  const [mesFiltro, setMesFiltro] = useState(() => searchParams.get('mes') || isoMonthToday())
  const [tipoFiltro, setTipoFiltro] = useState<Categoria['tipo'] | ''>(
    () => (searchParams.get('tipo') as Categoria['tipo'] | null) ?? '',
  )
  const [statusFiltro, setStatusFiltro] = useState<TransacaoStatus | ''>('')
  const [categoriaFiltro, setCategoriaFiltro] = useState<number | ''>(() => {
    const valor = Number(searchParams.get('categoria_id'))
    return Number.isFinite(valor) && valor > 0 ? valor : ''
  })
  const [page, setPage] = useState(1)
  const [perPage] = useState(20)
  const [paginaCartao, setPaginaCartao] = useState(1)
  const [porPaginaCartao] = useState(4)

  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<TransacaoPayload>(EMPTY_FORM)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [openGruposCartao, setOpenGruposCartao] = useState<Record<string, boolean>>({})
  const [acoesOpen, setAcoesOpen] = useState(false)
  const acoesRef = useRef<HTMLDivElement | null>(null)

  const paginaAtual = listagem?.current_page ?? page
  const totalPaginas = listagem?.total_pages ?? 1
  const itensListagem = listagem?.items ?? []
  const formasById = useMemo(() => {
    const entries = formas.map((item) => [item.id, item] as const)
    return new Map<number, FormaPagamento>(entries)
  }, [formas])
  const itensGrid = useMemo(() => {
    return itensListagem.filter((item) => {
      const forma = formasById.get(item.forma_pagamento_id)
      const isCartao = item.forma_pagamento_cartao ?? forma?.cartao_credito ?? false
      return !isCartao
    })
  }, [itensListagem, formasById])

  const tituloFormulario = useMemo(() => (editingId ? 'Editar transação' : 'Nova transação'), [editingId])

  const gruposCartao = useMemo(() => {
    const map = new Map<
      string,
      {
        key: string
        formaPagamentoId: number
        cartaoNome: string
        competencia: string | null
        vencimentoLabel: string
        total: number
        items: Transacao[]
      }
    >()

    for (const item of cartaoTransacoes) {
      if (statusFiltro && item.status !== statusFiltro) continue

      const forma = formasById.get(item.forma_pagamento_id)
      const isCartao = item.forma_pagamento_cartao ?? forma?.cartao_credito ?? false
      if (!isCartao) continue

      const competencia =
        normalizarCompetencia(item.competencia_fatura) ?? calcularCompetenciaFatura(item.data_transacao, forma?.dia_fechamento)
      const key = `${item.forma_pagamento_id}|${competencia ?? 'sem-competencia'}`
      const cartaoNome = item.forma_pagamento_nome ?? forma?.nome ?? 'Cartão de crédito'
      const vencimentoLabel = formatarVencimento(competencia, forma?.dia_vencimento)
      const valorEfetivo = getValorEfetivo(item)

      const existente = map.get(key)
      if (existente) {
        existente.total += valorEfetivo
        existente.items.push(item)
      } else {
        map.set(key, {
          key,
          formaPagamentoId: item.forma_pagamento_id,
          cartaoNome,
          competencia,
          vencimentoLabel,
          total: valorEfetivo,
          items: [item],
        })
      }
    }

    return Array.from(map.values()).sort((a, b) => {
      const compA = a.competencia ?? ''
      const compB = b.competencia ?? ''
      if (compA !== compB) return compB.localeCompare(compA)
      return a.cartaoNome.localeCompare(b.cartaoNome)
    })
  }, [cartaoTransacoes, formasById, statusFiltro])
  const totalPaginasCartao = Math.max(1, Math.ceil(gruposCartao.length / porPaginaCartao))
  const paginaCartaoAtual = Math.min(paginaCartao, totalPaginasCartao)
  const gruposCartaoPaginados = useMemo(() => {
    const inicioSlice = (paginaCartaoAtual - 1) * porPaginaCartao
    const fimSlice = inicioSlice + porPaginaCartao
    return gruposCartao.slice(inicioSlice, fimSlice)
  }, [gruposCartao, paginaCartaoAtual, porPaginaCartao])

  const toggleGrupoCartao = (key: string) => {
    setOpenGruposCartao((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  // Categorias compatíveis com o tipo escolhido no formulário.
  const categoriasDoTipo = useMemo(
    () => categorias.filter((categoria) => categoria.tipo === form.tipo),
    [categorias, form.tipo],
  )

  // No parcelamento o valor informado é o total da compra, dividido pelo backend.
  const ehParcelamento = form.recorrente && form.recorrencia_tipo === 'Parcelamento'

  const carregarListagem = async (pageToLoad = page) => {
    if (!token) {
      setListagem(null)
      setResumo(null)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const [lista, resumoData] = await Promise.all([
        transacoesService.list(token, {
          inicio,
          fim,
          tipo: tipoFiltro || undefined,
          status: statusFiltro || undefined,
          categoria_id: categoriaFiltro || undefined,
          cartao_credito: false,
          sort_field: 'tipo_prioridade',
          sort_order: 'asc',
          page: pageToLoad,
          per_page: perPage,
        }),
        transacoesService.summary(token, inicio, fim),
      ])

      setListagem(lista)
      setResumo(resumoData)
    } catch (err) {
      setError(getErrorMessage(err, 'Não foi possível carregar transações.'))
    } finally {
      setLoading(false)
    }
  }

  const carregarCartaoCredito = async () => {
    if (!token) {
      setCartaoTransacoes([])
      return
    }

    try {
      const data = await transacoesService.cartaoCredito(token, inicio, fim)
      setCartaoTransacoes(data.transacoes ?? [])
    } catch {
      setCartaoTransacoes([])
    }
  }

  const carregarDependencias = async () => {
    if (!token) return

    try {
      const [categoriasData, formasData] = await Promise.all([
        categoriasService.list(token),
        formasPagamentoService.list(token),
      ])

      setCategorias(categoriasData)
      const formasAtivas = formasData.filter((item) => item.ativo)
      setFormas(formasAtivas)

      const primeiraForma = formasAtivas[0]?.id ?? 0
      setForm((prev) => ({
        ...prev,
        // Só pré-seleciona uma categoria compatível com o tipo atual do formulário.
        categoria_id: prev.categoria_id || (categoriasData.find((item) => item.tipo === prev.tipo)?.id ?? 0),
        forma_pagamento_id: prev.forma_pagamento_id || primeiraForma,
      }))
    } catch (err) {
      setError(getErrorMessage(err, 'Não foi possível carregar categorias e formas de pagamento.'))
    }
  }

  useEffect(() => {
    carregarDependencias()
  }, [token])

  useEffect(() => {
    if (!token) return
    carregarListagem(page)
  }, [token, inicio, fim, tipoFiltro, statusFiltro, categoriaFiltro, page])

  useEffect(() => {
    const params = new URLSearchParams(searchParams)
    params.set('inicio', inicio)
    params.set('fim', fim)
    params.set('mes', mesFiltro)
    if (tipoFiltro) params.set('tipo', tipoFiltro)
    else params.delete('tipo')
    if (categoriaFiltro) params.set('categoria_id', String(categoriaFiltro))
    else params.delete('categoria_id')
    setSearchParams(params, { replace: true })
  }, [inicio, fim, mesFiltro, tipoFiltro, categoriaFiltro, setSearchParams])

  useEffect(() => {
    setPaginaCartao(1)
  }, [inicio, fim, statusFiltro])

  useEffect(() => {
    setPaginaCartao((prev) => Math.min(prev, totalPaginasCartao))
  }, [totalPaginasCartao])

  useEffect(() => {
    carregarCartaoCredito()
  }, [token, inicio, fim])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!acoesRef.current) return
      if (acoesRef.current.contains(event.target as Node)) return
      setAcoesOpen(false)
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const resetForm = () => {
    setEditingId(null)
    setForm((prev) => ({
      ...EMPTY_FORM,
      categoria_id: categorias.find((item) => item.tipo === EMPTY_FORM.tipo)?.id ?? 0,
      forma_pagamento_id: formas[0]?.id ?? prev.forma_pagamento_id,
      data_transacao: isoToday(),
    }))
  }

  const abrirNovoFormulario = () => {
    resetForm()
    setIsFormOpen(true)
  }

  const cancelarFormulario = () => {
    resetForm()
    setIsFormOpen(false)
  }

  const iniciarEdicao = (item: Transacao) => {
    setEditingId(item.id)
    setIsFormOpen(true)
    setForm({
      descricao: item.descricao,
      valor: Number(item.valor),
      tipo: item.tipo,
      categoria_id: item.categoria_id,
      data_transacao: item.data_transacao,
      forma_pagamento_id: item.forma_pagamento_id,
      status: item.status,
      observacoes: item.observacoes ?? '',
      recorrente: item.recorrente,
      recorrencia_tipo: item.recorrencia_tipo,
      frequencia: item.frequencia,
      data_fim: item.data_fim,
      parcelado: item.parcelado,
      total_parcelas: item.total_parcelas,
    })
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!token) return

    if (!form.descricao.trim()) {
      setError('Informe a descrição da transação.')
      return
    }

    if (!form.categoria_id) {
      setError('Selecione uma categoria.')
      return
    }

    if (!form.valor || form.valor <= 0) {
      setError('Informe um valor válido maior que zero.')
      return
    }

    if (!form.forma_pagamento_id) {
      setError('Selecione uma forma de pagamento.')
      return
    }

    if (form.recorrente && !form.recorrencia_tipo) {
      setError('Selecione o tipo de recorrência.')
      return
    }

    if (form.recorrente && form.recorrencia_tipo === 'Assinatura' && !form.frequencia) {
      setError('Selecione a frequência da assinatura.')
      return
    }

    if (form.recorrente && form.recorrencia_tipo === 'Parcelamento') {
      const totalParcelas = Number(form.total_parcelas ?? 0)
      if (!totalParcelas || totalParcelas < 2) {
        setError('Informe um total de parcelas válido (mínimo 2).')
        return
      }
    }

    if (form.recorrente && form.recorrencia_tipo === 'Assinatura' && form.data_fim && form.data_fim < form.data_transacao) {
      setError('A data fim não pode ser anterior à data da transação.')
      return
    }

    setSaving(true)
    setError(null)

    const payload: TransacaoPayload = {
      ...form,
      descricao: form.descricao.trim(),
      observacoes: form.observacoes?.trim() || null,
    }

    if (!payload.recorrente) {
      payload.recorrencia_tipo = null
      payload.frequencia = null
      payload.data_fim = null
      payload.parcelado = false
      payload.total_parcelas = null
    } else if (payload.recorrencia_tipo === 'Assinatura') {
      payload.parcelado = false
      payload.total_parcelas = null
    } else if (payload.recorrencia_tipo === 'Parcelamento') {
      payload.parcelado = true
      payload.frequencia = null
      payload.data_fim = null
      payload.total_parcelas = Number(payload.total_parcelas ?? 0)
    }

    try {
      if (editingId) {
        await transacoesService.update(token, editingId, payload)
      } else {
        await transacoesService.create(token, payload)
      }

      resetForm()
      setIsFormOpen(false)
      await Promise.all([carregarListagem(page), carregarCartaoCredito()])
    } catch (err) {
      setError(getErrorMessage(err, 'Não foi possível salvar transação.'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!token) return
    if (!window.confirm('Confirma a exclusão desta transação?')) return

    try {
      await transacoesService.remove(token, id)
      await Promise.all([carregarListagem(page), carregarCartaoCredito()])
      if (editingId === id) cancelarFormulario()
    } catch (err) {
      setError(getErrorMessage(err, 'Não foi possível excluir transação.'))
    }
  }

  const proximoStatus = (statusAtual: TransacaoStatus): TransacaoStatus =>
    statusAtual === 'Pago' ? 'Pendente' : 'Pago'

  const handleToggleStatus = async (item: Transacao) => {
    if (!token || statusUpdatingId === item.id) return

    setStatusUpdatingId(item.id)
    setError(null)

    try {
      await transacoesService.update(token, item.id, { status: proximoStatus(item.status) })
      await Promise.all([carregarListagem(page), carregarCartaoCredito()])
    } catch (err) {
      setError(getErrorMessage(err, 'Não foi possível atualizar status da transação.'))
    } finally {
      setStatusUpdatingId(null)
    }
  }

  const getStatusClassName = (status: TransacaoStatus) => {
    if (status === 'Pago') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
    return 'border-amber-200 bg-amber-50 text-amber-700'
  }

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold text-[var(--color-text)]">Transações</h2>
        <p className="text-sm text-[var(--color-muted)]">Controle lançamentos com filtros por período, tipo e status.</p>
      </header>

      {resumo ? (
        <div className="grid gap-3 md:grid-cols-4">
          <ResumoCard label="Receitas" valor={resumo.receitas} tone="text-emerald-600" />
          <ResumoCard label="Despesas" valor={resumo.despesas} tone="text-rose-600" />
          <ResumoCard label="Cartão Crédito" valor={resumo.cartao_credito_total} tone="text-sky-600" />
          <ResumoCard label="Saldo" valor={resumo.saldo} tone="text-[var(--color-text)]" />
        </div>
      ) : null}

      <article className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">Lançamentos</h3>
          <div className="flex items-center gap-2" ref={acoesRef}>
            <div className="relative">
              <button
                type="button"
                onClick={() => setAcoesOpen((prev) => !prev)}
                className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-sm font-medium"
                aria-haspopup="menu"
                aria-expanded={acoesOpen}
              >
                Ações
              </button>

              {acoesOpen ? (
                <div
                  role="menu"
                  className="absolute right-0 z-10 mt-1 min-w-[10rem] rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)]"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setAcoesOpen(false)
                      navigate('/importacao')
                    }}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-[var(--color-bg)]"
                  >
                    Importar
                  </button>
                </div>
              ) : null}
            </div>

            <button
              type="button"
              onClick={abrirNovoFormulario}
              className="rounded-[var(--radius-sm)] bg-[var(--color-primary)] px-3 py-2 text-sm font-semibold text-white"
            >
              Nova transação
            </button>
          </div>
        </div>

        {isFormOpen ? (
          <div className="mb-4 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)]/30 p-4">
            <h4 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">{tituloFormulario}</h4>

            <form className="space-y-3" onSubmit={handleSubmit}>
              <Field label="Descrição">
                <input
                  value={form.descricao}
                  onChange={(event) => setForm((prev) => ({ ...prev, descricao: event.target.value }))}
                  className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-sm"
                />
              </Field>

              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <Field label={ehParcelamento ? 'Valor total da compra' : 'Valor'}>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.valor || ''}
                    onChange={(event) => setForm((prev) => ({ ...prev, valor: Number(event.target.value) }))}
                    className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-sm"
                  />
                  {ehParcelamento && form.valor > 0 && (form.total_parcelas ?? 0) >= 2 ? (
                    <p className="mt-1 text-xs text-[var(--color-muted)]">
                      {form.total_parcelas}x de {formatCurrency(form.valor / (form.total_parcelas ?? 1))}
                    </p>
                  ) : null}
                </Field>

                <Field label="Data">
                  <input
                    type="date"
                    value={form.data_transacao}
                    onChange={(event) => setForm((prev) => ({ ...prev, data_transacao: event.target.value }))}
                    className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-sm"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <Field label="Tipo">
                  <select
                    value={form.tipo}
                    onChange={(event) => {
                      const tipo = event.target.value as Categoria['tipo']
                      setForm((prev) => {
                        const categoriaAtual = categorias.find((item) => item.id === prev.categoria_id)
                        // Mantém a categoria apenas quando ela pertence ao novo tipo.
                        const compativel = categoriaAtual?.tipo === tipo
                        return { ...prev, tipo, categoria_id: compativel ? prev.categoria_id : 0 }
                      })
                    }}
                    className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-sm"
                  >
                    {TIPOS.map((tipo) => (
                      <option key={tipo} value={tipo}>
                        {tipo}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Status">
                  <select
                    value={form.status}
                    onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value as TransacaoStatus }))}
                    className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-sm"
                  >
                    {STATUS.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <Field label="Categoria">
                  <select
                    value={form.categoria_id || ''}
                    onChange={(event) => setForm((prev) => ({ ...prev, categoria_id: Number(event.target.value) }))}
                    disabled={categoriasDoTipo.length === 0}
                    className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-[var(--color-muted)]"
                  >
                    <option value="">
                      {categoriasDoTipo.length === 0
                        ? `Nenhuma categoria do tipo ${form.tipo}`
                        : 'Selecione uma categoria'}
                    </option>
                    {categoriasDoTipo.map((categoria) => (
                      <option key={categoria.id} value={categoria.id}>
                        {categoria.nome}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Forma de pagamento">
                  <select
                    value={form.forma_pagamento_id || ''}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        forma_pagamento_id: event.target.value ? Number(event.target.value) : 0,
                      }))
                    }
                    className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-sm"
                  >
                    <option value="">Selecione</option>
                    {formas.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.nome}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <div className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)]/70 p-3">
                <label className="inline-flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={form.recorrente}
                    onChange={(event) => {
                      const recorrente = event.target.checked
                      setForm((prev) => ({
                        ...prev,
                        recorrente,
                        recorrencia_tipo: recorrente ? prev.recorrencia_tipo ?? 'Assinatura' : null,
                        frequencia: recorrente ? prev.frequencia ?? 'Mensal' : null,
                        data_fim: recorrente ? prev.data_fim : null,
                        parcelado: recorrente ? prev.parcelado : false,
                        total_parcelas: recorrente ? prev.total_parcelas : null,
                      }))
                    }}
                    className="h-4 w-4"
                  />
                  Recorrente
                </label>

                {form.recorrente ? (
                  <div className="mt-3 space-y-3">
                    <Field label="Tipo de recorrência">
                      <div className="flex flex-wrap items-center gap-4 rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2">
                        <label className="inline-flex items-center gap-2 text-sm">
                          <input
                            type="radio"
                            name="recorrencia_tipo"
                            value="Assinatura"
                            checked={form.recorrencia_tipo === 'Assinatura'}
                            onChange={() =>
                              setForm((prev) => ({
                                ...prev,
                                recorrencia_tipo: 'Assinatura',
                                frequencia: prev.frequencia ?? 'Mensal',
                                data_fim: prev.data_fim,
                                parcelado: false,
                                total_parcelas: null,
                              }))
                            }
                            className="h-4 w-4"
                          />
                          Assinatura
                        </label>

                        <label className="inline-flex items-center gap-2 text-sm">
                          <input
                            type="radio"
                            name="recorrencia_tipo"
                            value="Parcelamento"
                            checked={form.recorrencia_tipo === 'Parcelamento'}
                            onChange={() =>
                              setForm((prev) => ({
                                ...prev,
                                recorrencia_tipo: 'Parcelamento',
                                frequencia: null,
                                data_fim: null,
                                parcelado: true,
                                total_parcelas: prev.total_parcelas && prev.total_parcelas >= 2 ? prev.total_parcelas : 2,
                              }))
                            }
                            className="h-4 w-4"
                          />
                          Parcelamento
                        </label>
                      </div>
                    </Field>

                    {form.recorrencia_tipo === 'Assinatura' ? (
                      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                        <Field label="Frequência">
                          <select
                            value={form.frequencia ?? 'Mensal'}
                            onChange={(event) =>
                              setForm((prev) => ({
                                ...prev,
                                frequencia: event.target.value as FrequenciaRecorrencia,
                              }))
                            }
                            className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-sm"
                          >
                            {FREQUENCIAS.map((frequencia) => (
                              <option key={frequencia} value={frequencia}>
                                {frequencia}
                              </option>
                            ))}
                          </select>
                        </Field>

                        <Field label="Data fim (opcional)">
                          <input
                            type="date"
                            value={form.data_fim ?? ''}
                            min={form.data_transacao}
                            onChange={(event) =>
                              setForm((prev) => ({
                                ...prev,
                                data_fim: event.target.value || null,
                              }))
                            }
                            className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-sm"
                          />
                        </Field>
                      </div>
                    ) : null}

                    {form.recorrencia_tipo === 'Parcelamento' ? (
                      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                        <Field label="Total de parcelas">
                          <input
                            type="number"
                            min={2}
                            max={60}
                            value={form.total_parcelas ?? 2}
                            onChange={(event) =>
                              setForm((prev) => ({
                                ...prev,
                                total_parcelas: event.target.value ? Number(event.target.value) : null,
                                parcelado: true,
                              }))
                            }
                            className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-sm"
                          />
                        </Field>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <Field label="Observações">
                <textarea
                  value={form.observacoes || ''}
                  onChange={(event) => setForm((prev) => ({ ...prev, observacoes: event.target.value || null }))}
                  rows={3}
                  className="w-full resize-y rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-sm"
                />
              </Field>

              <div className="flex items-center gap-2 pt-2">
                <button
                  disabled={saving}
                  className="rounded-[var(--radius-sm)] bg-[var(--color-primary)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {saving ? 'Salvando...' : editingId ? 'Salvar alterações' : 'Adicionar'}
                </button>
                <button
                  type="button"
                  onClick={cancelarFormulario}
                  className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-sm"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        ) : null}

        {editingId ? null : <div className="mb-4 grid gap-2 md:grid-cols-6">
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-[var(--radius-sm)] bg-[var(--color-primary)] px-3 py-2 text-sm font-semibold text-white"
              >
                Mês
              </button>
              <select
                value={mesFiltro.slice(5, 7)}
                onChange={(event) => {
                  const mesNumero = event.target.value
                  const anoSelecionado = inicio.slice(0, 4) || new Date().getFullYear().toString()
                  const mes = `${anoSelecionado}-${mesNumero}`
                  const [ano, mesNum] = mes.split('-').map(Number)
                  const ultimoDia = new Date(ano, mesNum, 0).getDate()
                  setPage(1)
                  setMesFiltro(mes)
                  setInicio(`${mes}-01`)
                  setFim(`${mes}-${String(ultimoDia).padStart(2, '0')}`)
                }}
                className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-sm"
              >
                {MESES_NOME.map((nome, index) => {
                  const valor = String(index + 1).padStart(2, '0')
                  return (
                    <option key={valor} value={valor}>
                      {nome}
                    </option>
                  )
                })}
              </select>
            </div>
            <input
              type="date"
              value={inicio}
              onChange={(event) => {
                setPage(1)
                setInicio(event.target.value)
                if (event.target.value) setMesFiltro(event.target.value.slice(0, 7))
              }}
              className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-sm"
            />
            <input
              type="date"
              value={fim}
              onChange={(event) => {
                setPage(1)
                setFim(event.target.value)
                if (event.target.value) setMesFiltro(event.target.value.slice(0, 7))
              }}
              className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-sm"
            />
            <select
              value={tipoFiltro}
              onChange={(event) => {
                setPage(1)
                setTipoFiltro(event.target.value as Categoria['tipo'] | '')
              }}
              className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-sm"
            >
              <option value="">Todos os tipos</option>
              {TIPOS.map((tipo) => (
                <option key={tipo} value={tipo}>
                  {tipo}
                </option>
              ))}
            </select>
            <select
              value={statusFiltro}
              onChange={(event) => {
                setPage(1)
                setStatusFiltro(event.target.value as TransacaoStatus | '')
              }}
              className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-sm"
            >
              <option value="">Todos os status</option>
              {STATUS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                setPage(1)
                carregarListagem(1)
              }}
              className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-sm font-medium"
            >
              Atualizar
            </button>
        </div>}

        {editingId || !categoriaFiltro ? null : (
          <div className="mb-4 flex items-center gap-2 rounded-[var(--radius-sm)] border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-800">
            <span>
              Filtrando pela categoria{' '}
              <strong>{categorias.find((item) => item.id === categoriaFiltro)?.nome ?? categoriaFiltro}</strong>
            </span>
            <button
              type="button"
              onClick={() => {
                setCategoriaFiltro('')
                setPage(1)
                const params = new URLSearchParams(searchParams)
                params.delete('categoria_id')
                setSearchParams(params, { replace: true })
              }}
              className="ml-auto rounded border border-sky-300 px-2 py-1 text-xs font-medium hover:bg-sky-100"
            >
              Limpar filtro
            </button>
          </div>
        )}

        {error ? <p className="mb-3 text-sm text-rose-600">{error}</p> : null}

        {editingId ? null : gruposCartao.length > 0 ? (
          <section className="mb-4 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)]/30 p-3">
            <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">Faturas de cartão</h4>
            <div className="space-y-2">
              {gruposCartaoPaginados.map((grupo) => {
                const isOpen = Boolean(openGruposCartao[grupo.key])
                return (
                  <div key={grupo.key} className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)]">
                    <button
                      type="button"
                      onClick={() => toggleGrupoCartao(grupo.key)}
                      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
                    >
                      <div>
                        <p className="text-sm font-semibold text-[var(--color-text)]">{grupo.cartaoNome}</p>
                        <p className="text-xs text-[var(--color-muted)]">
                          Fatura {formatarCompetencia(grupo.competencia)} · {grupo.vencimentoLabel} · {grupo.items.length} compra(s)
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-[var(--color-text)]">{formatCurrency(grupo.total)}</p>
                        <p className="text-xs text-[var(--color-muted)]">{isOpen ? 'Ocultar compras' : 'Ver compras'}</p>
                      </div>
                    </button>

                    {isOpen ? (
                      <div className="border-t border-[var(--color-border)] px-3 py-2">
                        <div className="space-y-2 md:hidden">
                          {grupo.items.map((item) => (
                            <article key={item.id} className="rounded-[var(--radius-sm)] border border-[var(--color-border)] p-2">
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-sm font-medium text-[var(--color-text)]">{item.descricao}</p>
                                <p className="text-sm font-semibold">{formatCurrency(getValorEfetivo(item))}</p>
                              </div>
                              <p className="mt-1 text-xs text-[var(--color-muted)]">
                                {item.data_transacao} · {item.status} · {item.categoria_nome ?? '-'}
                              </p>
                              <div className="mt-2 flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => iniciarEdicao(item)}
                                  className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-2 py-1 text-xs"
                                >
                                  Editar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDelete(item.id)}
                                  className="rounded-[var(--radius-sm)] border border-rose-200 px-2 py-1 text-xs text-rose-600"
                                >
                                  Excluir
                                </button>
                              </div>
                            </article>
                          ))}
                        </div>

                        <div className="hidden overflow-x-auto md:block">
                          <table className="min-w-full border-collapse text-sm">
                            <thead>
                              <tr className="border-b border-[var(--color-border)] text-left">
                                <th className="py-2 pr-3">Data</th>
                                <th className="py-2 pr-3">Descrição</th>
                                <th className="py-2 pr-3">Categoria</th>
                                <th className="py-2 pr-3">Status</th>
                                <th className="py-2 pr-3">Valor</th>
                                <th className="py-2 text-right">Ações</th>
                              </tr>
                            </thead>
                            <tbody>
                              {grupo.items.map((item) => (
                                <tr key={item.id} className="border-b border-[var(--color-border)]/70">
                                  <td className="py-2 pr-3">{item.data_transacao}</td>
                                  <td className="py-2 pr-3">{item.descricao}</td>
                                  <td className="py-2 pr-3">{item.categoria_nome ?? '-'}</td>
                                  <td className="py-2 pr-3">
                                    <button
                                      type="button"
                                      onClick={() => handleToggleStatus(item)}
                                      disabled={statusUpdatingId === item.id}
                                      className={`rounded-[var(--radius-sm)] border px-2 py-1 text-xs disabled:opacity-50 ${getStatusClassName(item.status)}`}
                                      title="Clique para alternar entre Pago e Pendente"
                                    >
                                      {statusUpdatingId === item.id ? 'Salvando...' : item.status}
                                    </button>
                                  </td>
                                  <td className="py-2 pr-3">{formatCurrency(getValorEfetivo(item))}</td>
                                  <td className="py-2 text-right">
                                    <div className="inline-flex items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() => iniciarEdicao(item)}
                                        className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-2 py-1 text-xs"
                                      >
                                        Editar
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDelete(item.id)}
                                        className="rounded-[var(--radius-sm)] border border-rose-200 px-2 py-1 text-xs text-rose-600"
                                      >
                                        Excluir
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>

            {gruposCartao.length > porPaginaCartao ? (
              <footer className="mt-3 flex items-center justify-between text-sm">
                <span className="text-[var(--color-muted)]">
                  Página {paginaCartaoAtual} de {totalPaginasCartao}
                </span>
                <div className="inline-flex items-center gap-2">
                  <button
                    type="button"
                    disabled={paginaCartaoAtual <= 1}
                    onClick={() => setPaginaCartao((prev) => Math.max(1, prev - 1))}
                    className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-1 disabled:opacity-50"
                  >
                    Anterior
                  </button>
                  <button
                    type="button"
                    disabled={paginaCartaoAtual >= totalPaginasCartao}
                    onClick={() => setPaginaCartao((prev) => Math.min(totalPaginasCartao, prev + 1))}
                    className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-1 disabled:opacity-50"
                  >
                    Próxima
                  </button>
                </div>
              </footer>
            ) : null}
          </section>
        ) : null}

        {editingId ? null : loading ? (
          <p className="mb-3 text-sm text-[var(--color-muted)] md:hidden">Carregando...</p>
        ) : itensGrid.length === 0 ? (
          <p className="mb-3 text-sm text-[var(--color-muted)] md:hidden">Nenhuma transação no período selecionado.</p>
        ) : (
          <div className="mb-3 space-y-2 md:hidden">
            {itensGrid.map((item) => (
              <article
                key={item.id}
                className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-[var(--color-text)]">{item.descricao}</p>
                  <p className="text-sm font-semibold">{formatCurrency(getValorEfetivo(item))}</p>
                </div>
                <div className="mt-1 space-y-0.5 text-xs text-[var(--color-muted)]">
                  <p>Data: {item.data_transacao}</p>
                  <p>
                    Tipo: <span className={getTipoClassName(item.tipo)}>{item.tipo}</span>
                  </p>
                  <p>Categoria: {item.categoria_nome ?? '-'}</p>
                  <p>
                    Status:{' '}
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(item)}
                      disabled={statusUpdatingId === item.id}
                      className={`rounded-[var(--radius-sm)] border px-2 py-0.5 text-xs disabled:opacity-50 ${getStatusClassName(item.status)}`}
                      title="Clique para alternar entre Pago e Pendente"
                    >
                      {statusUpdatingId === item.id ? 'Salvando...' : item.status}
                    </button>
                  </p>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => iniciarEdicao(item)}
                    className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-2 py-1 text-xs"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(item.id)}
                    className="rounded-[var(--radius-sm)] border border-rose-200 px-2 py-1 text-xs text-rose-600"
                  >
                    Excluir
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}

        {editingId ? null : <div className="overflow-x-auto">
          <table className="hidden min-w-full border-collapse text-sm md:table">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left">
                <th className="py-2 pr-3">Data</th>
                <th className="py-2 pr-3">Descrição</th>
                <th className="py-2 pr-3">Tipo</th>
                <th className="py-2 pr-3">Categoria</th>
                <th className="py-2 pr-3">Valor</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-4 text-center text-[var(--color-muted)]">
                    Carregando...
                  </td>
                </tr>
              ) : itensGrid.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-4 text-center text-[var(--color-muted)]">
                    Nenhuma transação no período selecionado.
                  </td>
                </tr>
              ) : (
                itensGrid.map((item) => (
                  <tr key={item.id} className="border-b border-[var(--color-border)]/70">
                    <td className="py-2 pr-3">{item.data_transacao}</td>
                    <td className="py-2 pr-3">{item.descricao}</td>
                    <td className={`py-2 pr-3 font-medium ${getTipoClassName(item.tipo)}`}>{item.tipo}</td>
                    <td className="py-2 pr-3">{item.categoria_nome}</td>
                    <td className="py-2 pr-3">{formatCurrency(getValorEfetivo(item))}</td>
                    <td className="py-2 pr-3">
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(item)}
                        disabled={statusUpdatingId === item.id}
                        className={`rounded-[var(--radius-sm)] border px-2 py-1 text-xs disabled:opacity-50 ${getStatusClassName(item.status)}`}
                        title="Clique para alternar entre Pago e Pendente"
                      >
                        {statusUpdatingId === item.id ? 'Salvando...' : item.status}
                      </button>
                    </td>
                    <td className="py-2 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => iniciarEdicao(item)}
                          className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-2 py-1 text-xs"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(item.id)}
                          className="rounded-[var(--radius-sm)] border border-rose-200 px-2 py-1 text-xs text-rose-600"
                        >
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>}

        {editingId ? null : <footer className="mt-4 flex items-center justify-between text-sm">
          <span className="text-[var(--color-muted)]">
            Página {paginaAtual} de {totalPaginas}
          </span>
          <div className="inline-flex items-center gap-2">
            <button
              type="button"
              disabled={paginaAtual <= 1 || loading}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-1 disabled:opacity-50"
            >
              Anterior
            </button>
            <button
              type="button"
              disabled={paginaAtual >= totalPaginas || loading}
              onClick={() => setPage((prev) => prev + 1)}
              className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-1 disabled:opacity-50"
            >
              Próxima
            </button>
          </div>
        </footer>}
      </article>
    </section>
  )
}

function calcularCompetenciaFatura(dataTransacao: string, diaFechamento?: number | null) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataTransacao)) return null
  const [anoStr, mesStr, diaStr] = dataTransacao.split('-')
  const ano = Number(anoStr)
  const mes = Number(mesStr)
  const dia = Number(diaStr)
  if (!ano || !mes || !dia) return null

  if (!diaFechamento || diaFechamento <= 0) {
    return `${anoStr}-${mesStr}`
  }

  const dataCompetencia = new Date(ano, mes - 1, 1)
  if (dia > diaFechamento) {
    dataCompetencia.setMonth(dataCompetencia.getMonth() + 1)
  }

  const anoComp = dataCompetencia.getFullYear()
  const mesComp = String(dataCompetencia.getMonth() + 1).padStart(2, '0')
  return `${anoComp}-${mesComp}`
}

function formatarCompetencia(competencia: string | null) {
  if (!competencia) return '-'

  const matchIsoDia = competencia.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (matchIsoDia) return `${matchIsoDia[2]}/${matchIsoDia[1]}`

  const matchIso = competencia.match(/^(\d{4})-(\d{2})$/)
  if (matchIso) return `${matchIso[2]}/${matchIso[1]}`

  const matchBr = competencia.match(/^(\d{2})\/(\d{4})$/)
  if (matchBr) return competencia

  return competencia
}

function formatarVencimento(competencia: string | null, diaVencimento?: number | null) {
  if (!competencia || !diaVencimento || diaVencimento <= 0) return 'Vencimento não informado'

  let ano: number | null = null
  let mes: number | null = null

  const matchIso = competencia.match(/^(\d{4})-(\d{2})$/)
  if (matchIso) {
    ano = Number(matchIso[1])
    mes = Number(matchIso[2])
  } else {
    const matchIsoDia = competencia.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (matchIsoDia) {
      ano = Number(matchIsoDia[1])
      mes = Number(matchIsoDia[2])
    }

    const matchBr = competencia.match(/^(\d{2})\/(\d{4})$/)
    if (matchBr) {
      mes = Number(matchBr[1])
      ano = Number(matchBr[2])
    }
  }

  if (!ano || !mes) return `Venc. dia ${diaVencimento}`

  const ultimoDiaMes = new Date(ano, mes, 0).getDate()
  const dia = Math.min(diaVencimento, ultimoDiaMes)
  return `Venc. ${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${ano}`
}

function getTipoClassName(tipo: Categoria['tipo']) {
  if (tipo === 'Receita') return 'text-emerald-600'
  if (tipo === 'Despesa') return 'text-rose-600'
  return 'text-[var(--color-text)]'
}

function normalizarCompetencia(competencia?: string | null) {
  if (!competencia) return null
  const isoDia = competencia.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (isoDia) return `${isoDia[1]}-${isoDia[2]}`

  const isoMes = competencia.match(/^(\d{4})-(\d{2})$/)
  if (isoMes) return competencia

  const brMes = competencia.match(/^(\d{2})\/(\d{4})$/)
  if (brMes) return `${brMes[2]}-${brMes[1]}`

  return competencia
}

function getValorEfetivo(item: Transacao) {
  if (item.parcelado && item.valor_parcela != null) {
    return Number(item.valor_parcela)
  }
  return Number(item.valor)
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium">{label}</label>
      {children}
    </div>
  )
}

function ResumoCard({ label, valor, tone }: { label: string; valor: number; tone: string }) {
  return (
    <article className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">{label}</p>
      <p className={`mt-2 text-xl font-semibold ${tone}`}>{formatCurrency(valor)}</p>
    </article>
  )
}
