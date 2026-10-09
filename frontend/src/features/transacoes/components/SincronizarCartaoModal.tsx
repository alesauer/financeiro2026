import { useEffect, useState } from 'react'
import {
  X,
  CreditCard,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { openfinanceService } from '@/features/configuracoes/services/openfinanceService'
import type { CartaoOpenFinance, SyncCartaoResponse } from '@/shared/types/openfinance'
import { BankCardIcon } from '@/shared/components/BankCardIcon'
import { getErrorMessage } from '@/shared/utils/error'

interface SincronizarCartaoModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (resumo: SyncCartaoResponse['resumo']) => void
  token: string
  mesFiltroIso?: string // formato 'YYYY-MM' ou 'YYYY-MM-DD'
}

const MESES_NOMES = [
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

export function SincronizarCartaoModal({
  isOpen,
  onClose,
  onSuccess,
  token,
  mesFiltroIso,
}: SincronizarCartaoModalProps) {
  const navigate = useNavigate()
  const [cartoes, setCartoes] = useState<CartaoOpenFinance[]>([])
  const [loadingCartoes, setLoadingCartoes] = useState(false)
  const [cartaoSelecionadoId, setCartaoSelecionadoId] = useState<number | null>(null)
  const [modoPeriodo, setModoPeriodo] = useState<'mes_corrente' | 'mes_tela' | 'todos'>('mes_corrente')
  const [loadingSync, setLoadingSync] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [resultado, setResultado] = useState<SyncCartaoResponse['resumo'] | null>(null)

  // Data atual (mês corrente)
  const hoje = new Date()
  const anoCorrente = hoje.getFullYear()
  const mesCorrenteNum = hoje.getMonth() + 1
  const mesCorrenteIso = `${anoCorrente}-${String(mesCorrenteNum).padStart(2, '0')}`
  const mesCorrenteLabel = `${MESES_NOMES[mesCorrenteNum - 1]} / ${anoCorrente}`

  // Mês selecionado no filtro da tela
  let mesTelaIso = mesCorrenteIso
  let mesTelaLabel = mesCorrenteLabel
  if (mesFiltroIso && mesFiltroIso.length >= 7) {
    const pAno = Number(mesFiltroIso.slice(0, 4))
    const pMes = Number(mesFiltroIso.slice(5, 7))
    if (!isNaN(pAno) && !isNaN(pMes) && pMes >= 1 && pMes <= 12) {
      mesTelaIso = `${pAno}-${String(pMes).padStart(2, '0')}`
      mesTelaLabel = `${MESES_NOMES[pMes - 1]} / ${pAno}`
    }
  }

  const ehMesesDiferentes = mesTelaIso !== mesCorrenteIso

  useEffect(() => {
    if (!isOpen) {
      setResultado(null)
      setErro(null)
      return
    }

    async function carregarCartoes() {
      setLoadingCartoes(true)
      setErro(null)
      try {
        const resp = await openfinanceService.listCartoes(token)
        const lista = resp.cartoes || []
        setCartoes(lista)
        if (lista.length > 0) {
          setCartaoSelecionadoId(lista[0].forma_pagamento_id)
        }
      } catch (err) {
        setErro(getErrorMessage(err, 'Erro ao listar cartões do Open Finance.'))
      } finally {
        setLoadingCartoes(false)
      }
    }

    carregarCartoes()
  }, [isOpen, token])

  if (!isOpen) return null

  const handleSincronizar = async () => {
    if (!cartaoSelecionadoId) {
      setErro('Por favor, selecione um cartão para sincronizar.')
      return
    }

    setLoadingSync(true)
    setErro(null)
    setResultado(null)

    let mesFatura: string | undefined = undefined
    if (modoPeriodo === 'mes_corrente') {
      mesFatura = mesCorrenteIso
    } else if (modoPeriodo === 'mes_tela') {
      mesFatura = mesTelaIso
    }

    try {
      const resp = await openfinanceService.syncCartao(token, {
        forma_pagamento_id: cartaoSelecionadoId,
        mes_fatura: mesFatura,
      })
      setResultado(resp.resumo)
      if (resp.resumo) {
        onSuccess(resp.resumo)
      }
    } catch (err) {
      setErro(getErrorMessage(err, 'Falha ao sincronizar cartão via Open Finance.'))
    } finally {
      setLoadingSync(false)
    }
  }

  const handleConcluir = () => {
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-lg rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4 bg-[var(--color-bg)]/40">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-100 text-sky-700">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[var(--color-text)]">Sincronizar Cartão</h3>
              <p className="text-xs text-[var(--color-muted)]">Importar lançamentos e fatura via Open Finance</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)] transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="p-5 space-y-4">
          {erro ? (
            <div className="flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{erro}</span>
            </div>
          ) : null}

          {/* Resultado de Sucesso */}
          {resultado ? (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
                <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0" />
                <div>
                  <h4 className="text-sm font-bold">Fatura Sincronizada com Sucesso!</h4>
                  <p className="text-xs text-emerald-700 mt-0.5">
                    Os dados do cartão <strong>{resultado.cartao_nome}</strong> foram atualizados.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]/50 p-3">
                  <span className="text-[var(--color-muted)] block">Novos Lançamentos</span>
                  <span className="text-lg font-bold text-emerald-600">{resultado.novas_transacoes}</span>
                </div>
                <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]/50 p-3">
                  <span className="text-[var(--color-muted)] block">Já Cadastrados (Duplicados)</span>
                  <span className="text-lg font-bold text-slate-600">{resultado.duplicadas_ignoradas}</span>
                </div>
                <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]/50 p-3">
                  <span className="text-[var(--color-muted)] block">Pagamentos de Fatura</span>
                  <span className="text-sm font-semibold text-slate-700">
                    {resultado.pagamentos_fatura_ignorados} ignorados
                  </span>
                </div>
                <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]/50 p-3">
                  <span className="text-[var(--color-muted)] block">Filtro de Fatura</span>
                  <span className="text-sm font-semibold text-sky-700">{resultado.mes_fatura}</span>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleConcluir}
                  className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors shadow-xs"
                >
                  Concluir e Atualizar Tela
                </button>
              </div>
            </div>
          ) : loadingCartoes ? (
            <div className="flex flex-col items-center justify-center py-8 text-center text-sm text-[var(--color-muted)] space-y-2">
              <RefreshCw className="h-6 w-6 animate-spin text-sky-600" />
              <p>Carregando cartões disponíveis no Open Finance...</p>
            </div>
          ) : cartoes.length === 0 ? (
            <div className="py-6 text-center space-y-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600 border border-amber-200">
                <CreditCard className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-[var(--color-text)]">Nenhum cartão conectado</h4>
                <p className="text-xs text-[var(--color-muted)] max-w-xs mx-auto">
                  Você ainda não possui cartões de crédito configurados no Open Finance para sincronização direta.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose()
                  navigate('/configuracoes')
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text)] hover:bg-[var(--color-border)]/50 transition-colors"
              >
                Configurar no Open Finance <ExternalLink className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <>
              {/* Seleção do Cartão */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--color-muted)] block">
                  1. Qual cartão deseja sincronizar?
                </label>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {cartoes.map((c) => {
                    const isSelected = cartaoSelecionadoId === c.forma_pagamento_id
                    return (
                      <div
                        key={c.conta_map_id}
                        onClick={() => setCartaoSelecionadoId(c.forma_pagamento_id)}
                        className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${
                          isSelected
                            ? 'border-sky-500 bg-sky-50/70 shadow-xs'
                            : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-bg)]/50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <BankCardIcon
                            icone={c.forma_pagamento_icone}
                            cor={c.forma_pagamento_cor}
                            nome={c.forma_pagamento_nome}
                            size="md"
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-[var(--color-text)]">
                                {c.forma_pagamento_nome}
                              </span>
                              <span className="text-[10px] font-medium text-[var(--color-muted)] bg-[var(--color-bg)] px-1.5 py-0.5 rounded border border-[var(--color-border)]">
                                {c.conexao_nome}
                              </span>
                            </div>
                            <span className="text-xs text-[var(--color-muted)] block">
                              Fecha dia {c.dia_fechamento || 28} • Vence dia {c.dia_vencimento || 5}
                            </span>
                          </div>
                        </div>

                        <input
                          type="radio"
                          name="cartao_selecionado"
                          checked={isSelected}
                          onChange={() => setCartaoSelecionadoId(c.forma_pagamento_id)}
                          className="h-4 w-4 text-sky-600 focus:ring-sky-500"
                        />
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Seleção do Período */}
              <div className="space-y-2 pt-2 border-t border-[var(--color-border)]">
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--color-muted)] block">
                  2. Período da fatura a sincronizar:
                </label>
                <div className="space-y-2">
                  <label
                    className={`flex items-start gap-3 p-2.5 rounded-lg border cursor-pointer transition-all ${
                      modoPeriodo === 'mes_corrente'
                        ? 'border-sky-500 bg-sky-50/50'
                        : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-bg)]/40'
                    }`}
                  >
                    <input
                      type="radio"
                      name="modo_periodo"
                      value="mes_corrente"
                      checked={modoPeriodo === 'mes_corrente'}
                      onChange={() => setModoPeriodo('mes_corrente')}
                      className="mt-0.5 h-4 w-4 text-sky-600 focus:ring-sky-500"
                    />
                    <div className="text-xs">
                      <span className="font-semibold text-[var(--color-text)] block">
                        Fatura do mês corrente ({mesCorrenteLabel})
                      </span>
                      <span className="text-[var(--color-muted)]">
                        Sincroniza apenas as compras que compõem a fatura atual com vencimento neste mês.
                      </span>
                    </div>
                  </label>

                  {ehMesesDiferentes ? (
                    <label
                      className={`flex items-start gap-3 p-2.5 rounded-lg border cursor-pointer transition-all ${
                        modoPeriodo === 'mes_tela'
                          ? 'border-sky-500 bg-sky-50/50'
                          : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-bg)]/40'
                      }`}
                    >
                      <input
                        type="radio"
                        name="modo_periodo"
                        value="mes_tela"
                        checked={modoPeriodo === 'mes_tela'}
                        onChange={() => setModoPeriodo('mes_tela')}
                        className="mt-0.5 h-4 w-4 text-sky-600 focus:ring-sky-500"
                      />
                      <div className="text-xs">
                        <span className="font-semibold text-[var(--color-text)] block">
                          Fatura do mês filtrado na tela ({mesTelaLabel})
                        </span>
                        <span className="text-[var(--color-muted)]">
                          Sincroniza as compras da fatura do mês selecionado no filtro de transações.
                        </span>
                      </div>
                    </label>
                  ) : null}

                  <label
                    className={`flex items-start gap-3 p-2.5 rounded-lg border cursor-pointer transition-all ${
                      modoPeriodo === 'todos'
                        ? 'border-sky-500 bg-sky-50/50'
                        : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-bg)]/40'
                    }`}
                  >
                    <input
                      type="radio"
                      name="modo_periodo"
                      value="todos"
                      checked={modoPeriodo === 'todos'}
                      onChange={() => setModoPeriodo('todos')}
                      className="mt-0.5 h-4 w-4 text-sky-600 focus:ring-sky-500"
                    />
                    <div className="text-xs">
                      <span className="font-semibold text-[var(--color-text)] block">
                        Todas as faturas recentes (últimos 90 dias)
                      </span>
                      <span className="text-[var(--color-muted)]">
                        Atualiza compras recentes e parcelas de faturas passadas e futuras.
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[var(--color-border)]">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loadingSync}
                  className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-xs font-semibold text-[var(--color-text)] hover:bg-[var(--color-bg)] transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSincronizar}
                  disabled={loadingSync || !cartaoSelecionadoId}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-700 transition-colors shadow-xs disabled:opacity-50"
                >
                  {loadingSync ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      <span>Sincronizando com o banco...</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-3.5 w-3.5" />
                      <span>Sincronizar Agora</span>
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
