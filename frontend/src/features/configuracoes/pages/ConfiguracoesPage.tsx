import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import {
  AlertTriangle,
  Bell,
  Bot,
  CheckCircle2,
  Database,
  Download,
  FileSpreadsheet,
  Info,
  Plus,
  RefreshCw,
  Server,
  ShieldAlert,
  Sparkles,
  Trash2,
  X,
  Zap,
} from 'lucide-react'

import { useAuth } from '@/app/providers/AuthProvider'
import { configuracoesService } from '@/features/configuracoes/services/configuracoesService'
import { formasPagamentoService } from '@/features/formasPagamento/services/formasPagamentoService'
import type {
  AlertasConfig,
  LimparDadosTipo,
  SobreSistemaConfig,
} from '@/shared/types/configuracao'
import type { FormaPagamento } from '@/shared/types/formaPagamento'
import { getErrorMessage } from '@/shared/utils/error'
import { OpenFinanceTab } from '../components/OpenFinanceTab'
import { IATab } from '../components/IATab'

type TabType = 'dados' | 'alertas' | 'backup' | 'recalculos' | 'openfinance' | 'ia' | 'sobre'

export function ConfiguracoesPage() {
  const { token, user } = useAuth()

  const [activeTab, setActiveTab] = useState<TabType>('dados')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null)

  // Alertas
  const [alertas, setAlertas] = useState<AlertasConfig>({
    ligado: false,
    email: false,
    whatsapp: false,
    limite: 0,
  })
  const [emailsAlerta, setEmailsAlerta] = useState<string[]>([])
  const [novoEmail, setNovoEmail] = useState('')

  // Sobre
  const [sobre, setSobre] = useState<SobreSistemaConfig>({
    descricao: '',
    versao: '',
    usuario_logado: user?.nome ?? null,
    data_hora: null,
  })

  // Recálculos
  const [formas, setFormas] = useState<FormaPagamento[]>([])
  const [cartaoRecalculoId, setCartaoRecalculoId] = useState<number | ''>('')
  const [recalculando, setRecalculando] = useState(false)

  // Modal de Exclusão / Reset
  const [modalLimpeza, setModalLimpeza] = useState<{
    isOpen: boolean
    tipo: LimparDadosTipo
    titulo: string
    descricao: string
    aviso: string
  } | null>(null)
  const [inputConfirmacao, setInputConfirmacao] = useState('')

  useEffect(() => {
    if (!token) return
    carregarConfiguracoes()
  }, [token])

  const carregarConfiguracoes = async () => {
    if (!token) return
    setLoading(true)
    setFeedback(null)

    try {
      const [alertasData, emailsData, sobreData, formasData] = await Promise.all([
        configuracoesService.getAlertas(token),
        configuracoesService.getEmailsAlerta(token),
        configuracoesService.getSobreSistema(token),
        formasPagamentoService.list(token),
      ])

      setAlertas(alertasData)
      setEmailsAlerta(emailsData.emails ?? [])
      setSobre(sobreData)

      const cartoes = formasData.filter((f) => f.cartao_credito && f.ativo)
      setFormas(cartoes)
      if (cartoes[0]) {
        setCartaoRecalculoId(cartoes[0].id)
      }
    } catch (err) {
      setFeedback({
        tipo: 'erro',
        texto: getErrorMessage(err, 'Erro ao carregar configurações.'),
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSalvarAlertas = async (e: FormEvent) => {
    e.preventDefault()
    if (!token) return
    setSaving(true)
    setFeedback(null)

    try {
      await configuracoesService.saveAlertas(token, alertas)
      setFeedback({ tipo: 'sucesso', texto: 'Configurações de alertas salvas com sucesso!' })
    } catch (err) {
      setFeedback({ tipo: 'erro', texto: getErrorMessage(err, 'Erro ao salvar alertas.') })
    } finally {
      setSaving(false)
    }
  }

  const handleAddEmail = async () => {
    const emailLimpo = novoEmail.trim().toLowerCase()
    if (!token || !emailLimpo || !emailLimpo.includes('@')) return

    try {
      const res = await configuracoesService.addEmailAlerta(token, emailLimpo)
      setEmailsAlerta(res.emails)
      setNovoEmail('')
      setFeedback({ tipo: 'sucesso', texto: 'E-mail adicionado para alertas.' })
    } catch (err) {
      setFeedback({ tipo: 'erro', texto: getErrorMessage(err, 'Erro ao adicionar e-mail.') })
    }
  }

  const handleRemoveEmail = async (email: string) => {
    if (!token) return
    try {
      const res = await configuracoesService.removeEmailAlerta(token, email)
      setEmailsAlerta(res.emails)
      setFeedback({ tipo: 'sucesso', texto: 'E-mail removido da lista de alertas.' })
    } catch (err) {
      setFeedback({ tipo: 'erro', texto: getErrorMessage(err, 'Erro ao remover e-mail.') })
    }
  }

  const handleSalvarSobre = async (e: FormEvent) => {
    e.preventDefault()
    if (!token) return
    setSaving(true)
    setFeedback(null)

    try {
      await configuracoesService.saveSobreSistema(token, {
        descricao: sobre.descricao,
        versao: sobre.versao,
      })
      setFeedback({ tipo: 'sucesso', texto: 'Informações do sistema atualizadas!' })
    } catch (err) {
      setFeedback({ tipo: 'erro', texto: getErrorMessage(err, 'Erro ao salvar informações.') })
    } finally {
      setSaving(false)
    }
  }

  const handleExportarBackup = async () => {
    if (!token) return
    setSaving(true)
    setFeedback(null)

    try {
      const data = await configuracoesService.exportarBackupJson(token)
      const jsonStr = JSON.stringify(data, null, 2)
      const blob = new Blob([jsonStr], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      const dataHoje = new Date().toISOString().slice(0, 10)
      link.href = url
      link.download = `backup_financas_${dataHoje}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      setFeedback({ tipo: 'sucesso', texto: 'Arquivo de backup exportado com sucesso!' })
    } catch (err) {
      setFeedback({ tipo: 'erro', texto: getErrorMessage(err, 'Erro ao exportar backup.') })
    } finally {
      setSaving(false)
    }
  }

  const handleRecalcularCompetencia = async () => {
    if (!token || !cartaoRecalculoId) return
    setRecalculando(true)
    setFeedback(null)

    try {
      const res = await configuracoesService.recalcularCompetencias(token, Number(cartaoRecalculoId))
      setFeedback({
        tipo: 'sucesso',
        texto: `Competências recalculadas com sucesso! ${res.atualizados} de ${res.total_considerado} transação(ões) atualizadas.`,
      })
    } catch (err) {
      setFeedback({ tipo: 'erro', texto: getErrorMessage(err, 'Erro ao recalcular competências.') })
    } finally {
      setRecalculando(false)
    }
  }

  const abrirModalLimpeza = (tipo: LimparDadosTipo) => {
    setInputConfirmacao('')
    if (tipo === 'transacoes') {
      setModalLimpeza({
        isOpen: true,
        tipo: 'transacoes',
        titulo: 'Apagar Todas as Transações',
        descricao:
          'Esta ação excluirá todas as receitas, despesas, faturas de cartão e investimentos cadastrados.',
        aviso: 'Suas Categorias, Formas de Pagamento e Usuários serão preservados.',
      })
    } else if (tipo === 'total') {
      setModalLimpeza({
        isOpen: true,
        tipo: 'total',
        titulo: 'Reset Completo de Dados (Factory Reset)',
        descricao:
          'Esta ação apagará absolutamente todas as transações, milhas, lembretes, viagens, custos e documentos.',
        aviso: 'O sistema será restaurado para o estado limpo inicial. Sua conta de login atual será mantida.',
      })
    } else if (tipo === 'milhas') {
      setModalLimpeza({
        isOpen: true,
        tipo: 'milhas',
        titulo: 'Limpar Extrato de Milhas',
        descricao: 'Excluirá todo o histórico e movimentações de programas de milhas.',
        aviso: 'Esta ação não poderá ser desfeita.',
      })
    } else if (tipo === 'lembretes') {
      setModalLimpeza({
        isOpen: true,
        tipo: 'lembretes',
        titulo: 'Limpar Todos os Lembretes',
        descricao: 'Excluirá todos os lembretes e tarefas cadastrados no sistema.',
        aviso: 'Esta ação não poderá ser desfeita.',
      })
    } else if (tipo === 'viagens') {
      setModalLimpeza({
        isOpen: true,
        tipo: 'viagens',
        titulo: 'Limpar Viagens e Custos',
        descricao: 'Excluirá todas as viagens, roteiros, custos e comprovantes vinculados.',
        aviso: 'Esta ação não poderá ser desfeita.',
      })
    } else if (tipo === 'documentos') {
      setModalLimpeza({
        isOpen: true,
        tipo: 'documentos',
        titulo: 'Limpar Documentos e Anexos',
        descricao: 'Excluirá todos os registros de documentos e anexos salvos.',
        aviso: 'Esta ação não poderá ser desfeita.',
      })
    } else if (tipo === 'seed_demo') {
      setModalLimpeza({
        isOpen: true,
        tipo: 'seed_demo',
        titulo: 'Gerar Base Demonstrativa (Seed Demo)',
        descricao:
          'Criará um conjunto completo de dados e transações fictícias para o ano atual (salários, contas fixas, lazer e parcelamentos).',
        aviso: 'Ideal para testes e visualização de relatórios.',
      })
    }
  }

  const handleConfirmarLimpeza = async () => {
    if (!token || !modalLimpeza) return
    if (inputConfirmacao.trim().toUpperCase() !== 'EXCLUIR') return

    setSaving(true)
    setFeedback(null)

    try {
      const res = await configuracoesService.limparDados(token, {
        tipo: modalLimpeza.tipo,
        confirmacao: inputConfirmacao.trim().toUpperCase(),
      })

      setModalLimpeza(null)
      setFeedback({
        tipo: 'sucesso',
        texto: res.mensagem || 'Operação realizada com sucesso!',
      })
    } catch (err) {
      setFeedback({
        tipo: 'erro',
        texto: getErrorMessage(err, 'Não foi possível concluir a operação de limpeza.'),
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h2 className="text-2xl font-semibold text-[var(--color-text)]">Configurações & Manutenção</h2>
        <p className="text-sm text-[var(--color-muted)]">
          Gerencie alertas, realize backups, efetue limpeza de dados e configure integrações do sistema.
        </p>
      </header>

      {/* Feedback Toast / Alert */}
      {feedback && (
        <div
          className={`flex items-center justify-between gap-2 rounded-[var(--radius-sm)] border p-3 text-sm animate-in fade-in duration-200 ${
            feedback.tipo === 'sucesso'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-rose-200 bg-rose-50 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.tipo === 'sucesso' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
            )}
            <span>{feedback.texto}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="rounded p-1 hover:bg-black/5"
            title="Fechar"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Abas */}
      <div className="flex flex-wrap gap-2 border-b border-[var(--color-border)] pb-2 text-sm font-medium">
        <button
          type="button"
          onClick={() => setActiveTab('dados')}
          className={`inline-flex items-center gap-2 rounded-[var(--radius-sm)] px-3 py-2 transition ${
            activeTab === 'dados'
              ? 'bg-[var(--color-primary)] text-white shadow-xs'
              : 'text-[var(--color-muted)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]'
          }`}
        >
          <Database className="h-4 w-4" />
          Dados & Limpeza
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('backup')}
          className={`inline-flex items-center gap-2 rounded-[var(--radius-sm)] px-3 py-2 transition ${
            activeTab === 'backup'
              ? 'bg-[var(--color-primary)] text-white shadow-xs'
              : 'text-[var(--color-muted)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]'
          }`}
        >
          <Download className="h-4 w-4" />
          Backup & Exportação
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('alertas')}
          className={`inline-flex items-center gap-2 rounded-[var(--radius-sm)] px-3 py-2 transition ${
            activeTab === 'alertas'
              ? 'bg-[var(--color-primary)] text-white shadow-xs'
              : 'text-[var(--color-muted)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]'
          }`}
        >
          <Bell className="h-4 w-4" />
          Alertas & Notificações
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('recalculos')}
          className={`inline-flex items-center gap-2 rounded-[var(--radius-sm)] px-3 py-2 transition ${
            activeTab === 'recalculos'
              ? 'bg-[var(--color-primary)] text-white shadow-xs'
              : 'text-[var(--color-muted)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]'
          }`}
        >
          <RefreshCw className="h-4 w-4" />
          Recálculos
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('openfinance')}
          className={`inline-flex items-center gap-2 rounded-[var(--radius-sm)] px-3 py-2 transition ${
            activeTab === 'openfinance'
              ? 'bg-[var(--color-primary)] text-white shadow-xs'
              : 'text-[var(--color-muted)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]'
          }`}
        >
          <Zap className="h-4 w-4 text-amber-300" />
          Open Finance (Pluggy)
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('ia')}
          className={`inline-flex items-center gap-2 rounded-[var(--radius-sm)] px-3 py-2 transition ${
            activeTab === 'ia'
              ? 'bg-[var(--color-primary)] text-white shadow-xs'
              : 'text-[var(--color-muted)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]'
          }`}
        >
          <Bot className="h-4 w-4 text-sky-400" />
          Inteligência Artificial (IA)
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('sobre')}
          className={`inline-flex items-center gap-2 rounded-[var(--radius-sm)] px-3 py-2 transition ${
            activeTab === 'sobre'
              ? 'bg-[var(--color-primary)] text-white shadow-xs'
              : 'text-[var(--color-muted)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]'
          }`}
        >
          <Info className="h-4 w-4" />
          Sobre o Sistema
        </button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-[var(--color-muted)]">Carregando configurações...</div>
      ) : (
        <>
          {/* ========================================================================= */}
          {/* ABA 1: DADOS E MANUTENÇÃO (ZONA DE PERIGO) */}
          {/* ========================================================================= */}
          {activeTab === 'dados' && (
            <div className="space-y-6">
              {/* Card Destaque: Zona de Perigo */}
              <article className="rounded-[var(--radius-md)] border border-rose-200 bg-rose-50/40 p-5 shadow-xs">
                <div className="mb-4 flex items-center gap-2 text-rose-800">
                  <ShieldAlert className="h-5 w-5 shrink-0" />
                  <h3 className="text-base font-semibold">Zona de Perigo — Limpeza e Reset de Dados</h3>
                </div>
                <p className="mb-6 text-xs text-rose-900/80">
                  As ações abaixo realizam a exclusão permanente de registros do banco de dados. Todas exigem confirmação explícita de segurança antes de serem executadas.
                </p>

                <div className="grid gap-4 md:grid-cols-2">
                  {/* Reset Financeiro */}
                  <div className="flex flex-col justify-between rounded-[var(--radius-sm)] border border-rose-200 bg-[var(--color-surface)] p-4 shadow-xs">
                    <div>
                      <h4 className="font-semibold text-[var(--color-text)]">Apagar Todas as Transações</h4>
                      <p className="mt-1 text-xs text-[var(--color-muted)]">
                        Exclui todas as receitas, despesas, faturas de cartão e investimentos. Mantém categorias, formas de pagamento e contas de usuário intactas.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => abrirModalLimpeza('transacoes')}
                      className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-sm)] border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                      Limpar Todas as Transações
                    </button>
                  </div>

                  {/* Factory Reset */}
                  <div className="flex flex-col justify-between rounded-[var(--radius-sm)] border border-rose-300 bg-rose-50/70 p-4 shadow-xs">
                    <div>
                      <div className="flex items-center gap-1.5 text-rose-900">
                        <span className="rounded bg-rose-200 px-1.5 py-0.5 text-[10px] font-bold uppercase">Crítico</span>
                        <h4 className="font-semibold">Reset Completo (Factory Reset)</h4>
                      </div>
                      <p className="mt-1 text-xs text-rose-950/80">
                        Apaga todas as tabelas (transações, milhas, lembretes, viagens, custos, documentos). Restaura o sistema para o estado inicial limpo preservando seu login.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => abrirModalLimpeza('total')}
                      className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-sm)] bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-700 transition-colors shadow-xs"
                    >
                      <Trash2 className="h-4 w-4" />
                      Executar Reset Total de Fábrica
                    </button>
                  </div>
                </div>
              </article>

              {/* Limpezas Seletivas por Módulo */}
              <article className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
                <h3 className="mb-2 text-base font-semibold text-[var(--color-text)]">Limpeza Seletiva por Módulo</h3>
                <p className="mb-4 text-xs text-[var(--color-muted)]">
                  Limpe apenas módulos específicos sem afetar suas transações financeiras principais.
                </p>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-[var(--radius-sm)] border border-[var(--color-border)] p-3">
                    <p className="text-sm font-medium text-[var(--color-text)]">Milhas</p>
                    <p className="mt-0.5 text-xs text-[var(--color-muted)]">Apaga extratos e programas de milhas.</p>
                    <button
                      type="button"
                      onClick={() => abrirModalLimpeza('milhas')}
                      className="mt-3 w-full rounded-[var(--radius-sm)] border border-rose-200 px-2 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50"
                    >
                      Limpar Milhas
                    </button>
                  </div>

                  <div className="rounded-[var(--radius-sm)] border border-[var(--color-border)] p-3">
                    <p className="text-sm font-medium text-[var(--color-text)]">Lembretes</p>
                    <p className="mt-0.5 text-xs text-[var(--color-muted)]">Apaga todos os lembretes e tarefas.</p>
                    <button
                      type="button"
                      onClick={() => abrirModalLimpeza('lembretes')}
                      className="mt-3 w-full rounded-[var(--radius-sm)] border border-rose-200 px-2 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50"
                    >
                      Limpar Lembretes
                    </button>
                  </div>

                  <div className="rounded-[var(--radius-sm)] border border-[var(--color-border)] p-3">
                    <p className="text-sm font-medium text-[var(--color-text)]">Viagens</p>
                    <p className="mt-0.5 text-xs text-[var(--color-muted)]">Apaga viagens, roteiros e custos.</p>
                    <button
                      type="button"
                      onClick={() => abrirModalLimpeza('viagens')}
                      className="mt-3 w-full rounded-[var(--radius-sm)] border border-rose-200 px-2 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50"
                    >
                      Limpar Viagens
                    </button>
                  </div>

                  <div className="rounded-[var(--radius-sm)] border border-[var(--color-border)] p-3">
                    <p className="text-sm font-medium text-[var(--color-text)]">Documentos</p>
                    <p className="mt-0.5 text-xs text-[var(--color-muted)]">Apaga documentos e registros anexados.</p>
                    <button
                      type="button"
                      onClick={() => abrirModalLimpeza('documentos')}
                      className="mt-3 w-full rounded-[var(--radius-sm)] border border-rose-200 px-2 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50"
                    >
                      Limpar Documentos
                    </button>
                  </div>
                </div>
              </article>

              {/* Dados de Teste / Seed Demo */}
              <article className="rounded-[var(--radius-md)] border border-emerald-200 bg-emerald-50/30 p-5">
                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                  <div>
                    <div className="flex items-center gap-2 text-emerald-800">
                      <Sparkles className="h-5 w-5" />
                      <h3 className="text-base font-semibold">Popular Banco com Dados Demonstrativos (Seed Demo)</h3>
                    </div>
                    <p className="mt-1 text-xs text-emerald-950/80">
                      Gera automaticamente transações, receitas recorrentes, contas de consumo e parcelamentos para o ano atual, permitindo testar gráficos e dashboards.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => abrirModalLimpeza('seed_demo')}
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-[var(--radius-sm)] bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors shadow-xs"
                  >
                    <Sparkles className="h-4 w-4" />
                    Gerar Massa de Teste
                  </button>
                </div>
              </article>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ABA 2: BACKUP E EXPORTAÇÃO */}
          {/* ========================================================================= */}
          {activeTab === 'backup' && (
            <div className="space-y-6">
              <article className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
                <div className="flex items-center gap-2">
                  <Download className="h-5 w-5 text-[var(--color-primary)]" />
                  <h3 className="text-base font-semibold text-[var(--color-text)]">Exportar Dados & Backup Completo</h3>
                </div>
                <p className="mt-1 text-xs text-[var(--color-muted)]">
                  Baixe cópias dos seus lançamentos em formato estruturado para auditoria externa ou migração.
                </p>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <div className="rounded-[var(--radius-sm)] border border-[var(--color-border)] p-4 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="h-5 w-5 text-sky-600" />
                        <h4 className="font-semibold text-sm text-[var(--color-text)]">Backup Geral (JSON)</h4>
                      </div>
                      <p className="mt-2 text-xs text-[var(--color-muted)]">
                        Exporta categorias, formas de pagamento, histórico completo de transações, milhas, lembretes e viagens em um único arquivo JSON.
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={handleExportarBackup}
                      className="mt-4 inline-flex items-center justify-center gap-2 rounded-[var(--radius-sm)] bg-[var(--color-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--color-primary)]/90 disabled:opacity-50 transition-colors"
                    >
                      <Download className="h-4 w-4" />
                      {saving ? 'Gerando arquivo...' : 'Baixar Backup JSON'}
                    </button>
                  </div>

                  <div className="rounded-[var(--radius-sm)] border border-[var(--color-border)] p-4 bg-[var(--color-bg)]/30">
                    <div className="flex items-center gap-2">
                      <Server className="h-5 w-5 text-[var(--color-muted)]" />
                      <h4 className="font-semibold text-sm text-[var(--color-text)]">Segurança e Backup em Nuvem</h4>
                    </div>
                    <p className="mt-2 text-xs text-[var(--color-muted)] leading-relaxed">
                      Se você executa o sistema em container Docker, o volume persistente <code>sqlite_data</code> armazena seu banco com segurança em disco. Recomendamos gerar cópias periódicas antes de grandes alterações ou limpezas.
                    </p>
                  </div>
                </div>
              </article>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ABA 3: ALERTAS E NOTIFICAÇÕES */}
          {/* ========================================================================= */}
          {activeTab === 'alertas' && (
            <div className="space-y-6">
              <form onSubmit={handleSalvarAlertas} className="space-y-5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
                <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
                  <div>
                    <h3 className="text-base font-semibold text-[var(--color-text)]">Preferências de Alertas</h3>
                    <p className="text-xs text-[var(--color-muted)]">Configure notificações automáticas e limites de gastos.</p>
                  </div>
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-[var(--radius-sm)] bg-[var(--color-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--color-primary)]/90 disabled:opacity-50"
                  >
                    {saving ? 'Salvando...' : 'Salvar Alertas'}
                  </button>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <label className="flex cursor-pointer items-center justify-between rounded-[var(--radius-sm)] border border-[var(--color-border)] p-3">
                    <span className="text-sm font-medium text-[var(--color-text)]">Ligar Alertas</span>
                    <input
                      type="checkbox"
                      checked={alertas.ligado}
                      onChange={(e) => setAlertas((prev) => ({ ...prev, ligado: e.target.checked }))}
                      className="h-4 w-4 rounded text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                    />
                  </label>

                  <label className="flex cursor-pointer items-center justify-between rounded-[var(--radius-sm)] border border-[var(--color-border)] p-3">
                    <span className="text-sm font-medium text-[var(--color-text)]">Alertas por E-mail</span>
                    <input
                      type="checkbox"
                      checked={alertas.email}
                      onChange={(e) => setAlertas((prev) => ({ ...prev, email: e.target.checked }))}
                      className="h-4 w-4 rounded text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                    />
                  </label>

                  <label className="flex cursor-pointer items-center justify-between rounded-[var(--radius-sm)] border border-[var(--color-border)] p-3">
                    <span className="text-sm font-medium text-[var(--color-text)]">Alertas por WhatsApp</span>
                    <input
                      type="checkbox"
                      checked={alertas.whatsapp}
                      onChange={(e) => setAlertas((prev) => ({ ...prev, whatsapp: e.target.checked }))}
                      className="h-4 w-4 rounded text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                    />
                  </label>
                </div>

                <div className="max-w-md">
                  <label className="block text-xs font-medium uppercase tracking-wide text-[var(--color-muted)]">
                    Limite de Valor para Alerta Imediato (R$)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={alertas.limite || ''}
                    onChange={(e) => setAlertas((prev) => ({ ...prev, limite: Number(e.target.value) }))}
                    className="mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-sm"
                    placeholder="0,00"
                  />
                  <span className="text-[11px] text-[var(--color-muted)]">
                    Transações com valor acima deste limite gerarão avisos.
                  </span>
                </div>
              </form>

              {/* Lista de E-mails para Alertas */}
              <article className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
                <h3 className="text-base font-semibold text-[var(--color-text)]">E-mails Cadastrados para Alertas</h3>
                <p className="mt-0.5 text-xs text-[var(--color-muted)]">Destinatários que receberão resumos e alertas automáticos.</p>

                <div className="mt-4 flex max-w-md gap-2">
                  <input
                    type="email"
                    value={novoEmail}
                    onChange={(e) => setNovoEmail(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddEmail())}
                    placeholder="ex.: usuario@dominio.com"
                    className="flex-1 rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={handleAddEmail}
                    className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] bg-[var(--color-primary)] px-3 py-2 text-xs font-semibold text-white hover:bg-[var(--color-primary)]/90"
                  >
                    <Plus className="h-4 w-4" />
                    Adicionar
                  </button>
                </div>

                <div className="mt-4 space-y-2 max-w-md">
                  {emailsAlerta.length === 0 ? (
                    <p className="text-xs text-[var(--color-muted)]">Nenhum e-mail adicional cadastrado.</p>
                  ) : (
                    emailsAlerta.map((item) => (
                      <div
                        key={item}
                        className="flex items-center justify-between rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)]/40 px-3 py-2 text-sm"
                      >
                        <span className="text-[var(--color-text)]">{item}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveEmail(item)}
                          className="rounded p-1 text-rose-600 hover:bg-rose-50"
                          title="Remover e-mail"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </article>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ABA 4: RECÁLCULOS E INTEGRIDADE */}
          {/* ========================================================================= */}
          {activeTab === 'recalculos' && (
            <div className="space-y-6">
              <article className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-5 w-5 text-sky-600" />
                  <h3 className="text-base font-semibold text-[var(--color-text)]">Recálculo de Competências de Cartão</h3>
                </div>
                <p className="mt-1 text-xs text-[var(--color-muted)]">
                  Se você alterou o dia de fechamento ou vencimento de um cartão de crédito, utilize esta ferramenta para reajustar automaticamente a competência da fatura em todas as compras anteriores.
                </p>

                <div className="mt-5 max-w-md space-y-3">
                  <div>
                    <label className="block text-xs font-medium uppercase tracking-wide text-[var(--color-muted)]">
                      Selecione o Cartão de Crédito
                    </label>
                    <select
                      value={cartaoRecalculoId}
                      onChange={(e) => setCartaoRecalculoId(Number(e.target.value) || '')}
                      className="mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-sm"
                    >
                      {formas.map((cartao) => (
                        <option key={cartao.id} value={cartao.id}>
                          {cartao.nome} (Fechamento: dia {cartao.dia_fechamento ?? '-'} · Vencimento: dia {cartao.dia_vencimento ?? '-'})
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    disabled={recalculando || !cartaoRecalculoId}
                    onClick={handleRecalcularCompetencia}
                    className="inline-flex items-center gap-2 rounded-[var(--radius-sm)] bg-[var(--color-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--color-primary)]/90 disabled:opacity-50 transition-colors"
                  >
                    <RefreshCw className={`h-4 w-4 ${recalculando ? 'animate-spin' : ''}`} />
                    {recalculando ? 'Recalculando faturas...' : 'Recalcular Faturas Deste Cartão'}
                  </button>
                </div>
              </article>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ABA 5: OPEN FINANCE (PLUGGY) */}
          {/* ========================================================================= */}
          {activeTab === 'openfinance' && (
            <OpenFinanceTab token={token} />
          )}

          {/* ========================================================================= */}
          {/* ABA 6: INTELIGÊNCIA ARTIFICIAL (IA) */}
          {/* ========================================================================= */}
          {activeTab === 'ia' && (
            <IATab token={token} />
          )}

          {/* ========================================================================= */}
          {/* ABA 5: SOBRE O SISTEMA */}
          {/* ========================================================================= */}
          {activeTab === 'sobre' && (
            <div className="space-y-6">
              <form onSubmit={handleSalvarSobre} className="space-y-5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
                <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
                  <h3 className="text-base font-semibold text-[var(--color-text)]">Informações do Sistema</h3>
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-[var(--radius-sm)] bg-[var(--color-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--color-primary)]/90 disabled:opacity-50"
                  >
                    {saving ? 'Salvando...' : 'Salvar Alterações'}
                  </button>
                </div>

                <div className="max-w-lg space-y-4">
                  <div>
                    <label className="block text-xs font-medium uppercase tracking-wide text-[var(--color-muted)]">
                      Descrição do Sistema
                    </label>
                    <textarea
                      rows={3}
                      value={sobre.descricao || ''}
                      onChange={(e) => setSobre((prev) => ({ ...prev, descricao: e.target.value }))}
                      className="mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-sm"
                      placeholder="Sistema de Gestão Financeira Pessoal"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium uppercase tracking-wide text-[var(--color-muted)]">
                      Versão
                    </label>
                    <input
                      type="text"
                      value={sobre.versao || ''}
                      onChange={(e) => setSobre((prev) => ({ ...prev, versao: e.target.value }))}
                      className="mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-sm"
                      placeholder="2.0.0"
                    />
                  </div>

                  <div className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)]/30 p-3 text-xs space-y-1.5">
                    <p>
                      <strong>Usuário conectado:</strong> {sobre.usuario_logado ?? user?.nome ?? 'Administrador'}
                    </p>
                    <p>
                      <strong>Data/Hora do servidor:</strong> {sobre.data_hora ? new Date(sobre.data_hora).toLocaleString('pt-BR') : 'Tempo real'}
                    </p>
                  </div>
                </div>
              </form>
            </div>
          )}
        </>
      )}

      {/* Modal de Confirmação Segura de Limpeza */}
      {modalLimpeza?.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-[var(--color-text)]">{modalLimpeza.titulo}</h3>
                <p className="text-xs text-[var(--color-muted)]">Confirmação de Segurança</p>
              </div>
            </div>

            <div className="mb-5 space-y-2 rounded-[var(--radius-sm)] border border-rose-200 bg-rose-50/60 p-3.5 text-xs text-rose-950">
              <p className="font-medium text-rose-900 leading-relaxed">{modalLimpeza.descricao}</p>
              <p className="text-rose-800">⚠️ {modalLimpeza.aviso}</p>
            </div>

            <div className="mb-6 space-y-2">
              <label className="block text-xs font-semibold text-[var(--color-text)]">
                Para confirmar a exclusão, digite <span className="font-mono text-rose-600 font-bold">EXCLUIR</span> abaixo:
              </label>
              <input
                type="text"
                autoFocus
                value={inputConfirmacao}
                onChange={(e) => setInputConfirmacao(e.target.value)}
                placeholder="EXCLUIR"
                className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-sm uppercase tracking-wider font-mono"
              />
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => setModalLimpeza(null)}
                className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-bg)] transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={saving || inputConfirmacao.trim().toUpperCase() !== 'EXCLUIR'}
                onClick={handleConfirmarLimpeza}
                className="inline-flex items-center gap-2 rounded-[var(--radius-sm)] bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
              >
                {saving ? 'Executando...' : 'Confirmar Limpeza'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
