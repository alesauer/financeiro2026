import { useState, useEffect } from 'react'
import {
  Building2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Plus,
  Trash2,
  CreditCard,
  Landmark,
  ShieldCheck,
  Sparkles,
  Zap,
  Calendar,
} from 'lucide-react'
import { openfinanceService } from '../services/openfinanceService'
import type { OpenFinanceConexao, OpenFinanceStatus } from '@/shared/types/openfinance'

declare global {
  interface Window {
    PluggyConnect: any
  }
}

type Props = {
  token: string | null
}

export function OpenFinanceTab({ token }: Props) {
  const [status, setStatus] = useState<OpenFinanceStatus | null>(null)
  const [conexoes, setConexoes] = useState<OpenFinanceConexao[]>([])
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [syncingId, setSyncingId] = useState<number | null>(null)
  const [feedback, setFeedback] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null)

  // Carregar script do Pluggy Connect dinamicamente
  useEffect(() => {
    if (!document.getElementById('pluggy-connect-script')) {
      const script = document.createElement('script')
      script.id = 'pluggy-connect-script'
      script.src = 'https://cdn.pluggy.ai/pluggy-connect/v2.8.2/pluggy-connect.js'
      script.async = true
      document.body.appendChild(script)
    }
  }, [])

  const carregarDados = async () => {
    if (!token) return
    setLoading(true)
    try {
      const [statusRes, conexoesRes] = await Promise.all([
        openfinanceService.getStatus(token),
        openfinanceService.listConexoes(token),
      ])
      setStatus(statusRes)
      setConexoes(conexoesRes.items)
    } catch (err: any) {
      console.error('Erro ao carregar dados Open Finance:', err)
      setFeedback({
        tipo: 'erro',
        texto: 'Não foi possível carregar o status do Open Finance.',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarDados()
  }, [token])

  // Abrir o widget Pluggy Connect
  const handleConectarBanco = async () => {
    if (!token) return
    setConnecting(true)
    setFeedback(null)

    try {
      const tokenRes = await openfinanceService.getConnectToken(token)
      const connectToken = tokenRes.accessToken

      if (!window.PluggyConnect) {
        throw new Error('O componente do Open Finance ainda está carregando. Tente novamente em alguns segundos.')
      }

      const pluggyConnect = new window.PluggyConnect({
        connectToken,
        includeSandbox: true,
        onSuccess: async (itemData: any) => {
          const itemId = itemData?.item?.id
          if (itemId) {
            setFeedback({
              tipo: 'sucesso',
              texto: 'Conexão autorizada! Sincronizando contas e compras no cartão...',
            })
            try {
              await openfinanceService.registerConexao(token, itemId)
              await carregarDados()
              setFeedback({
                tipo: 'sucesso',
                texto: 'Instituição conectada com sucesso! As transações de cartão e extrato foram adicionadas.',
              })
            } catch (err: any) {
              setFeedback({
                tipo: 'erro',
                texto: `Erro ao sincronizar banco: ${err.message || 'Falha no sync inicial.'}`,
              })
            }
          }
        },
        onError: (error: any) => {
          console.error('Erro no Pluggy Connect:', error)
          setFeedback({
            tipo: 'erro',
            texto: `Não foi possível concluir a autorização do banco: ${error?.message || 'Cancelado ou erro no login.'}`,
          })
        },
        onClose: () => {
          setConnecting(false)
        },
      })

      pluggyConnect.init()
    } catch (err: any) {
      setFeedback({
        tipo: 'erro',
        texto: err.message || 'Erro ao inicializar conexão Open Finance.',
      })
      setConnecting(false)
    }
  }

  // Sincronizar conexão sob demanda
  const handleSincronizar = async (conexaoId: number, nomeBanco: string) => {
    if (!token) return
    setSyncingId(conexaoId)
    setFeedback(null)

    try {
      const res = await openfinanceService.syncConexao(token, conexaoId)
      const resumo = res.resumo
      setFeedback({
        tipo: 'sucesso',
        texto: `${nomeBanco} sincronizado: ${resumo.novas_transacoes} nova(s) transação(ões) importada(s), ${resumo.duplicadas_ignoradas} duplicada(s) ignorada(s).`,
      })
      await carregarDados()
    } catch (err: any) {
      setFeedback({
        tipo: 'erro',
        texto: `Erro ao sincronizar ${nomeBanco}: ${err.message || 'Falha na conexão.'}`,
      })
    } finally {
      setSyncingId(null)
    }
  }

  // Desconectar banco
  const handleDesconectar = async (conexaoId: number, nomeBanco: string) => {
    if (!token) return
    if (!confirm(`Tem certeza que deseja desconectar o ${nomeBanco}? As transações já importadas permanecerão salvas.`)) {
      return
    }

    try {
      await openfinanceService.disconnectConexao(token, conexaoId)
      setFeedback({
        tipo: 'sucesso',
        texto: `${nomeBanco} desconectado com sucesso.`,
      })
      setConexoes((prev) => prev.filter((c) => c.id !== conexaoId))
    } catch (err: any) {
      setFeedback({
        tipo: 'erro',
        texto: `Erro ao desconectar: ${err.message || 'Falha na requisição.'}`,
      })
    }
  }

  // KPIs
  const totalConexoes = conexoes.length
  const totalCartoes = conexoes.reduce(
    (acc, c) => acc + c.contas.filter((cta) => cta.is_cartao || cta.tipo === 'CREDIT').length,
    0
  )
  const totalContas = conexoes.reduce(
    (acc, c) => acc + c.contas.filter((cta) => !cta.is_cartao && cta.tipo === 'BANK').length,
    0
  )

  return (
    <div className="space-y-6">
      {/* 1. Header & Status Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-[var(--color-text)]">
              Integração Open Finance (Pluggy)
            </h3>
            {status?.connected ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5" />
                API Conectada
              </span>
            ) : status?.configured ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                <AlertTriangle className="h-3.5 w-3.5" />
                Configurada (Aguardando Conexão)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                Credenciais Pendentes
              </span>
            )}
          </div>
          <p className="text-xs text-[var(--color-muted)] mt-1">
            Conecte seus bancos para sincronizar compras no cartão de crédito, faturas e extratos com classificação por IA.
          </p>
        </div>

        <button
          type="button"
          onClick={handleConectarBanco}
          disabled={connecting || loading}
          className="flex items-center gap-1.5 rounded-[var(--radius-sm)] bg-[var(--color-primary)] px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:opacity-90 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          {connecting ? 'Iniciando Open Finance...' : 'Conectar Novo Banco'}
        </button>
      </div>

      {/* Feedback Alert */}
      {feedback && (
        <div
          className={`rounded-[var(--radius-sm)] p-3 text-xs font-semibold border flex items-center justify-between ${
            feedback.tipo === 'sucesso'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <span>{feedback.texto}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-xs underline ml-4 hover:opacity-75"
          >
            Fechar
          </button>
        </div>
      )}

      {/* 2. KPIs de Conexões */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              Bancos Conectados
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-bg)] text-[var(--color-primary)]">
              <Building2 className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-2xl font-bold tracking-tight text-[var(--color-text)]">{totalConexoes}</p>
            <p className="mt-1 text-xs text-[var(--color-muted)]">Instituições autorizadas</p>
          </div>
        </div>

        <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              Cartões de Crédito
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <CreditCard className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-2xl font-bold tracking-tight text-indigo-600">{totalCartoes}</p>
            <p className="mt-1 text-xs text-[var(--color-muted)]">Alimentando faturas automáticas</p>
          </div>
        </div>

        <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              Contas Correntes
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
              <Landmark className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-2xl font-bold tracking-tight text-teal-600">{totalContas}</p>
            <p className="mt-1 text-xs text-[var(--color-muted)]">Sincronizando extratos</p>
          </div>
        </div>

        <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              Auto-Categorização
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <Sparkles className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-2xl font-bold tracking-tight text-emerald-600">Ativa</p>
            <p className="mt-1 text-xs text-[var(--color-muted)]">IA + Regras aplicadas no sync</p>
          </div>
        </div>
      </div>

      {/* 3. Lista de Instituições Conectadas */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text)]">
            Instituições Conectadas ({conexoes.length})
          </h4>
          <span className="text-xs text-[var(--color-muted)]">
            Consentimentos regulados pelo Banco Central (12 meses)
          </span>
        </div>

        {conexoes.length === 0 && !loading && (
          <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-bg)] text-[var(--color-muted)]">
              <ShieldCheck className="h-6 w-6 text-[var(--color-primary)]" />
            </div>
            <h4 className="text-sm font-bold text-[var(--color-text)]">Nenhum banco conectado ainda</h4>
            <p className="text-xs text-[var(--color-muted)] max-w-md mx-auto">
              Conecte seu Nubank, Itaú, Inter, Bradesco ou outros bancos para importar suas compras de cartão e extratos automaticamente.
            </p>
            <button
              type="button"
              onClick={handleConectarBanco}
              disabled={connecting}
              className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] bg-[var(--color-primary)] px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:opacity-90"
            >
              <Plus className="h-4 w-4" />
              Conectar Primeiro Banco
            </button>
          </div>
        )}

        {conexoes.length > 0 && (
          <div className="space-y-3">
            {conexoes.map((conexao) => {
              const isSyncing = syncingId === conexao.id
              const isError = conexao.status === 'LOGIN_ERROR' || !!conexao.erro_mensagem

              return (
                <div
                  key={conexao.id}
                  className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-xs space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    {/* Logo & Nome */}
                    <div className="flex items-center gap-3">
                      {conexao.connector_image_url ? (
                        <img
                          src={conexao.connector_image_url}
                          alt={conexao.connector_name}
                          className="h-10 w-10 rounded-xl object-contain border border-[var(--color-border)] bg-white p-1"
                        />
                      ) : (
                        <div
                          className="h-10 w-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-xs"
                          style={{ backgroundColor: conexao.connector_primary_color || '#0d9488' }}
                        >
                          {conexao.connector_name.charAt(0)}
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-[var(--color-text)]">{conexao.connector_name}</h4>
                          {isError ? (
                            <span className="rounded-md bg-rose-50 border border-rose-200 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                              Atenção Necessária
                            </span>
                          ) : (
                            <span className="rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                              Sincronizado
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-[11px] text-[var(--color-muted)] mt-0.5">
                          {conexao.last_sync_at && (
                            <span className="flex items-center gap-1">
                              <RefreshCw className="h-3 w-3" />
                              Último sync: {new Date(conexao.last_sync_at).toLocaleString('pt-BR')}
                            </span>
                          )}
                          {conexao.consent_expires_at && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              Consentimento até: {new Date(conexao.consent_expires_at).toLocaleDateString('pt-BR')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Botões de Ação */}
                    <div className="flex items-center gap-2 self-start sm:self-center">
                      <button
                        type="button"
                        onClick={() => handleSincronizar(conexao.id, conexao.connector_name)}
                        disabled={isSyncing}
                        className="flex items-center gap-1 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text)] shadow-xs transition hover:bg-slate-200 disabled:opacity-50"
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin text-[var(--color-primary)]' : ''}`} />
                        {isSyncing ? 'Sincronizando...' : 'Sincronizar'}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDesconectar(conexao.id, conexao.connector_name)}
                        className="flex items-center gap-1 rounded-[var(--radius-sm)] border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-600 shadow-xs transition hover:bg-rose-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Desconectar
                      </button>
                    </div>
                  </div>

                  {/* Lista de Contas & Cartões Vinculados */}
                  {conexao.contas && conexao.contas.length > 0 && (
                    <div className="pt-3 border-t border-[var(--color-border)]">
                      <span className="text-[11px] font-semibold text-[var(--color-muted)] uppercase tracking-wider block mb-1.5">
                        Contas & Cartões Vinculados:
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {conexao.contas.map((conta) => (
                          <div
                            key={conta.id}
                            className="flex items-center justify-between rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)]/50 px-3 py-2 text-xs"
                          >
                            <div className="flex items-center gap-2 truncate">
                              {conta.is_cartao || conta.tipo === 'CREDIT' ? (
                                <CreditCard className="h-4 w-4 text-indigo-600 shrink-0" />
                              ) : (
                                <Landmark className="h-4 w-4 text-teal-600 shrink-0" />
                              )}
                              <span className="font-semibold text-[var(--color-text)] truncate">{conta.nome}</span>
                            </div>
                            <span className="text-[10px] text-[var(--color-muted)] font-mono ml-2 shrink-0">
                              {conta.forma_pagamento_nome || 'Vinculado'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 4. Caixa Informativa de Funcionamento */}
      <div className="rounded-[var(--radius-md)] border border-teal-200 bg-teal-50/50 p-4 space-y-2 text-xs text-teal-900">
        <div className="flex items-center gap-2 font-bold text-teal-950">
          <Zap className="h-4 w-4 text-teal-600" />
          Como funciona a sincronização automática de cartões:
        </div>
        <ul className="list-disc list-inside space-y-1 text-teal-800">
          <li>
            <strong>Faturas Inteligentes:</strong> As compras no cartão de crédito caem automaticamente no mês correto da fatura com base no dia de fechamento do seu cartão.
          </li>
          <li>
            <strong>Deduplicação Garantida:</strong> Lançamentos já cadastrados anteriormente ou pagamentos de fatura não são duplicados.
          </li>
          <li>
            <strong>IA de Categorização:</strong> Cada compra passa pelo motor de inteligência artificial e regras para ser categorizada instantaneamente.
          </li>
        </ul>
      </div>
    </div>
  )
}
