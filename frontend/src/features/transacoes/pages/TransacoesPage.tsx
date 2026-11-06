import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CalendarPlus, RefreshCw } from 'lucide-react'

import { useAuth } from '@/app/providers/AuthProvider'
import { MonthNavigator } from '@/features/transacoes/components/MonthNavigator'
import { FaturaCard } from '@/features/transacoes/components/FaturaCard'
import { FaturaDrawer } from '@/features/transacoes/components/FaturaDrawer'
import { SincronizarCartaoModal } from '@/features/transacoes/components/SincronizarCartaoModal'
import { CopiarMesModal } from '@/features/transacoes/components/CopiarMesModal'
import { ConfirmarRetroativoModal } from '@/features/transacoes/components/ConfirmarRetroativoModal'
import { MetasMiniBanner } from '@/features/metas/components/MetasMiniBanner'
import { categoriasService } from '@/features/categorias/services/categoriasService'
import { formasPagamentoService } from '@/features/formasPagamento/services/formasPagamentoService'
import { transacoesService } from '@/features/transacoes/services/transacoesService'
import type { Categoria } from '@/shared/types/categoria'
import type { FormaPagamento } from '@/shared/types/formaPagamento'
import type {
  FaturaCartao,
  FrequenciaRecorrencia,
  PaginatedResponse,
  Transacao,
  TransacaoPayload,
  TransacaoStatus,
  TransacaoSummary,
} from '@/shared/types/transacao'
import { formatCurrency, getCurrentMonthRange, getMonthRange } from '@/shared/utils/date'
import { getErrorMessage } from '@/shared/utils/error'

const TIPOS = ['Receita', 'Despesa', 'Investimento'] as const
const STATUS: TransacaoStatus[] = ['Pago', 'Pendente']
const FREQUENCIAS: FrequenciaRecorrencia[] = ['Diária', 'Semanal', 'Mensal', 'Semestral', 'Anual']

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
  const [faturas, setFaturas] = useState<FaturaCartao[]>([])
  const [faturaDrawerOpen, setFaturaDrawerOpen] = useState(false)
  const [faturaSelecionada, setFaturaSelecionada] = useState<FaturaCartao | null>(null)
  const [syncCartaoModalOpen, setSyncCartaoModalOpen] = useState(false)
  const [copiarMesModalOpen, setCopiarMesModalOpen] = useState(false)
  const [retroativoModalOpen, setRetroativoModalOpen] = useState(false)
  const [retroativoDados, setRetroativoDados] = useState<{
    estabelecimento: string
    categoriaNome: string
    quantidade: number
    itens: Array<{ id: number; descricao: string; data_transacao: string | null; valor: number; categoria_atual: string }>
    pendingPayload: TransacaoPayload | null
    transacaoId: number | null
  }>({
    estabelecimento: '',
    categoriaNome: '',
    quantidade: 0,
    itens: [],
    pendingPayload: null,
    transacaoId: null,
  })
  const [feedbackSync, setFeedbackSync] = useState<string | null>(null)

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
  const [origemFiltro, setOrigemFiltro] = useState<'contas' | 'todos' | 'cartao'>('contas')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(50)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingItem, setEditingItem] = useState<Transacao | null>(null)
  const [form, setForm] = useState<TransacaoPayload>(EMPTY_FORM)
  const [isFormOpen, setIsFormOpen] = useState(false)
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
      if (origemFiltro === 'contas') return !isCartao
      if (origemFiltro === 'cartao') return isCartao
      return true
    })
  }, [itensListagem, formasById, origemFiltro])

  const tituloFormulario = useMemo(() => (editingId ? 'Editar transação' : 'Nova transação'), [editingId])

  const totaisCartaoGeral = useMemo(() => {
    if (faturas.length > 0) {
      const gastosReais = faturas.reduce((acc, f) => acc + f.total, 0)
      const prePagos = faturas.reduce((acc, f) => acc + f.total_pagas, 0)
      const saldoPendente = faturas.reduce((acc, f) => acc + f.total_pendentes, 0)
      const qtdEstornos = faturas.reduce((acc, f) => acc + f.qtd_estornos, 0)
      const somaEstornos = faturas.reduce((acc, f) => acc + f.soma_estornos, 0)
      return { gastosReais, prePagos, saldoPendente, qtdEstornos, somaEstornos }
    }
    return {
      gastosReais: resumo?.cartao_credito_total ?? 0,
      prePagos: resumo?.cartao_credito_pago ?? 0,
      saldoPendente: resumo?.cartao_credito_pendente ?? (resumo?.cartao_credito_total ?? 0),
      qtdEstornos: 0,
      somaEstornos: 0,
    }
  }, [faturas, resumo])

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
          origem: origemFiltro === 'todos' ? undefined : origemFiltro,
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
      setFaturas([])
      return
    }

    try {
      const data = await transacoesService.cartaoCredito(token, inicio, fim)
      setFaturas(data.faturas ?? [])
      if (faturaSelecionada) {
        const faturaAtualizada = data.faturas?.find((f) => f.key === faturaSelecionada.key)
        if (faturaAtualizada) setFaturaSelecionada(faturaAtualizada)
      }
    } catch {
      setFaturas([])
    }
  }

  const handleQuitarFatura = async (fatura: FaturaCartao, status: 'Pago' | 'Pendente') => {
    if (!token) return
    try {
      await transacoesService.quitarFatura(token, fatura.forma_pagamento_id, fatura.competencia, status)
      await Promise.all([carregarListagem(), carregarCartaoCredito()])
    } catch (err) {
      setError(getErrorMessage(err, 'Erro ao atualizar status da fatura.'))
    }
  }

  const handleExcluirLoteFatura = async (ids: number[]) => {
    if (!token || ids.length === 0) return
    try {
      await transacoesService.removeLote(token, ids)
      await Promise.all([carregarListagem(), carregarCartaoCredito()])
    } catch (err) {
      setError(getErrorMessage(err, 'Erro ao excluir lançamentos da fatura.'))
    }
  }

  const handleSyncCartaoSuccess = async (resumo: any) => {
    const novas = resumo?.novas_transacoes ?? 0
    const nome = resumo?.cartao_nome || 'Cartão'
    const mes = resumo?.mes_fatura ? ` (${resumo.mes_fatura})` : ''
    setFeedbackSync(`${nome}${mes}: sincronizado com sucesso! ${novas} novos lançamentos importados.`)
    setTimeout(() => setFeedbackSync(null), 6000)

    const mesIso: string | undefined = resumo?.mes_fatura_iso
    if (mesIso && /^\d{4}-\d{2}$/.test(mesIso) && mesIso !== mesFiltro) {
      const [y, m] = mesIso.split('-').map(Number)
      const ultimoDia = new Date(y, m, 0).getDate()
      setPage(1)
      setInicio(`${mesIso}-01`)
      setFim(`${mesIso}-${String(ultimoDia).padStart(2, '0')}`)
      setMesFiltro(mesIso)
      return
    }

    await Promise.all([carregarListagem(), carregarCartaoCredito()])
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
  }, [token, inicio, fim, tipoFiltro, statusFiltro, categoriaFiltro, origemFiltro, page, perPage])

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
    setEditingItem(null)
    setError(null)
    const tipoPadrao: Categoria['tipo'] =
      tipoFiltro && TIPOS.includes(tipoFiltro as any) ? (tipoFiltro as Categoria['tipo']) : 'Despesa'
    const primeiraCat = categorias.find((item) => item.tipo === tipoPadrao)?.id ?? 0
    setForm((prev) => ({
      ...EMPTY_FORM,
      tipo: tipoPadrao,
      categoria_id: primeiraCat,
      forma_pagamento_id: formas[0]?.id ?? prev.forma_pagamento_id,
      data_transacao: isoToday(),
    }))
  }

  const abrirNovoFormulario = () => {
    setError(null)
    resetForm()
    setIsFormOpen(true)
  }

  useEffect(() => {
    if (searchParams.get('novo') === 'true') {
      abrirNovoFormulario()
      const params = new URLSearchParams(searchParams)
      params.delete('novo')
      setSearchParams(params, { replace: true })
    }
  }, [searchParams, setSearchParams])

  const cancelarFormulario = () => {
    resetForm()
    setIsFormOpen(false)
  }

  const iniciarEdicao = (item: Transacao) => {
    setEditingId(item.id)
    setEditingItem(item)
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
        const itemOriginal =
          editingItem ||
          listagem?.items.find((x) => x.id === editingId)
        const categoriaAlterada = Boolean(
          itemOriginal &&
          payload.categoria_id &&
          itemOriginal.categoria_id !== payload.categoria_id
        )

        if (categoriaAlterada && payload.categoria_id) {
          try {
            const verif = await transacoesService.verificarAnterioresEstabelecimento(
              token,
              editingId,
              payload.categoria_id
            )
            if (verif.quantidade > 0) {
              const catNovaObj = categorias.find((c) => c.id === payload.categoria_id)
              setRetroativoDados({
                estabelecimento: verif.estabelecimento || payload.descricao || itemOriginal?.descricao || '',
                categoriaNome: catNovaObj?.nome || 'Nova Categoria',
                quantidade: verif.quantidade,
                itens: verif.itens,
                pendingPayload: payload,
                transacaoId: editingId,
              })
              setRetroativoModalOpen(true)
              setSaving(false)
              return
            }
          } catch {
            // Se falhar a verificação prévia, prossegue com update normal
          }
        }

        await transacoesService.update(token, editingId, payload)
        setFeedbackSync(`Transação "${payload.descricao}" atualizada com sucesso!`)
      } else {
        await transacoesService.create(token, payload)
        setFeedbackSync(`Transação "${payload.descricao}" (${payload.tipo}) adicionada com sucesso!`)

        // Se o usuário adicionou um tipo diferente do filtro ativo (ex.: adicionou Receita com filtro Despesa ativo),
        // limpamos o filtro para que o novo lançamento apareça imediatamente na tela.
        if (tipoFiltro && tipoFiltro !== payload.tipo) {
          setTipoFiltro('')
        }
        if (categoriaFiltro) {
          const catObj = categorias.find((c) => c.id === categoriaFiltro)
          if (catObj && catObj.tipo !== payload.tipo) {
            setCategoriaFiltro('')
          }
        }

        // Se a data do lançamento pertencer a outro mês, ajusta o navegador para o mês correspondente
        const mesLancamento = payload.data_transacao.slice(0, 7)
        if (mesLancamento && /^\d{4}-\d{2}$/.test(mesLancamento) && mesLancamento !== mesFiltro) {
          const [y, m] = mesLancamento.split('-').map(Number)
          const ultimoDia = new Date(y, m, 0).getDate()
          setInicio(`${mesLancamento}-01`)
          setFim(`${mesLancamento}-${String(ultimoDia).padStart(2, '0')}`)
          setMesFiltro(mesLancamento)
        }
      }

      setTimeout(() => setFeedbackSync(null), 6000)
      resetForm()
      setIsFormOpen(false)
      await Promise.all([carregarListagem(1), carregarCartaoCredito()])
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
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          <ResumoCard
            label="Receitas"
            valor={resumo.receitas}
            tone="text-emerald-600"
            subContent={
              <p className="mt-1 text-[11px] text-[var(--color-muted)]">Total entradas do mês</p>
            }
          />
          <ResumoCard
            label="Outras Despesas"
            valor={resumo.despesas_conta}
            tone="text-amber-600"
            subContent={
              <p className="mt-1 text-[11px] text-[var(--color-muted)]">Conta corrente / Pix / Boletos</p>
            }
          />
          <ResumoCard
            label="Cartão Crédito"
            valor={totaisCartaoGeral.gastosReais || resumo.cartao_credito_total}
            tone="text-sky-600"
            subContent={
              totaisCartaoGeral.saldoPendente > 0 ? (
                <div className="mt-2.5 space-y-1 border-t border-[var(--color-border)]/70 pt-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-[var(--color-muted)]">Pré-pagos:</span>
                    <span className="font-semibold text-emerald-700">
                      {formatCurrency(totaisCartaoGeral.prePagos)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-[var(--color-text)]">Total fatura:</span>
                    <span className="font-bold text-purple-900">
                      {formatCurrency(totaisCartaoGeral.saldoPendente)}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="mt-1 text-[11px] text-[var(--color-muted)]">Faturas do período</p>
              )
            }
          />
          <ResumoCard
            label="Total Despesas"
            valor={(resumo.despesas_conta ?? 0) + (totaisCartaoGeral.gastosReais || resumo.cartao_credito_total)}
            tone="text-rose-600"
            subContent={
              <p className="mt-1 text-[11px] text-[var(--color-muted)]">Outras Desp. + Cartão</p>
            }
          />
          <ResumoCard
            label="Saldo"
            valor={resumo.receitas - ((resumo.despesas_conta ?? 0) + (totaisCartaoGeral.gastosReais || resumo.cartao_credito_total))}
            tone={(resumo.receitas - ((resumo.despesas_conta ?? 0) + (totaisCartaoGeral.gastosReais || resumo.cartao_credito_total))) >= 0 ? 'text-emerald-600' : 'text-rose-600'}
            subContent={
              <p className="mt-1 text-[11px] text-[var(--color-muted)]">Receitas − Total Desp.</p>
            }
          />
        </div>
      ) : null}

      <MetasMiniBanner token={token} mesIso={mesFiltro} refreshTrigger={resumo} />

      <article className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">Lançamentos</h3>
          <div className="flex flex-wrap items-center gap-2" ref={acoesRef}>
            <button
              type="button"
              onClick={() => setCopiarMesModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-teal-300 bg-teal-50 px-3 py-2 text-sm font-semibold text-teal-800 hover:bg-teal-100 transition-colors shadow-2xs cursor-pointer"
              title="Copiar receitas e despesas de conta para o proximo mes"
            >
              <CalendarPlus className="h-4 w-4" />
              <span>Copiar p/ Próximo Mês</span>
            </button>

            <button
              type="button"
              onClick={() => setSyncCartaoModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-sky-300 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-700 hover:bg-sky-100 transition-colors shadow-2xs"
              title="Sincronizar fatura de cartão de crédito via Open Finance"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Sincronizar Cartão</span>
            </button>

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
                  className="absolute right-0 z-10 mt-1 min-w-[11rem] rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-md"
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
                    Importar Extrato
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setAcoesOpen(false)
                      setSyncCartaoModalOpen(true)
                    }}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-[var(--color-bg)] text-sky-700 font-medium"
                  >
                    Sincronizar Cartão
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
                      setError(null)
                      setForm((prev) => {
                        const categoriaAtual = categorias.find((item) => item.id === prev.categoria_id)
                        const compativel = categoriaAtual?.tipo === tipo
                        const primeiraValida = categorias.find((item) => item.tipo === tipo)?.id ?? 0
                        return { ...prev, tipo, categoria_id: compativel ? prev.categoria_id : primeiraValida }
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

              {error ? (
                <div className="rounded-[var(--radius-sm)] border border-rose-200 bg-rose-50 p-2.5 text-xs font-semibold text-rose-700 flex items-center gap-2">
                  <span>⚠️</span>
                  <span>{error}</span>
                </div>
              ) : null}

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

        {editingId ? null : (
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            {/* Seletor de Mês SaaS (Setas < Mês Ano >, Popover e Mês Atual) */}
            <MonthNavigator
              inicio={inicio}
              fim={fim}
              mesFiltro={mesFiltro}
              onChangeRange={(novoInicio, novoFim, novoMes) => {
                setPage(1)
                setInicio(novoInicio)
                setFim(novoFim)
                setMesFiltro(novoMes)
              }}
            />

            {/* Filtros de Tipo, Status e Ação de Atualizar */}
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={tipoFiltro}
                onChange={(event) => {
                  setPage(1)
                  setTipoFiltro(event.target.value as Categoria['tipo'] | '')
                }}
                className="h-9 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-xs font-medium text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)]"
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
                className="h-9 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-xs font-medium text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)]"
              >
                <option value="">Todos os status</option>
                {STATUS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>

              <select
                value={origemFiltro}
                onChange={(event) => {
                  setPage(1)
                  setOrigemFiltro(event.target.value as 'todos' | 'contas' | 'cartao')
                }}
                className="h-9 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-xs font-medium text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)]"
                title="Filtrar por tipo de conta ou cartão"
              >
                <option value="contas">Apenas Contas & Pix (Não Cartão)</option>
                <option value="todos">Todas (Contas & Cartões)</option>
                <option value="cartao">Apenas Cartão de Crédito</option>
              </select>

              <button
                type="button"
                onClick={() => {
                  setPage(1)
                  carregarListagem(1)
                  carregarCartaoCredito()
                }}
                title="Atualizar lançamentos"
                className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-xs font-medium text-[var(--color-text)] shadow-sm transition hover:bg-[var(--color-bg)] hover:text-[var(--color-primary)]"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Atualizar</span>
              </button>
            </div>
          </div>
        )}

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

        {feedbackSync ? (
          <div className="mb-4 flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
            <span>✅ {feedbackSync}</span>
            <button
              type="button"
              onClick={() => setFeedbackSync(null)}
              className="font-bold text-emerald-700 hover:text-emerald-900 ml-2"
            >
              ✕
            </button>
          </div>
        ) : null}

        {error ? <p className="mb-3 text-sm text-rose-600">{error}</p> : null}

        {editingId ? null : faturas.length > 0 ? (
          <section className="mb-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-xs">
            <div className="mb-2 flex items-center justify-between gap-2 border-b border-[var(--color-border)] pb-2">
              <div className="flex items-center gap-2">
                <span className="text-sm">💳</span>
                <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text)]">
                  Faturas com Vencimento no Mês
                </h4>
                <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 border border-indigo-200">
                  {faturas.length} {faturas.length === 1 ? 'cartão' : 'cartões'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSyncCartaoModalOpen(true)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-sky-600 hover:text-sky-800 transition-colors"
                title="Sincronizar fatura via Open Finance"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Sincronizar</span>
              </button>
            </div>

            <div className="flex flex-col gap-2">
              {faturas.map((fatura) => (
                <FaturaCard
                  key={fatura.key}
                  fatura={fatura}
                  onAbrirDrawer={(f) => {
                    setFaturaSelecionada(f)
                    setFaturaDrawerOpen(true)
                  }}
                  onQuitarFatura={(f, status) => handleQuitarFatura(f, status)}
                />
              ))}
            </div>
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
                    <td className="py-2 pr-3">
                      <div className="flex items-center gap-2">
                        <span>{item.descricao}</span>
                        {item.forma_pagamento_nome && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
                            item.forma_pagamento_cartao
                              ? 'bg-purple-50 text-purple-700 border-purple-200'
                              : 'bg-slate-50 text-slate-600 border-slate-200'
                          }`}>
                            {item.forma_pagamento_nome}
                          </span>
                        )}
                      </div>
                    </td>
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

        {editingId ? null : <footer className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
          <div className="flex flex-wrap items-center gap-3 text-[var(--color-muted)]">
            <span>
              Página {paginaAtual} de {totalPaginas}
              {listagem?.total_items !== undefined ? ` (${listagem.total_items} transações)` : ''}
            </span>
            <div className="flex items-center gap-1.5 text-xs">
              <span>Por página:</span>
              <select
                value={perPage}
                onChange={(e) => {
                  setPerPage(Number(e.target.value))
                  setPage(1)
                }}
                className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-xs text-[var(--color-text)] focus:outline-none"
              >
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>
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

      {/* Drawer Lateral de Fatura Consolidada */}
      <FaturaDrawer
        isOpen={faturaDrawerOpen}
        fatura={faturaSelecionada}
        onClose={() => setFaturaDrawerOpen(false)}
        onEditarTransacao={(t) => {
          setFaturaDrawerOpen(false)
          iniciarEdicao(t)
        }}
        onExcluirTransacao={async (id) => {
          await handleDelete(id)
          await carregarCartaoCredito()
        }}
        onQuitarFatura={(fatura, status) => handleQuitarFatura(fatura, status)}
        onExcluirLote={(ids) => handleExcluirLoteFatura(ids)}
      />

      {/* Modal para Sincronização de Cartão de Crédito via Open Finance */}
      <SincronizarCartaoModal
        isOpen={syncCartaoModalOpen}
        onClose={() => setSyncCartaoModalOpen(false)}
        onSuccess={handleSyncCartaoSuccess}
        token={token}
        mesFiltroIso={mesFiltro}
      />

      {token ? (
        <>
          <ConfirmarRetroativoModal
        open={retroativoModalOpen}
        estabelecimento={retroativoDados.estabelecimento}
        categoriaNome={retroativoDados.categoriaNome}
        quantidade={retroativoDados.quantidade}
        amostraItens={retroativoDados.itens}
        onCancel={() => {
          setRetroativoModalOpen(false)
          setSaving(false)
        }}
        onConfirm={async (alterarAnteriores) => {
          if (!token || !retroativoDados.transacaoId || !retroativoDados.pendingPayload) return
          setRetroativoModalOpen(false)
          setSaving(true)
          try {
            const res = await transacoesService.update(token, retroativoDados.transacaoId, {
              ...retroativoDados.pendingPayload,
              alterar_meses_anteriores: alterarAnteriores,
            })
            if (alterarAnteriores && res.anteriores_atualizadas) {
              setFeedbackSync(
                `Categoria atualizada nesta transa??o e em mais ${res.anteriores_atualizadas} dos meses anteriores!`
              )
              setTimeout(() => setFeedbackSync(null), 5000)
            }
            resetForm()
            setIsFormOpen(false)
            await Promise.all([carregarListagem(page), carregarCartaoCredito()])
          } catch (err) {
            setError(getErrorMessage(err, 'Erro ao atualizar categoria.'))
          } finally {
            setSaving(false)
          }
        }}
      />

      <CopiarMesModal
          isOpen={copiarMesModalOpen}
          onClose={() => setCopiarMesModalOpen(false)}
          token={token}
          mesOrigemIso={mesFiltro}
          onCopied={(mesDestIso, irParaDestino) => {
            if (irParaDestino && mesDestIso) {
              const [y, m] = mesDestIso.split('-').map(Number)
              if (y && m) {
                const range = getMonthRange(y, m)
                setInicio(range.firstDay)
                setFim(range.lastDay)
                setMesFiltro(range.isoMonth)
                setPage(1)
              }
            } else {
              void carregarListagem(page)
            }
          }}
        />
        </>
      ) : null}
    </section>
  )
}

function getTipoClassName(tipo: Categoria['tipo']) {
  if (tipo === 'Receita') return 'text-emerald-600'
  if (tipo === 'Despesa') return 'text-rose-600'
  return 'text-[var(--color-text)]'
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

function ResumoCard({
  label,
  valor,
  tone,
  subContent,
}: {
  label: string
  valor: number
  tone: string
  subContent?: React.ReactNode
}) {
  return (
    <article className="flex flex-col justify-between rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-2xs">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">{label}</p>
        <p className={`mt-2 text-xl font-semibold ${tone}`}>{formatCurrency(valor)}</p>
      </div>
      {subContent}
    </article>
  )
}
