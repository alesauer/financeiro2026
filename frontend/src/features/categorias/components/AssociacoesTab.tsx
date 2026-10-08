import { useState, useEffect, useMemo } from 'react'
import type { FormEvent } from 'react'
import {
  Sparkles,
  Search,
  Plus,
  Edit2,
  Trash2,
  Zap,
  Tag,
  CheckCircle2,
  RefreshCw,
  X,
  Store,
  ShoppingCart,
  Fuel,
  Car,
  Wrench,
  Pill,
  HeartPulse,
  Tv,
  Dog,
  Croissant,
  Utensils,
  GraduationCap,
  Plane,
  Home,
  ShoppingBag,
  Scissors,
  Receipt,
  Percent,
  ArrowLeftRight,
  ShieldAlert,
} from 'lucide-react'

import { useAuth } from '@/app/providers/AuthProvider'
import { categoriasService } from '@/features/categorias/services/categoriasService'
import type {
  Categoria,
  RegraSistemaItem,
  CategoriaAliasItem,
  TestarAssociacaoResultado,
} from '@/shared/types/categoria'
import { getErrorMessage } from '@/shared/utils/error'

interface AssociacoesTabProps {
  categorias: Categoria[]
}

const ICONES_MAP: Record<string, any> = {
  ShoppingCart,
  Fuel,
  Wrench,
  Car,
  Pill,
  HeartPulse,
  Tv,
  ShieldAlert,
  Dog,
  Store,
  Croissant,
  Utensils,
  GraduationCap,
  Plane,
  Sparkles,
  Home,
  ShoppingBag,
  Scissors,
  Receipt,
  Percent,
  ArrowLeftRight,
}

export function AssociacoesTab({ categorias }: AssociacoesTabProps) {
  const { token } = useAuth()
  const [regrasSistema, setRegrasSistema] = useState<RegraSistemaItem[]>([])
  const [aliases, setAliases] = useState<CategoriaAliasItem[]>([])
  const [totais, setTotais] = useState<{
    total_regras_sistema: number
    total_aliases_aprendidos: number
    total_estabelecimentos_mapeados: number
  }>({
    total_regras_sistema: 0,
    total_aliases_aprendidos: 0,
    total_estabelecimentos_mapeados: 0,
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState<string | null>(null)

  // Filtros
  const [busca, setBusca] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [subAba, setSubAba] = useState<'todas' | 'sistema' | 'aliases'>('todas')

  // Testador / Simulador
  const [textoTeste, setTextoTeste] = useState('')
  const [testando, setTestando] = useState(false)
  const [resultadoTeste, setResultadoTeste] = useState<TestarAssociacaoResultado | null>(null)

  // Modal Novo/Editar Alias
  const [modalOpen, setModalOpen] = useState(false)
  const [editingAlias, setEditingAlias] = useState<CategoriaAliasItem | null>(null)
  const [aliasForm, setAliasForm] = useState({
    descricao: '',
    categoria_id: 0,
  })
  const [savingAlias, setSavingAlias] = useState(false)

  const carregarDados = async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const data = await categoriasService.getAssociacoes(token)
      setRegrasSistema(data.regras_sistema || [])
      setAliases(data.aliases || [])
      setTotais(data.totais || {
        total_regras_sistema: 0,
        total_aliases_aprendidos: 0,
        total_estabelecimentos_mapeados: 0,
      })
    } catch (err) {
      setError(getErrorMessage(err, 'Não foi possível carregar as associações de categorias.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarDados()
  }, [token])

  // Executar teste em tempo real
  const handleTestar = async (texto?: string) => {
    const termo = (texto ?? textoTeste).trim()
    if (!termo || !token) return
    setTestando(true)
    setResultadoTeste(null)
    try {
      const res = await categoriasService.testarAssociacao(token, termo)
      setResultadoTeste(res)
    } catch (err) {
      setError(getErrorMessage(err, 'Erro ao testar classificação.'))
    } finally {
      setTestando(false)
    }
  }

  const handleTestarExemplo = (exemplo: string) => {
    setTextoTeste(exemplo)
    handleTestar(exemplo)
  }

  // Abrir Modal para criar novo alias
  const handleNovoAlias = () => {
    setEditingAlias(null)
    setAliasForm({
      descricao: '',
      categoria_id: categorias[0]?.id || 0,
    })
    setModalOpen(true)
  }

  // Abrir Modal para editar alias
  const handleEditarAlias = (item: CategoriaAliasItem) => {
    setEditingAlias(item)
    setAliasForm({
      descricao: item.descricao_exemplo,
      categoria_id: item.categoria_id,
    })
    setModalOpen(true)
  }

  // Salvar Alias (Criar ou Atualizar)
  const handleSalvarAlias = async (e: FormEvent) => {
    e.preventDefault()
    if (!token) return
    if (!aliasForm.descricao.trim()) {
      setError('Informe a descrição ou nome do estabelecimento.')
      return
    }
    if (!aliasForm.categoria_id) {
      setError('Selecione uma categoria válida.')
      return
    }

    setSavingAlias(true)
    setError(null)
    try {
      if (editingAlias) {
        await categoriasService.atualizarAlias(token, editingAlias.id, {
          categoria_id: aliasForm.categoria_id,
          descricao_exemplo: aliasForm.descricao.trim(),
        })
        setSucesso('Associação atualizada com sucesso!')
      } else {
        await categoriasService.salvarAlias(token, {
          descricao: aliasForm.descricao.trim(),
          categoria_id: aliasForm.categoria_id,
        })
        setSucesso('Nova associação cadastrada com sucesso!')
      }
      setModalOpen(false)
      await carregarDados()
      setTimeout(() => setSucesso(null), 4000)
    } catch (err) {
      setError(getErrorMessage(err, 'Erro ao salvar associação.'))
    } finally {
      setSavingAlias(false)
    }
  }

  // Excluir Alias
  const handleExcluirAlias = async (id: number) => {
    if (!token) return
    if (!window.confirm('Deseja realmente remover esta associação personalizada?')) return

    try {
      await categoriasService.removerAlias(token, id)
      setSucesso('Associação removida com sucesso.')
      await carregarDados()
      setTimeout(() => setSucesso(null), 3000)
    } catch (err) {
      setError(getErrorMessage(err, 'Erro ao excluir associação.'))
    }
  }

  // Filtros aplicados sobre regras do sistema
  const regrasFiltradas = useMemo(() => {
    const termo = busca.toLowerCase().trim()
    return regrasSistema.filter((r) => {
      const matchCat = !filtroCategoria || r.categoria.toLowerCase() === filtroCategoria.toLowerCase()
      if (!matchCat) return false
      if (!termo) return true
      const matchNome = r.categoria.toLowerCase().includes(termo)
      const matchDesc = r.descricao.toLowerCase().includes(termo)
      const matchEx = r.exemplos.some((ex) => ex.toLowerCase().includes(termo))
      return matchNome || matchDesc || matchEx
    })
  }, [regrasSistema, busca, filtroCategoria])

  // Filtros aplicados sobre aliases do banco
  const aliasesFiltrados = useMemo(() => {
    const termo = busca.toLowerCase().trim()
    return aliases.filter((a) => {
      const matchCat = !filtroCategoria || a.categoria_nome.toLowerCase() === filtroCategoria.toLowerCase()
      if (!matchCat) return false
      if (!termo) return true
      const matchDesc = a.descricao_exemplo.toLowerCase().includes(termo)
      const matchNorm = a.descricao_normalizada.toLowerCase().includes(termo)
      const matchNomeCat = a.categoria_nome.toLowerCase().includes(termo)
      return matchDesc || matchNorm || matchNomeCat
    })
  }, [aliases, busca, filtroCategoria])

  const renderIcone = (nomeIcone?: string) => {
    const IconeComponente = nomeIcone ? ICONES_MAP[nomeIcone] || Tag : Tag
    return <IconeComponente className="h-5 w-5" />
  }

  return (
    <div className="space-y-6">
      {/* Alertas de Sucesso / Erro */}
      {sucesso ? (
        <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm font-medium text-emerald-600 dark:text-emerald-400 animate-in fade-in duration-200">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <span>{sucesso}</span>
        </div>
      ) : null}

      {error ? (
        <div className="flex items-center justify-between rounded-[var(--radius-md)] border border-rose-500/30 bg-rose-500/10 p-4 text-sm font-medium text-rose-600 dark:text-rose-400 animate-in fade-in duration-200">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="opacity-70 hover:opacity-100">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {/* Cards de Métricas e Status do Mapeamento Inteligente */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm transition hover:shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              Mapeamentos Ativos
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <Sparkles className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold text-[var(--color-text)]">
            {totais.total_estabelecimentos_mapeados}
          </p>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            Estabelecimentos e lojas reconhecidos
          </p>
        </div>

        <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm transition hover:shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              Regras do Sistema
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Zap className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold text-[var(--color-text)]">
            {totais.total_regras_sistema}
          </p>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            Categorias com padrões determinísticos
          </p>
        </div>

        <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm transition hover:shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              Aliases Aprendidos
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Store className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold text-[var(--color-text)]">
            {totais.total_aliases_aprendidos}
          </p>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            Mapeamentos por histórico e usuário
          </p>
        </div>

        <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm transition hover:shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              Acurácia da Fatura
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            100%
          </p>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            Classificação instantânea sem Outros
          </p>
        </div>
      </div>

      {/* Simulador Interativo de Categorização em Tempo Real */}
      <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-gradient-to-br from-[var(--color-surface)] to-[var(--color-bg)]/60 p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
            <Zap className="h-4 w-4" />
          </div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-text)]">
            Simulador de Associação em Tempo Real
          </h3>
        </div>
        <p className="mt-1 text-xs text-[var(--color-muted)]">
          Digite qualquer nome ou texto presente na fatura do seu cartão para ver qual categoria o motor inteligente seleciona automaticamente.
        </p>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <input
              type="text"
              value={textoTeste}
              onChange={(e) => setTextoTeste(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleTestar()
              }}
              placeholder="Ex.: SHOPEE *LJCOMERCIALIMP, Ifd*Varanda 1389, Drogaria Araujo, Netflix, Uberrides..."
              className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2.5 text-sm outline-none ring-[var(--color-primary)]/30 transition focus:border-[var(--color-primary)] focus:ring-4"
            />
            {textoTeste ? (
              <button
                type="button"
                onClick={() => {
                  setTextoTeste('')
                  setResultadoTeste(null)
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)] hover:text-[var(--color-text)]"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => handleTestar()}
            disabled={testando || !textoTeste.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-[var(--radius-sm)] bg-[var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-50"
          >
            {testando ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            <span>Testar Associação</span>
          </button>
        </div>

        {/* Painel com resultado do teste */}
        {resultadoTeste ? (
          <div className="mt-4 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] pb-3">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                  Categoria Identificada
                </span>
                <div className="mt-1 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-sm font-bold text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 className="h-4 w-4" />
                    {resultadoTeste.categoria}
                  </span>
                  <span className="rounded-full bg-[var(--color-border)]/60 px-2.5 py-0.5 text-xs font-medium text-[var(--color-muted)]">
                    Confiança: {Math.round(resultadoTeste.confianca * 100)}%
                  </span>
                </div>
              </div>

              <div className="text-right">
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                  Método
                </span>
                <p className="mt-1 text-xs font-semibold uppercase text-indigo-600 dark:text-indigo-400">
                  {resultadoTeste.metodo === 'regra'
                    ? '⚡ Regra Determinística'
                    : resultadoTeste.metodo === 'alias'
                    ? '🧠 Alias Confirmado'
                    : resultadoTeste.metodo === 'historico'
                    ? '📚 Histórico de Transações'
                    : resultadoTeste.metodo === 'fuzzy'
                    ? '🔍 Similaridade Fuzzy'
                    : resultadoTeste.metodo}
                </p>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
              <div>
                <span className="font-semibold text-[var(--color-muted)]">Descrição Normalizada: </span>
                <code className="rounded bg-[var(--color-border)]/40 px-1.5 py-0.5 font-mono text-[var(--color-text)]">
                  {resultadoTeste.descricao_normalizada || 'N/A'}
                </code>
              </div>
              <div>
                <span className="font-semibold text-[var(--color-muted)]">Motivo: </span>
                <span className="text-[var(--color-text)]">{resultadoTeste.motivo}</span>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Barra de Busca, Filtros e Ações */}
      <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          {/* Sub-abas de visualização */}
          <div className="flex items-center rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]/50 p-1">
            <button
              type="button"
              onClick={() => setSubAba('todas')}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                subAba === 'todas'
                  ? 'bg-[var(--color-surface)] text-[var(--color-text)] shadow-sm'
                  : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
              }`}
            >
              Todas as Associações
            </button>
            <button
              type="button"
              onClick={() => setSubAba('sistema')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                subAba === 'sistema'
                  ? 'bg-[var(--color-surface)] text-[var(--color-text)] shadow-sm'
                  : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
              }`}
            >
              <Zap className="h-3.5 w-3.5 text-amber-500" />
              <span>Regras do Sistema ({regrasSistema.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setSubAba('aliases')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                subAba === 'aliases'
                  ? 'bg-[var(--color-surface)] text-[var(--color-text)] shadow-sm'
                  : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
              }`}
            >
              <Store className="h-3.5 w-3.5 text-emerald-500" />
              <span>Aliases Salvos ({aliases.length})</span>
            </button>
          </div>

          {/* Filtros e Busca */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1 sm:flex-initial">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-muted)]" />
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Filtrar lojas ou regras..."
                className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] py-1.5 pl-9 pr-3 text-sm outline-none transition focus:border-[var(--color-primary)]"
              />
            </div>

            <select
              value={filtroCategoria}
              onChange={(e) => setFiltroCategoria(e.target.value)}
              className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm"
            >
              <option value="">Todas as categorias</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.nome}>
                  {c.nome} ({c.tipo})
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={handleNovoAlias}
              className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] bg-[var(--color-primary)] px-3 py-1.5 text-sm font-semibold text-white transition hover:opacity-90"
            >
              <Plus className="h-4 w-4" />
              <span>Nova Associação</span>
            </button>
          </div>
        </div>

        {/* SEÇÃO 1: REGRAS DETERMINÍSTICAS DO SISTEMA */}
        {subAba === 'todas' || subAba === 'sistema' ? (
          <div className="mt-6">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                <Zap className="h-4 w-4 text-amber-500" />
                <span>Padrões Determinísticos do Sistema ({regrasFiltradas.length})</span>
              </h4>
              <span className="text-xs text-[var(--color-muted)]">
                Regras nativas de alta prioridade e acurácia instantânea
              </span>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-10 text-[var(--color-muted)]">
                <RefreshCw className="mr-2 h-5 w-5 animate-spin" /> Carregando regras...
              </div>
            ) : regrasFiltradas.length === 0 ? (
              <p className="py-6 text-center text-sm text-[var(--color-muted)]">
                Nenhuma regra do sistema encontrada para os filtros selecionados.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {regrasFiltradas.map((regra) => (
                  <div
                    key={regra.id}
                    className="flex flex-col justify-between rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm transition hover:border-[var(--color-primary)]/50 hover:shadow"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 border-b border-[var(--color-border)]/60 pb-2.5">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                            {renderIcone(regra.icone)}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-[var(--color-text)]">
                              {regra.categoria}
                            </p>
                            <p className="text-[11px] text-[var(--color-muted)]">
                              {regra.categoria_tipo} • Confiança {Math.round(regra.confianca * 100)}%
                            </p>
                          </div>
                        </div>
                        <span className="rounded bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-600 dark:text-amber-400">
                          Sistema
                        </span>
                      </div>

                      <p className="mt-2.5 text-xs text-[var(--color-muted)] line-clamp-2">
                        {regra.descricao}
                      </p>

                      <div className="mt-3">
                        <span className="text-[11px] font-semibold text-[var(--color-muted)]">
                          Estabelecimentos Mapeados:
                        </span>
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {regra.exemplos.map((ex, exIdx) => (
                            <button
                              key={exIdx}
                              type="button"
                              onClick={() => handleTestarExemplo(ex)}
                              title="Clique para testar no simulador"
                              className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-0.5 text-[11px] text-[var(--color-text)] transition hover:border-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 hover:text-[var(--color-primary)]"
                            >
                              {ex}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-2 border-t border-[var(--color-border)]/40 flex items-center justify-between text-[11px] text-[var(--color-muted)]">
                      <span>Prioridade Máxima</span>
                      <button
                        type="button"
                        onClick={() => handleTestarExemplo(regra.exemplos[0] || regra.categoria)}
                        className="font-medium text-[var(--color-primary)] hover:underline"
                      >
                        Testar esta regra →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {/* SEÇÃO 2: ALIASES APRENDIDOS E PERSONALIZADOS */}
        {subAba === 'todas' || subAba === 'aliases' ? (
          <div className="mt-8">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                <Store className="h-4 w-4 text-emerald-500" />
                <span>Aliases e Associações Aprendidas ({aliasesFiltrados.length})</span>
              </h4>
              <span className="text-xs text-[var(--color-muted)]">
                Mapeamentos específicos salvos no banco de dados
              </span>
            </div>

            <div className="overflow-x-auto rounded-[var(--radius-sm)] border border-[var(--color-border)]">
              <table className="min-w-full divide-y divide-[var(--color-border)] text-sm">
                <thead className="bg-[var(--color-bg)]/50 text-left text-xs font-semibold uppercase text-[var(--color-muted)]">
                  <tr>
                    <th className="py-2.5 pl-4 pr-3">Estabelecimento (Exemplo)</th>
                    <th className="py-2.5 pr-3">Padrão Normalizado</th>
                    <th className="py-2.5 pr-3">Categoria Associada</th>
                    <th className="py-2.5 pr-3">Origem</th>
                    <th className="py-2.5 pr-3 text-center">Ocorrências</th>
                    <th className="py-2.5 pr-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]/60 bg-[var(--color-surface)]">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-[var(--color-muted)]">
                        Carregando associações...
                      </td>
                    </tr>
                  ) : aliasesFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-[var(--color-muted)]">
                        Nenhum alias encontrado para os filtros informados.
                      </td>
                    </tr>
                  ) : (
                    aliasesFiltrados.map((item) => (
                      <tr key={item.id} className="transition hover:bg-[var(--color-bg)]/40">
                        <td className="py-2.5 pl-4 pr-3 font-medium text-[var(--color-text)]">
                          {item.descricao_exemplo}
                        </td>
                        <td className="py-2.5 pr-3 font-mono text-xs text-[var(--color-muted)]">
                          {item.descricao_normalizada}
                        </td>
                        <td className="py-2.5 pr-3">
                          <span className="inline-flex items-center rounded-md bg-[var(--color-primary)]/10 px-2 py-0.5 text-xs font-semibold text-[var(--color-primary)]">
                            {item.categoria_nome}
                          </span>
                        </td>
                        <td className="py-2.5 pr-3">
                          <span
                            className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                              item.origem === 'usuario'
                                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                                : item.origem === 'ia'
                                ? 'bg-purple-500/15 text-purple-700 dark:text-purple-400'
                                : 'bg-slate-500/15 text-slate-700 dark:text-slate-400'
                            }`}
                          >
                            {item.origem}
                          </span>
                        </td>
                        <td className="py-2.5 pr-3 text-center text-xs text-[var(--color-muted)]">
                          {item.ocorrencias}
                        </td>
                        <td className="py-2.5 pr-4 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleEditarAlias(item)}
                              title="Editar Categoria"
                              className="rounded p-1 text-[var(--color-muted)] hover:bg-[var(--color-border)] hover:text-[var(--color-text)]"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleExcluirAlias(item.id)}
                              title="Excluir Associação"
                              className="rounded p-1 text-rose-500 hover:bg-rose-500/10"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>

      {/* MODAL NOVO / EDITAR ALIAS */}
      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
              <h3 className="text-base font-semibold text-[var(--color-text)]">
                {editingAlias ? 'Editar Associação' : 'Nova Associação de Estabelecimento'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-[var(--color-muted)] hover:text-[var(--color-text)]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSalvarAlias} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                  Nome do Estabelecimento / Loja
                </label>
                <input
                  type="text"
                  value={aliasForm.descricao}
                  onChange={(e) => setAliasForm((prev) => ({ ...prev, descricao: e.target.value }))}
                  placeholder="Ex.: Padaria São José, Barber Shop, etc."
                  className="mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm outline-none ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] focus:ring-4"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                  Categoria Atribuída
                </label>
                <select
                  value={aliasForm.categoria_id}
                  onChange={(e) => setAliasForm((prev) => ({ ...prev, categoria_id: Number(e.target.value) }))}
                  className="mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm outline-none ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] focus:ring-4"
                  required
                >
                  <option value={0} disabled>
                    Selecione uma categoria...
                  </option>
                  {categorias.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome} ({c.tipo})
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-6 flex items-center justify-end gap-2 border-t border-[var(--color-border)] pt-4">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-bg)]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingAlias}
                  className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                >
                  {savingAlias ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}
                  <span>{editingAlias ? 'Salvar Alterações' : 'Cadastrar Associação'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}
