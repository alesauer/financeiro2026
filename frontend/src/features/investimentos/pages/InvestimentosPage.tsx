import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  RefreshCw,
  Plus,
  Wallet,
  PieChart,
  ShieldCheck,
  TrendingUp,
  History,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'

import { useAuth } from '@/app/providers/AuthProvider'
import { investimentosService } from '@/features/investimentos/services/investimentosService'
import type {
  InvestmentAsset,
  InvestmentAssetPayload,
  InvestmentDashboard,
  InvestmentDashboardAsset,
  InvestmentTransaction,
  InvestmentTransactionPayload,
  InvestmentWallet,
  InvestmentWalletPayload,
} from '@/shared/types/investimento'
import { getErrorMessage } from '@/shared/utils/error'

// Subcomponentes
import { InvestimentosKpiCards } from '../components/InvestimentosKpiCards'
import { VisaoGeralTab } from '../components/VisaoGeralTab'
import { RendaVariavelTab } from '../components/RendaVariavelTab'
import { RendaFixaTab } from '../components/RendaFixaTab'
import { ExtratoOperacoesTab } from '../components/ExtratoOperacoesTab'
import { OperacaoModal } from '../components/OperacaoModal'
import { NovoAtivoModal } from '../components/NovoAtivoModal'
import { CarteirasModal } from '../components/CarteirasModal'

type TabType = 'visao-geral' | 'renda-fixa' | 'renda-variavel' | 'operacoes'

export function InvestimentosPage() {
  const { token } = useAuth()
  const navigate = useNavigate()

  // Estados principais
  const [wallets, setWallets] = useState<InvestmentWallet[]>([])
  const [assets, setAssets] = useState<InvestmentAsset[]>([])
  const [txs, setTxs] = useState<InvestmentTransaction[]>([])
  const [dash, setDash] = useState<InvestmentDashboard | null>(null)
  const [selWid, setSelWid] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<TabType>('visao-geral')

  // Feedback e loading
  const [loading, setLoading] = useState<boolean>(false)
  const [refreshingQuotes, setRefreshingQuotes] = useState<boolean>(false)
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)

  // Modais
  const [modalOperacaoOpen, setModalOperacaoOpen] = useState<boolean>(false)
  const [modalNovoAtivoOpen, setModalNovoAtivoOpen] = useState<boolean>(false)
  const [modalCarteirasOpen, setModalCarteirasOpen] = useState<boolean>(false)

  // Estados de edição para modais
  const [selectedAssetForOperacao, setSelectedAssetForOperacao] = useState<InvestmentDashboardAsset | null>(null)
  const [txToEdit, setTxToEdit] = useState<InvestmentTransaction | null>(null)
  const [assetToEdit, setAssetToEdit] = useState<InvestmentAsset | null>(null)
  const [defaultAssetType, setDefaultAssetType] = useState<string>('Ações')

  const reqRef = useRef<number>(0)

  const notify = useCallback((msg: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }, [])

  // Carregar dados consolidada
  const load = useCallback(
    async (wid: number | null) => {
      if (!token) return
      const seq = ++reqRef.current
      setLoading(true)
      try {
        const [ws, as, ts, ds] = await Promise.all([
          investimentosService.listWallets(token),
          investimentosService.listAssets(token, wid ?? undefined),
          investimentosService.listTransactions(token, wid ?? undefined),
          investimentosService.dashboard(token, wid ?? undefined),
        ])
        if (seq !== reqRef.current) return
        setWallets(ws)
        setAssets(as)
        setTxs(ts)
        setDash(ds)
      } catch (e) {
        notify(getErrorMessage(e, 'Erro ao carregar dados de investimentos.'), 'err')
      } finally {
        setLoading(false)
      }
    },
    [token, notify]
  )

  useEffect(() => {
    load(null)
  }, [token]) // eslint-disable-line react-hooks/exhaustive-deps

  const handlePickWallet = (wid: number | null) => {
    setSelWid(wid)
    load(wid)
  }

  // Atualizar cotações online
  const handleRefreshQuotes = async () => {
    if (!token) return
    setRefreshingQuotes(true)
    try {
      const r = await investimentosService.refreshQuotes(token, selWid ?? undefined, 10)
      notify(`Cotações atualizadas: ${r.updated} cotação(ões) renovada(s).`)
      await load(selWid)
    } catch (e) {
      notify(getErrorMessage(e, 'Erro ao atualizar cotações de mercado.'), 'err')
    } finally {
      setRefreshingQuotes(false)
    }
  }

  /* ---- Handlers de Carteiras ---- */
  const handleSaveWallet = async (payload: InvestmentWalletPayload, editId?: number) => {
    if (!token) return
    try {
      if (editId) {
        await investimentosService.updateWallet(token, editId, payload)
        notify('Carteira atualizada com sucesso!')
      } else {
        const nova = await investimentosService.createWallet(token, payload)
        notify('Carteira criada com sucesso!')
        setSelWid(nova.id)
      }
      await load(selWid)
    } catch (e) {
      notify(getErrorMessage(e, 'Erro ao salvar carteira.'), 'err')
      throw e
    }
  }

  const handleDeleteWallet = async (walletId: number) => {
    if (!token || !confirm('Excluir esta carteira e todas as suas posições?')) return
    try {
      await investimentosService.deleteWallet(token, walletId)
      notify('Carteira excluída.')
      if (selWid === walletId) setSelWid(null)
      await load(null)
    } catch (e) {
      notify(getErrorMessage(e, 'Erro ao excluir carteira.'), 'err')
    }
  }

  /* ---- Handlers de Ativos ---- */
  const handleOpenNovoAtivo = (tipoPadrao: string = 'Ações') => {
    setAssetToEdit(null)
    setDefaultAssetType(tipoPadrao)
    setModalNovoAtivoOpen(true)
  }

  const handleEditAtivo = (asset: InvestmentAsset) => {
    setAssetToEdit(asset)
    setModalNovoAtivoOpen(true)
  }

  const handleSaveAsset = async (payload: InvestmentAssetPayload, editId?: number) => {
    if (!token) return
    try {
      if (editId) {
        await investimentosService.updateAsset(token, editId, payload)
        notify('Ativo atualizado com sucesso!')
      } else {
        await investimentosService.createAsset(token, payload)
        notify('Ativo cadastrado com sucesso!')
      }
      await load(selWid)
    } catch (e) {
      notify(getErrorMessage(e, 'Erro ao salvar ativo.'), 'err')
      throw e
    }
  }

  const handleDeleteAsset = async (assetId: number) => {
    if (!token || !confirm('Deseja realmente excluir este ativo e suas movimentações?')) return
    try {
      await investimentosService.deleteAsset(token, assetId)
      notify('Ativo excluído com sucesso.')
      await load(selWid)
    } catch (e) {
      notify(getErrorMessage(e, 'Erro ao excluir ativo.'), 'err')
    }
  }

  /* ---- Handlers de Operações ---- */
  const handleOpenNovaOperacao = (dashAsset?: InvestmentDashboardAsset) => {
    setTxToEdit(null)
    setSelectedAssetForOperacao(dashAsset ?? null)
    setModalOperacaoOpen(true)
  }

  const handleEditTransaction = (tx: InvestmentTransaction) => {
    setSelectedAssetForOperacao(null)
    setTxToEdit(tx)
    setModalOperacaoOpen(true)
  }

  const handleSaveTransaction = async (payload: InvestmentTransactionPayload, editId?: number) => {
    if (!token) return
    try {
      if (editId) {
        await investimentosService.updateTransaction(token, editId, payload)
        notify('Movimentação atualizada com sucesso!')
      } else {
        await investimentosService.createTransaction(token, payload)
        notify('Operação registrada com sucesso!')
      }
      await load(selWid)
    } catch (e) {
      notify(getErrorMessage(e, 'Erro ao registrar operação.'), 'err')
      throw e
    }
  }

  const handleDeleteTransaction = async (txId: number) => {
    if (!token || !confirm('Deseja excluir esta movimentação?')) return
    try {
      await investimentosService.deleteTransaction(token, txId)
      notify('Movimentação excluída.')
      await load(selWid)
    } catch (e) {
      notify(getErrorMessage(e, 'Erro ao excluir movimentação.'), 'err')
    }
  }

  const selWallet = useMemo(() => wallets.find((w) => w.id === selWid) ?? null, [wallets, selWid])

  // Contagens para badges das abas
  const countRf = useMemo(
    () =>
      dash?.ativos.filter(
        (a) => a.classe_macro === 'Renda Fixa' || ['CDB', 'Tesouro Direto', 'LCI', 'LCA', 'Debêntures', 'Previdência'].includes(a.tipo)
      ).length ?? 0,
    [dash]
  )
  const countRv = useMemo(
    () =>
      dash?.ativos.filter(
        (a) => a.classe_macro === 'Renda Variável' || ['Ações', 'FIIs', 'BDRs', 'ETFs', 'Criptomoedas'].includes(a.tipo)
      ).length ?? 0,
    [dash]
  )

  return (
    <section className="space-y-6">
      {/* Toast flutuante */}
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 flex items-center gap-2 max-w-sm rounded-xl px-4 py-3 text-xs font-semibold text-white shadow-2xl animate-in slide-in-from-bottom-5 duration-200 ${
            toast.type === 'ok' ? 'bg-emerald-600' : 'bg-rose-600'
          }`}
        >
          {toast.type === 'ok' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          <span>{toast.msg}</span>
        </div>
      )}

      {/* Top Header & Toolbar estilo SaaS */}
      <div className="flex flex-col gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-xs lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text)]">
              Investimentos
            </h1>
            {selWallet && (
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold"
                style={{
                  backgroundColor: `${selWallet.cor || '#2563eb'}18`,
                  color: selWallet.cor || '#2563eb',
                }}
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: selWallet.cor || '#2563eb' }} />
                {selWallet.nome}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            Acompanhamento consolidado de Renda Fixa e Renda Variável com cotações automáticas e rentabilidade.
          </p>
        </div>

        {/* Toolbar de Ações */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Seletor de Carteira */}
          <div className="relative">
            <select
              value={selWid ?? ''}
              onChange={(e) => handlePickWallet(e.target.value ? Number(e.target.value) : null)}
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-xs font-semibold text-[var(--color-text)] shadow-xs focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
            >
              <option value="">
                {wallets.length === 0 ? 'Sem Carteiras Cadastradas' : 'Todas as Carteiras'}
              </option>
              {wallets.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.nome} ({w.moeda})
                </option>
              ))}
            </select>
          </div>

          {/* Gerenciar Carteiras */}
          <button
            type="button"
            onClick={() => setModalCarteirasOpen(true)}
            title="Gerenciar Carteiras"
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs font-semibold text-[var(--color-text)] shadow-xs transition hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <Wallet className="h-3.5 w-3.5 text-[var(--color-muted)]" />
            <span className="hidden sm:inline">Carteiras</span>
          </button>

          {/* Atualizar Cotações */}
          <button
            type="button"
            onClick={handleRefreshQuotes}
            disabled={refreshingQuotes || loading}
            title="Atualizar Cotações Online via Brapi"
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs font-semibold text-[var(--color-text)] shadow-xs transition hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshingQuotes ? 'animate-spin text-[var(--color-primary)]' : 'text-[var(--color-muted)]'}`} />
            <span className="hidden sm:inline">
              {refreshingQuotes ? 'Atualizando…' : 'Cotações'}
            </span>
          </button>

          {/* Mercado & Simulador Link */}
          <button
            type="button"
            onClick={() => navigate('/investimentos/mercado')}
            title="Acessar Mercado, Cotações em tempo real e Simulador de Renda Fixa"
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs font-semibold text-[var(--color-text)] shadow-xs transition hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <ExternalLink className="h-3.5 w-3.5 text-sky-500" />
            <span className="hidden sm:inline">Mercado & Simulador</span>
          </button>

          {/* Botão + Novo Ativo */}
          <button
            type="button"
            onClick={() => handleOpenNovoAtivo()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs font-semibold text-[var(--color-text)] shadow-xs transition hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <Plus className="h-3.5 w-3.5 text-[var(--color-primary)]" />
            <span>Novo Ativo</span>
          </button>

          {/* Botão Primário: + Nova Operação */}
          <button
            type="button"
            onClick={() => handleOpenNovaOperacao()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--color-primary)] px-4 py-2 text-xs font-bold text-white shadow-xs transition hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            <span>Nova Operação</span>
          </button>
        </div>
      </div>

      {/* Hero KPI Cards */}
      <InvestimentosKpiCards dash={dash} loading={loading && !dash} />

      {/* Navegação por Abas Especializadas */}
      <div className="flex border-b border-[var(--color-border)] overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('visao-geral')}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-semibold transition-colors whitespace-nowrap ${
            activeTab === 'visao-geral'
              ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
              : 'border-transparent text-[var(--color-muted)] hover:text-[var(--color-text)]'
          }`}
        >
          <PieChart className="h-4 w-4" />
          <span>Visão Geral & Alocação</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('renda-fixa')}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-semibold transition-colors whitespace-nowrap ${
            activeTab === 'renda-fixa'
              ? 'border-sky-500 text-sky-600 dark:text-sky-400'
              : 'border-transparent text-[var(--color-muted)] hover:text-[var(--color-text)]'
          }`}
        >
          <ShieldCheck className="h-4 w-4 text-sky-500" />
          <span>Renda Fixa</span>
          {countRf > 0 && (
            <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-[10px] font-bold text-sky-600 dark:text-sky-400">
              {countRf}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('renda-variavel')}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-semibold transition-colors whitespace-nowrap ${
            activeTab === 'renda-variavel'
              ? 'border-purple-500 text-purple-600 dark:text-purple-400'
              : 'border-transparent text-[var(--color-muted)] hover:text-[var(--color-text)]'
          }`}
        >
          <TrendingUp className="h-4 w-4 text-purple-500" />
          <span>Renda Variável</span>
          {countRv > 0 && (
            <span className="rounded-full bg-purple-500/10 px-2 py-0.5 text-[10px] font-bold text-purple-600 dark:text-purple-400">
              {countRv}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('operacoes')}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-semibold transition-colors whitespace-nowrap ${
            activeTab === 'operacoes'
              ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
              : 'border-transparent text-[var(--color-muted)] hover:text-[var(--color-text)]'
          }`}
        >
          <History className="h-4 w-4" />
          <span>Extrato de Movimentações</span>
          {txs.length > 0 && (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-[var(--color-muted)] dark:bg-gray-800">
              {txs.length}
            </span>
          )}
        </button>
      </div>

      {/* Conteúdo da Aba Ativa */}
      <div>
        {activeTab === 'visao-geral' && (
          <VisaoGeralTab
            dash={dash}
            onNavigateTab={(tab) => setActiveTab(tab)}
            onOpenNovaOperacao={handleOpenNovaOperacao}
          />
        )}

        {activeTab === 'renda-fixa' && (
          <RendaFixaTab
            dash={dash}
            assets={assets}
            onOpenNovaOperacao={handleOpenNovaOperacao}
            onOpenNovoAtivo={handleOpenNovoAtivo}
            onEditAtivo={handleEditAtivo}
            onDeleteAtivo={handleDeleteAsset}
          />
        )}

        {activeTab === 'renda-variavel' && (
          <RendaVariavelTab
            dash={dash}
            assets={assets}
            onOpenNovaOperacao={handleOpenNovaOperacao}
            onOpenNovoAtivo={handleOpenNovoAtivo}
            onEditAtivo={handleEditAtivo}
            onDeleteAtivo={handleDeleteAsset}
          />
        )}

        {activeTab === 'operacoes' && (
          <ExtratoOperacoesTab
            transactions={txs}
            assets={assets}
            onOpenNovaOperacao={() => handleOpenNovaOperacao()}
            onEditTransaction={handleEditTransaction}
            onDeleteTransaction={handleDeleteTransaction}
          />
        )}
      </div>

      {/* Modais de Ação */}
      <OperacaoModal
        isOpen={modalOperacaoOpen}
        onClose={() => setModalOperacaoOpen(false)}
        onSave={handleSaveTransaction}
        wallets={wallets}
        assets={assets}
        initialWalletId={selWid}
        initialAssetId={selectedAssetForOperacao?.asset_id}
        transactionToEdit={txToEdit}
      />

      <NovoAtivoModal
        isOpen={modalNovoAtivoOpen}
        onClose={() => setModalNovoAtivoOpen(false)}
        onSave={handleSaveAsset}
        wallets={wallets}
        initialWalletId={selWid}
        initialType={defaultAssetType}
        assetToEdit={assetToEdit}
      />

      <CarteirasModal
        isOpen={modalCarteirasOpen}
        onClose={() => setModalCarteirasOpen(false)}
        wallets={wallets}
        onSaveWallet={handleSaveWallet}
        onDeleteWallet={handleDeleteWallet}
      />
    </section>
  )
}
