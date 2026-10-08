import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/app/providers/AuthProvider'
import { milhasService } from '@/features/milhas/services/milhasService'
import type {
  Milha,
  MilhaPayload,
  MilhaTipo,
  MilhasFiltros,
  MilhasResumoResponse,
  TransferenciaPayload,
} from '@/shared/types/milha'
import { getErrorMessage } from '@/shared/utils/error'

import { MilhasKpis } from '../components/MilhasKpis'
import { ProgramasGrid } from '../components/ProgramasGrid'
import { MilhasTable } from '../components/MilhasTable'
import { ExpiracoesView } from '../components/ExpiracoesView'
import { MilhaModalForm } from '../components/MilhaModalForm'
import { TransferenciaModal } from '../components/TransferenciaModal'
import { CpmCalculadoraModal } from '../components/CpmCalculadoraModal'

import {
  Plus,
  ArrowRightLeft,
  Calculator,
  LayoutGrid,
  ListOrdered,
  AlertTriangle,
} from 'lucide-react'

type TabMode = 'visao' | 'extrato' | 'expiracoes'

export function MilhasPage() {
  const { token } = useAuth()

  const [tab, setTab] = useState<TabMode>('visao')
  const [resumo, setResumo] = useState<MilhasResumoResponse | null>(null)
  const [items, setItems] = useState<Milha[]>([])
  const [totalItems, setTotalItems] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [currentPage, setCurrentPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [loadingList, setLoadingList] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Filtros de listagem
  const [filtros, setFiltros] = useState<MilhasFiltros>({
    page: 1,
    per_page: 20,
    sort_by: 'data_movimentacao',
    sort_dir: 'desc',
  })

  // Modais
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false)
  const [isCalcModalOpen, setIsCalcModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<Milha | null>(null)
  const [modalInitialProg, setModalInitialProg] = useState<string | undefined>()
  const [modalInitialTipo, setModalInitialTipo] = useState<MilhaTipo>('entrada')
  const [transferInitialOrigem, setTransferInitialOrigem] = useState<string | undefined>()

  // Carregar resumo consolidado
  const carregarResumo = async () => {
    if (!token) return
    try {
      const data = await milhasService.resumo(token)
      setResumo(data)
    } catch (err) {
      console.error(err)
    }
  }

  // Carregar lista de movimentações
  const carregarListagem = async (novosFiltros = filtros) => {
    if (!token) return
    setLoadingList(true)
    setError(null)
    try {
      const data = await milhasService.list(token, novosFiltros)
      setItems(data.items)
      setTotalItems(data.total_items)
      setTotalPages(data.total_pages)
      setCurrentPage(data.current_page)
    } catch (err) {
      setError(getErrorMessage(err, 'Não foi possível carregar movimentações de milhas.'))
    } finally {
      setLoadingList(false)
    }
  }

  // Carregar dados iniciais
  const carregarTudo = async () => {
    setLoading(true)
    await Promise.all([carregarResumo(), carregarListagem()])
    setLoading(false)
  }

  useEffect(() => {
    carregarTudo()
  }, [token])

  const handleFiltrosChange = (novos: Partial<MilhasFiltros>) => {
    const atualizados = { ...filtros, ...novos }
    setFiltros(atualizados)
    carregarListagem(atualizados)
  }

  const handleSelectProgramaFiltro = (nome: string | null) => {
    handleFiltrosChange({ programa: nome || undefined, page: 1 })
    setTab('extrato')
  }

  // Abertura de Modais
  const abrirNovaMovimentacao = (programa?: string, tipo: MilhaTipo = 'entrada') => {
    setEditingItem(null)
    setModalInitialProg(programa)
    setModalInitialTipo(tipo)
    setIsModalOpen(true)
  }

  const abrirEditarMovimentacao = (item: Milha) => {
    setEditingItem(item)
    setIsModalOpen(true)
  }

  const abrirTransferencia = (programaOrigem?: string) => {
    setTransferInitialOrigem(programaOrigem)
    setIsTransferModalOpen(true)
  }

  // Operações de CRUD
  const handleSaveMovimentacao = async (payload: MilhaPayload, id?: number) => {
    if (!token) return
    if (id) {
      await milhasService.update(token, id, payload)
    } else {
      await milhasService.create(token, payload)
    }
    await Promise.all([carregarResumo(), carregarListagem()])
  }

  const handleTransferencia = async (payload: TransferenciaPayload) => {
    if (!token) return
    await milhasService.transferencia(token, payload)
    await Promise.all([carregarResumo(), carregarListagem()])
  }

  const handleExcluir = async (id: number) => {
    if (!token) return
    if (!window.confirm('Confirma a exclusão desta movimentação?')) return
    try {
      await milhasService.remove(token, id, true)
      await Promise.all([carregarResumo(), carregarListagem()])
    } catch (err) {
      setError(getErrorMessage(err, 'Erro ao excluir movimentação.'))
    }
  }

  const handleExcluirLote = async (ids: number[]) => {
    if (!token) return
    try {
      await milhasService.batchDelete(token, ids)
      await Promise.all([carregarResumo(), carregarListagem()])
    } catch (err) {
      setError(getErrorMessage(err, 'Erro ao excluir movimentações em lote.'))
    }
  }

  const programasNomes = useMemo(() => {
    const list = resumo?.programas.map((p) => p.nome) || []
    return Array.from(new Set(list))
  }, [resumo])

  const qtdExpirandoGeral = (resumo?.expiracoes.proximos_30d.total ?? 0) + (resumo?.expiracoes.proximos_90d.total ?? 0)

  return (
    <section className="space-y-6 pb-12">
      {/* 1. Header com Título e Ações Principais */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight text-[var(--color-text)]">
              Milhas & Fidelidade
            </h2>
            <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-0.5 text-xs font-semibold text-[var(--color-text)] shadow-2xs">
              {resumo?.programas.length ?? 0} programas
            </span>
          </div>
          <p className="text-xs text-[var(--color-muted)] mt-1">
            Acompanhe saldos, cotações em reais, transferências bonificadas e alertas de expiração.
          </p>
        </div>

        {/* Botões de Ação */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsCalcModalOpen(true)}
            className="flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2 text-xs font-semibold text-[var(--color-text)] shadow-xs transition hover:bg-[var(--color-bg)]"
          >
            <Calculator className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            Calculadora CPM
          </button>

          <button
            type="button"
            onClick={() => abrirTransferencia()}
            className="flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2 text-xs font-semibold text-[var(--color-text)] shadow-xs transition hover:bg-[var(--color-bg)]"
          >
            <ArrowRightLeft className="h-4 w-4 text-[var(--color-primary)]" />
            Transferência Bonificada
          </button>

          <button
            type="button"
            onClick={() => abrirNovaMovimentacao()}
            className="flex items-center gap-1.5 rounded-[var(--radius-sm)] bg-[var(--color-primary)] px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            Nova Movimentação
          </button>
        </div>
      </header>

      {error && (
        <div className="rounded-[var(--radius-sm)] bg-rose-50 p-3 text-xs font-medium text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
          {error}
        </div>
      )}

      {/* 2. KPIs de Destaque no Topo */}
      <MilhasKpis resumo={resumo} loading={loading} />

      {/* 3. Navegação por Abas Modernas */}
      <div className="flex border-b border-[var(--color-border)]">
        <button
          type="button"
          onClick={() => setTab('visao')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition ${
            tab === 'visao'
              ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
              : 'border-transparent text-[var(--color-muted)] hover:text-[var(--color-text)]'
          }`}
        >
          <LayoutGrid className="h-4 w-4" />
          Visão Geral & Programas
        </button>

        <button
          type="button"
          onClick={() => setTab('extrato')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition ${
            tab === 'extrato'
              ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
              : 'border-transparent text-[var(--color-muted)] hover:text-[var(--color-text)]'
          }`}
        >
          <ListOrdered className="h-4 w-4" />
          Extrato Detalhado
          {totalItems > 0 && (
            <span className="rounded-full bg-[var(--color-bg)] px-1.5 py-0.2 text-[10px] text-[var(--color-muted)]">
              {totalItems}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setTab('expiracoes')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition ${
            tab === 'expiracoes'
              ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
              : 'border-transparent text-[var(--color-muted)] hover:text-[var(--color-text)]'
          }`}
        >
          <AlertTriangle className="h-4 w-4" />
          Alertas de Expiração
          {qtdExpirandoGeral > 0 && (
            <span className="rounded-full bg-rose-500 px-1.5 py-0.2 text-[10px] font-bold text-white">
              {qtdExpirandoGeral.toLocaleString('pt-BR')}
            </span>
          )}
        </button>
      </div>

      {/* 4. Conteúdo das Abas */}
      {tab === 'visao' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          <ProgramasGrid
            programas={resumo?.programas || []}
            saldoTotal={resumo?.saldo_total_milhas || 0}
            programaSelecionado={filtros.programa || null}
            onSelectPrograma={handleSelectProgramaFiltro}
            onNovaMovimentacao={abrirNovaMovimentacao}
            onTransferir={abrirTransferencia}
          />
        </div>
      )}

      {tab === 'extrato' && (
        <div className="animate-in fade-in duration-150">
          <MilhasTable
            items={items}
            totalItems={totalItems}
            currentPage={currentPage}
            totalPages={totalPages}
            loading={loadingList}
            filtros={filtros}
            programasDisponiveis={programasNomes}
            onFiltrosChange={handleFiltrosChange}
            onEditar={abrirEditarMovimentacao}
            onExcluir={handleExcluir}
            onExcluirLote={handleExcluirLote}
          />
        </div>
      )}

      {tab === 'expiracoes' && (
        <div className="animate-in fade-in duration-150">
          <ExpiracoesView
            resumo={resumo}
            onTransferir={(prog) => abrirTransferencia(prog)}
          />
        </div>
      )}

      {/* 5. Modais Globais */}
      <MilhaModalForm
        isOpen={isModalOpen}
        editingItem={editingItem}
        initialPrograma={modalInitialProg}
        initialTipo={modalInitialTipo}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveMovimentacao}
      />

      <TransferenciaModal
        isOpen={isTransferModalOpen}
        programasDisponiveis={resumo?.programas || []}
        initialOrigem={transferInitialOrigem}
        onClose={() => setIsTransferModalOpen(false)}
        onTransferir={handleTransferencia}
      />

      <CpmCalculadoraModal
        isOpen={isCalcModalOpen}
        onClose={() => setIsCalcModalOpen(false)}
      />
    </section>
  )
}
