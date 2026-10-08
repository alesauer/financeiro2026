import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/app/providers/AuthProvider'
import { lembretesService } from '@/features/lembretes/services/lembretesService'
import type {
  Lembrete,
  LembreteDashboard,
  LembretePayload,
  LembretePrioridade,
  LembreteStatus,
} from '@/shared/types/lembrete'
import { getErrorMessage } from '@/shared/utils/error'

import { LembretesKpis } from '../components/LembretesKpis'
import { LembreteQuickAdd } from '../components/LembreteQuickAdd'
import { LembretesListGrouped } from '../components/LembretesListGrouped'
import { LembretesKanban } from '../components/LembretesKanban'
import { LembreteModal } from '../components/LembreteModal'
import {
  CATEGORIAS_FINANCEIRAS,
  type LembreteTemplate,
} from '../utils/lembretesConfig'

import {
  Plus,
  ListFilter,
  Columns3,
  Search,
  Filter,
} from 'lucide-react'

type ViewMode = 'lista' | 'kanban'

export function LembretesPage() {
  const { token } = useAuth()

  const [viewMode, setViewMode] = useState<ViewMode>('lista')
  const [dashboard, setDashboard] = useState<LembreteDashboard | null>(null)
  const [items, setItems] = useState<Lembrete[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Filtros
  const [statusFiltro, setStatusFiltro] = useState<LembreteStatus | ''>('')
  const [prioridadeFiltro, setPrioridadeFiltro] = useState<LembretePrioridade | ''>('')
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('')
  const [busca, setBusca] = useState('')

  // Modal de Criação / Edição
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<Lembrete | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<LembreteTemplate | null>(null)

  // Carregar dados
  const carregar = async () => {
    if (!token) return
    setLoading(true)
    setError(null)

    try {
      const [dash, lista] = await Promise.all([
        lembretesService.dashboard(token),
        lembretesService.list(token, {
          page: 1,
          per_page: 100,
          status: statusFiltro,
          prioridade: prioridadeFiltro,
          busca,
        }),
      ])

      setDashboard(dash)
      setItems(lista.items)
    } catch (err) {
      setError(getErrorMessage(err, 'Não foi possível carregar lembretes.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregar()
  }, [token, statusFiltro, prioridadeFiltro, busca])

  // Filtragem local adicional de categoria se selecionada
  const filteredItems = useMemo(() => {
    if (!categoriaFiltro) return items
    return items.filter(
      (item) => (item.categoria || '').toLowerCase() === categoriaFiltro.toLowerCase()
    )
  }, [items, categoriaFiltro])

  // Cálculo de atrasados em tempo real
  const qtdAtrasados = useMemo(() => {
    const hojeStr = new Date().toISOString().slice(0, 10)
    return items.filter(
      (i) => i.status === 'Pendente' && i.data_lembrete && i.data_lembrete < hojeStr
    ).length
  }, [items])

  // Ações CRUD
  const handleOpenNewModal = () => {
    setEditingItem(null)
    setSelectedTemplate(null)
    setIsModalOpen(true)
  }

  const handleOpenEditModal = (item: Lembrete) => {
    setEditingItem(item)
    setSelectedTemplate(null)
    setIsModalOpen(true)
  }

  const handleApplyTemplateFromList = (tpl: LembreteTemplate) => {
    setEditingItem(null)
    setSelectedTemplate(tpl)
    setIsModalOpen(true)
  }

  const handleSave = async (payload: LembretePayload, id?: number) => {
    if (!token) return
    if (id) {
      await lembretesService.update(token, id, payload)
    } else {
      await lembretesService.create(token, payload)
    }
    await carregar()
  }

  const handleToggleStatus = async (item: Lembrete) => {
    if (!token) return
    const novoStatus: LembreteStatus = item.status === 'Concluído' ? 'Pendente' : 'Concluído'
    try {
      await lembretesService.patchStatus(token, item.id, novoStatus)
      await carregar()
    } catch (err) {
      setError(getErrorMessage(err, 'Não foi possível atualizar status.'))
    }
  }

  const handleExcluir = async (id: number) => {
    if (!token) return
    if (!window.confirm('Confirma a exclusão deste lembrete?')) return

    try {
      await lembretesService.remove(token, id)
      await carregar()
    } catch (err) {
      setError(getErrorMessage(err, 'Não foi possível excluir lembrete.'))
    }
  }

  const handleAdiar = async (item: Lembrete, dias: number) => {
    if (!token) return
    const baseDate = item.data_lembrete ? new Date(item.data_lembrete + 'T00:00:00') : new Date()
    baseDate.setDate(baseDate.getDate() + dias)
    const novaData = baseDate.toISOString().slice(0, 10)

    try {
      await lembretesService.update(token, item.id, {
        data_lembrete: novaData,
      })
      await carregar()
    } catch (err) {
      setError(getErrorMessage(err, 'Erro ao adiar lembrete.'))
    }
  }

  return (
    <section className="space-y-6 pb-12">
      {/* 1. Header com Título e Ações */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight text-[var(--color-text)]">
              Lembretes & Compromissos
            </h2>
            <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-0.5 text-xs font-semibold text-[var(--color-text)] shadow-2xs">
              {dashboard?.pendentes ?? 0} pendentes
            </span>
            {qtdAtrasados > 0 && (
              <span className="rounded-full bg-rose-500 px-2 py-0.5 text-xs font-bold text-white shadow-2xs">
                {qtdAtrasados} atrasado(s)
              </span>
            )}
          </div>
          <p className="text-xs text-[var(--color-muted)] mt-1">
            Acompanhe vencimentos de faturas, boletos, impostos, investimentos e renovações.
          </p>
        </div>

        {/* Botão de Criação */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleOpenNewModal}
            className="flex items-center gap-1.5 rounded-[var(--radius-sm)] bg-[var(--color-primary)] px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            Novo Lembrete
          </button>
        </div>
      </header>

      {error && (
        <div className="rounded-[var(--radius-sm)] bg-rose-50 p-3 text-xs font-medium text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
          {error}
        </div>
      )}

      {/* 2. KPIs de Visão Geral */}
      <LembretesKpis
        dashboard={dashboard}
        qtdAtrasados={qtdAtrasados}
        loading={loading}
      />

      {/* 3. Quick-Add Bar (Estilo Todoist / Linear) */}
      <LembreteQuickAdd onCriar={async (payload) => handleSave(payload)} />

      {/* 4. Toolbar de Modos de Exibição & Filtros */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-[var(--color-border)] pb-3">
        {/* Alternador de Visualização (Lista vs Kanban) */}
        <div className="flex rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] p-0.5 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setViewMode('lista')}
            className={`flex items-center gap-1.5 rounded px-3 py-1.5 transition ${
              viewMode === 'lista'
                ? 'bg-[var(--color-surface)] text-[var(--color-text)] shadow-xs'
                : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            <ListFilter className="h-3.5 w-3.5" />
            Lista Inteligente
          </button>

          <button
            type="button"
            onClick={() => setViewMode('kanban')}
            className={`flex items-center gap-1.5 rounded px-3 py-1.5 transition ${
              viewMode === 'kanban'
                ? 'bg-[var(--color-surface)] text-[var(--color-text)] shadow-xs'
                : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            <Columns3 className="h-3.5 w-3.5" />
            Quadro Kanban
          </button>
        </div>

        {/* Filtros de Categoria, Prioridade, Status e Busca */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Categoria */}
          <select
            value={categoriaFiltro}
            onChange={(e) => setCategoriaFiltro(e.target.value)}
            className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-xs text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-hidden"
          >
            <option value="">Todas categorias</option>
            {Object.keys(CATEGORIAS_FINANCEIRAS).map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          {/* Prioridade */}
          <select
            value={prioridadeFiltro}
            onChange={(e) => setPrioridadeFiltro(e.target.value as LembretePrioridade | '')}
            className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-xs text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-hidden"
          >
            <option value="">Todas prioridades</option>
            <option value="Alta">Alta</option>
            <option value="Média">Média</option>
            <option value="Baixa">Baixa</option>
          </select>

          {/* Status */}
          <select
            value={statusFiltro}
            onChange={(e) => setStatusFiltro(e.target.value as LembreteStatus | '')}
            className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-xs text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-hidden"
          >
            <option value="">Todos status</option>
            <option value="Pendente">Pendentes</option>
            <option value="Concluído">Concluídos</option>
          </select>

          {/* Busca */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-[var(--color-muted)]" />
            <input
              type="text"
              placeholder="Buscar título..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-36 sm:w-44 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] py-1.5 pl-8 pr-2.5 text-xs text-[var(--color-text)] placeholder:text-[var(--color-muted)] focus:border-[var(--color-primary)] focus:outline-hidden"
            />
          </div>

          {/* Limpar Filtros se algum estiver ativo */}
          {(statusFiltro || prioridadeFiltro || categoriaFiltro || busca) && (
            <button
              type="button"
              onClick={() => {
                setStatusFiltro('')
                setPrioridadeFiltro('')
                setCategoriaFiltro('')
                setBusca('')
              }}
              className="flex items-center gap-1 rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-[11px] font-medium text-[var(--color-muted)] hover:text-[var(--color-text)]"
            >
              <Filter className="h-3 w-3" />
              Limpar
            </button>
          )}
        </div>
      </div>

      {/* 5. Conteúdo Principal (Lista Agrupada ou Kanban) */}
      <div className="animate-in fade-in duration-150">
        {viewMode === 'lista' ? (
          <LembretesListGrouped
            items={filteredItems}
            loading={loading}
            onToggleStatus={handleToggleStatus}
            onEditar={handleOpenEditModal}
            onExcluir={handleExcluir}
            onAdiar={handleAdiar}
            onUsarTemplate={handleApplyTemplateFromList}
          />
        ) : (
          <LembretesKanban
            items={filteredItems}
            onToggleStatus={handleToggleStatus}
            onEditar={handleOpenEditModal}
            onExcluir={handleExcluir}
            onAdiar={handleAdiar}
          />
        )}
      </div>

      {/* 6. Modal de Lembrete */}
      <LembreteModal
        isOpen={isModalOpen}
        editingItem={editingItem}
        initialTemplate={selectedTemplate}
        onClose={() => {
          setIsModalOpen(false)
          setEditingItem(null)
          setSelectedTemplate(null)
        }}
        onSave={handleSave}
      />
    </section>
  )
}
