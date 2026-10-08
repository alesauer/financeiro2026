import { useState } from 'react'
import {
  Calendar,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  ArrowDownRight,
  Receipt,
  Layers,
} from 'lucide-react'
import type { FaturaCartao } from '@/shared/types/transacao'
import { formatCurrency } from '@/shared/utils/date'
import { BankCardIcon } from '@/shared/components/BankCardIcon'

interface FaturaCardProps {
  fatura: FaturaCartao
  onAbrirDrawer: (fatura: FaturaCartao) => void
  onQuitarFatura?: (fatura: FaturaCartao, status: 'Pago' | 'Pendente') => Promise<void>
}

export function FaturaCard({ fatura, onAbrirDrawer, onQuitarFatura }: FaturaCardProps) {
  const [loading, setLoading] = useState(false)

  const isQuitada = fatura.status_fatura === 'Pago'
  const isParcial = fatura.status_fatura === 'Parcial'

  const handleQuitar = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!onQuitarFatura) return
    setLoading(true)
    try {
      const novoStatus = isQuitada ? 'Pendente' : 'Pago'
      await onQuitarFatura(fatura, novoStatus)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      onClick={() => onAbrirDrawer(fatura)}
      className="group flex flex-col md:flex-row md:items-center justify-between gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2.5 shadow-xs transition hover:border-teal-500 hover:shadow-sm cursor-pointer"
    >
      {/* 1. Cartão + Status */}
      <div className="flex items-center gap-3 shrink-0">
        <BankCardIcon
          icone={fatura.forma_pagamento_icone}
          cor={fatura.forma_pagamento_cor}
          nome={fatura.cartao_nome}
          size="md"
        />
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-[var(--color-text)]">{fatura.cartao_nome}</span>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                isQuitada
                  ? 'bg-emerald-100 text-emerald-800'
                  : isParcial
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-rose-100 text-rose-800'
              }`}
            >
              {isQuitada ? (
                <>
                  <CheckCircle2 className="h-3 w-3" /> Paga
                </>
              ) : isParcial ? (
                <>
                  <Clock className="h-3 w-3" /> Parcial
                </>
              ) : (
                <>
                  <AlertCircle className="h-3 w-3" /> A Pagar
                </>
              )}
            </span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-[var(--color-muted)]">
            <span className="flex items-center gap-1">
              <Layers className="h-3 w-3" />
              {fatura.qtd_transacoes} lançamentos
            </span>
            {fatura.qtd_estornos > 0 && (
              <span className="inline-flex items-center gap-0.5 font-semibold text-emerald-700">
                <ArrowDownRight className="h-3 w-3" /> {fatura.qtd_estornos} estorno(s)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 2. Datas: Vencimento + Ciclo */}
      <div className="flex items-center gap-4 text-xs text-[var(--color-muted)]">
        <div className="flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5 text-teal-600 shrink-0" />
          <span>Vencimento:</span>
          <strong className="text-teal-700 font-bold">{fatura.data_vencimento_label}</strong>
        </div>
        {fatura.periodo_compras_label && (
          <div className="hidden lg:flex items-center gap-1 text-[11px]">
            <span>Ciclo:</span>
            <span className="text-[var(--color-text)] font-medium">{fatura.periodo_compras_label}</span>
          </div>
        )}
      </div>

      {/* 3. Valores + Ações */}
      <div className="flex items-center justify-between md:justify-end gap-3 shrink-0">
        <div className="text-right">
          <div className="flex items-baseline gap-1.5 justify-end">
            <span className="text-[11px] text-[var(--color-muted)] font-medium">Total:</span>
            <span className="text-sm font-bold text-[var(--color-text)]">{formatCurrency(fatura.total)}</span>
          </div>
          {fatura.total_pendentes > 0 && fatura.total_pagas > 0 ? (
            <p className="text-[10px] text-amber-700 font-semibold">
              Saldo: {formatCurrency(fatura.total_pendentes)}
            </p>
          ) : null}
        </div>

        <div className="flex items-center gap-1.5">
          {onQuitarFatura && (
            <button
              type="button"
              disabled={loading}
              onClick={handleQuitar}
              title={isQuitada ? 'Reabrir fatura como pendente' : 'Marcar fatura como paga'}
              className={`inline-flex items-center gap-1 rounded border px-2.5 py-1 text-xs font-semibold transition ${
                isQuitada
                  ? 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
              }`}
            >
              <CheckCircle2 className="h-3 w-3" />
              <span>{isQuitada ? 'Reabrir' : 'Dar Baixa'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onAbrirDrawer(fatura)
            }}
            className="inline-flex items-center gap-1 rounded bg-[var(--color-primary)] text-white px-2.5 py-1 text-xs font-semibold shadow-xs hover:opacity-95 transition"
          >
            <Receipt className="h-3 w-3" />
            <span>Ver Fatura</span>
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  )
}
