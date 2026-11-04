import { useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  ArrowRight,
  CalendarPlus,
  CheckCircle2,
  Loader2,
  X,
} from 'lucide-react'
import { transacoesService } from '@/features/transacoes/services/transacoesService'
import type {
  CopiarMesPreviewItem,
  TransacaoStatus,
} from '@/shared/types/transacao'
import { formatCurrency, formatMonthYearLabel, shiftMonth } from '@/shared/utils/date'
import { getErrorMessage } from '@/shared/utils/error'

interface CopiarMesModalProps {
  isOpen: boolean
  onClose: () => void
  token: string
  mesOrigemIso: string
  onCopied: (mesDestinoIso: string, irParaDestino: boolean) => void
}

type EditableCopyRow = CopiarMesPreviewItem & {
  selecionado: boolean
  valorEditado: string
  dataEditada: string
  statusEditado: TransacaoStatus
}

export function CopiarMesModal({
  isOpen,
  onClose,
  token,
  mesOrigemIso,
  onCopied,
}: CopiarMesModalProps) {
  const titleId = useId()
  const dialogRef = useRef<HTMLDialogElement>(null)

  const proximoMesDefault = useMemo(() => shiftMonth(mesOrigemIso, 1).isoMonth, [mesOrigemIso])
  const [mesDestino, setMesDestino] = useState(proximoMesDefault)
  const [rows, setRows] = useState<EditableCopyRow[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState<{ criadas: number; mesDestino: string } | null>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (isOpen) {
      if (!dialog.open) {
        dialog.showModal()
      }
      setMesDestino(shiftMonth(mesOrigemIso, 1).isoMonth)
      setSucesso(null)
      setError(null)
    } else if (dialog.open) {
      dialog.close()
    }
  }, [isOpen, mesOrigemIso])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const handleNativeClose = () => {
      dialog.returnValue = ''
      if (isOpen) onClose()
    }
    dialog.addEventListener('close', handleNativeClose)
    return () => dialog.removeEventListener('close', handleNativeClose)
  }, [isOpen, onClose])

  useEffect(() => {
    if (!isOpen || !token || !mesOrigemIso || !mesDestino) return
    let active = true
    setLoading(true)
    setError(null)

    transacoesService
      .previewCopiarMes(token, mesOrigemIso, mesDestino)
      .then((res) => {
        if (!active) return
        setRows(
          res.itens.map((item) => ({
            ...item,
            selecionado: !item.ja_existe,
            valorEditado: item.valor.toFixed(2),
            dataEditada: item.nova_data,
            statusEditado: item.novo_status,
          }))
        )
      })
      .catch((err) => {
        if (!active) return
        setError(getErrorMessage(err, 'Não foi possível carregar as transações do mês.'))
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [isOpen, token, mesOrigemIso, mesDestino])

  const selecionadas = useMemo(() => rows.filter((r) => r.selecionado), [rows])

  const totaisSelecionados = useMemo(() => {
    let receitas = 0
    let despesas = 0
    for (const r of selecionadas) {
      const val = Number(r.valorEditado) || 0
      if (r.tipo === 'Receita') receitas += val
      else despesas += val
    }
    return { receitas, despesas }
  }, [selecionadas])

  const toggleRow = (idOrigem: number) => {
    setRows((prev) =>
      prev.map((r) => (r.id_origem === idOrigem ? { ...r, selecionado: !r.selecionado } : r))
    )
  }

  const selecionarTodas = () => {
    setRows((prev) => prev.map((r) => ({ ...r, selecionado: true })))
  }

  const selecionarApenasNovas = () => {
    setRows((prev) => prev.map((r) => ({ ...r, selecionado: !r.ja_existe })))
  }

  const desmarcarTodas = () => {
    setRows((prev) => prev.map((r) => ({ ...r, selecionado: false })))
  }

  const handleConfirmarCopia = async (irParaDestino: boolean) => {
    if (selecionadas.length === 0) {
      setError('Selecione ao menos uma transação para copiar.')
      return
    }

    setSaving(true)
    setError(null)
    try {
      const payload = selecionadas.map((r) => ({
        id_origem: r.id_origem,
        valor: Number(r.valorEditado) || r.valor,
        data_transacao: r.dataEditada,
        status: r.statusEditado,
      }))
      const resp = await transacoesService.executarCopiarMes(token, mesDestino, payload)
      setSucesso({ criadas: resp.criadas, mesDestino: resp.mes_destino })
      onCopied(mesDestino, irParaDestino)
      if (irParaDestino) {
        onClose()
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Falha ao copiar transações para o mês seguinte.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      className="m-auto w-full max-w-4xl rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-0 text-[var(--color-text)] shadow-2xl backdrop:bg-slate-950/50 backdrop:backdrop-blur-xs"
    >
      <div className="flex max-h-[88vh] flex-col">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/10 text-teal-600">
              <CalendarPlus className="h-5 w-5" />
            </div>
            <div>
              <h3 id={titleId} className="text-base font-semibold text-[var(--color-text)]">
                Copiar Transações para Outro Mês
              </h3>
              <p className="text-xs text-[var(--color-muted)]">
                Selecione as receitas e contas fixas/variáveis que deseja projetar no mês seguinte.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar modal"
            className="rounded-lg p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)] transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Barra de Origem -> Destino e Ações Rápidas */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-bg)]/60 px-6 py-3">
          <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
            <span className="font-medium text-[var(--color-muted)]">Origem:</span>
            <span className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1 font-semibold text-[var(--color-text)]">
              {formatMonthYearLabel(mesOrigemIso)}
            </span>
            <ArrowRight className="h-4 w-4 text-[var(--color-muted)]" />
            <label htmlFor="copiar-mes-destino" className="font-medium text-[var(--color-muted)]">
              Destino:
            </label>
            <input
              id="copiar-mes-destino"
              type="month"
              value={mesDestino}
              onChange={(e) => {
                if (e.target.value) {
                  setSucesso(null)
                  setMesDestino(e.target.value)
                }
              }}
              className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1 text-xs sm:text-sm font-semibold text-teal-700 focus:border-teal-500 focus:outline-hidden"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <button
              type="button"
              onClick={selecionarApenasNovas}
              className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1 font-medium text-[var(--color-text)] hover:border-teal-400 hover:text-teal-700 transition cursor-pointer"
            >
              Apenas novas
            </button>
            <button
              type="button"
              onClick={selecionarTodas}
              className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1 font-medium text-[var(--color-text)] hover:border-teal-400 hover:text-teal-700 transition cursor-pointer"
            >
              Marcar todas
            </button>
            <button
              type="button"
              onClick={desmarcarTodas}
              className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1 font-medium text-[var(--color-muted)] hover:text-[var(--color-text)] transition cursor-pointer"
            >
              Desmarcar todas
            </button>
          </div>
        </div>

        {/* Corpo / Lista de Transações */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {error ? (
            <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-700">
              {error}
            </div>
          ) : null}

          {sucesso ? (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs font-medium text-emerald-800">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>
                  <strong>{sucesso.criadas}</strong>{' '}
                  {sucesso.criadas === 1 ? 'transação copiada' : 'transações copiadas'} com sucesso para{' '}
                  <strong>{formatMonthYearLabel(sucesso.mesDestino)}</strong>!
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  onCopied(sucesso.mesDestino, true)
                  onClose()
                }}
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition cursor-pointer"
              >
                <span>Ir para {formatMonthYearLabel(sucesso.mesDestino)}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : null}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-sm text-[var(--color-muted)]">
              <Loader2 className="mb-2 h-6 w-6 animate-spin text-teal-600" />
              <span>Carregando transações de {formatMonthYearLabel(mesOrigemIso)}...</span>
            </div>
          ) : rows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--color-border)] p-8 text-center text-sm text-[var(--color-muted)]">
              Nenhuma transação de conta (Receita / Pix / Boleto / Transferência) encontrada em{' '}
              <strong>{formatMonthYearLabel(mesOrigemIso)}</strong>.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg)]/80 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                    <th className="w-10 px-3 py-2.5 text-center">Sel.</th>
                    <th className="px-3 py-2.5">Descrição / Categoria</th>
                    <th className="px-3 py-2.5">Tipo</th>
                    <th className="px-3 py-2.5">Nova Data</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-3 py-2.5 text-right">Valor (R$)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]/60">
                  {rows.map((row) => (
                    <tr
                      key={row.id_origem}
                      className={`transition ${
                        row.selecionado ? 'bg-[var(--color-surface)]' : 'bg-slate-50/70 opacity-60'
                      }`}
                    >
                      <td className="px-3 py-2.5 text-center">
                        <input
                          type="checkbox"
                          checked={row.selecionado}
                          onChange={() => toggleRow(row.id_origem)}
                          aria-label={`Selecionar ${row.descricao}`}
                          className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-medium text-[var(--color-text)]">{row.descricao}</span>
                          {row.ja_existe ? (
                            <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                              Já existe em {formatMonthYearLabel(mesDestino)}
                            </span>
                          ) : null}
                        </div>
                        <p className="text-[11px] text-[var(--color-muted)]">
                          {row.categoria_nome} · {row.forma_pagamento_nome}
                        </p>
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            row.tipo === 'Receita'
                              ? 'bg-emerald-50 text-emerald-700'
                              : row.tipo === 'Investimento'
                              ? 'bg-indigo-50 text-indigo-700'
                              : 'bg-rose-50 text-rose-700'
                          }`}
                        >
                          {row.tipo}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <input
                          type="date"
                          value={row.dataEditada}
                          onChange={(e) => {
                            const val = e.target.value
                            setRows((prev) =>
                              prev.map((r) => (r.id_origem === row.id_origem ? { ...r, dataEditada: val } : r))
                            )
                          }}
                          className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-xs focus:border-teal-500 focus:outline-hidden"
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <select
                          value={row.statusEditado}
                          onChange={(e) => {
                            const st = e.target.value as TransacaoStatus
                            setRows((prev) =>
                              prev.map((r) => (r.id_origem === row.id_origem ? { ...r, statusEditado: st } : r))
                            )
                          }}
                          className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-xs focus:border-teal-500 focus:outline-hidden"
                        >
                          <option value="Pendente">Pendente</option>
                          <option value="Pago">Pago</option>
                        </select>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={row.valorEditado}
                          onChange={(e) => {
                            const val = e.target.value
                            setRows((prev) =>
                              prev.map((r) => (r.id_origem === row.id_origem ? { ...r, valorEditado: val } : r))
                            )
                          }}
                          className="w-28 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-right text-xs font-semibold tabular-nums focus:border-teal-500 focus:outline-hidden"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Rodapé com Resumo e Botões de Confirmação */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[var(--color-border)] bg-[var(--color-bg)]/50 px-6 py-4">
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <span className="font-semibold text-[var(--color-text)]">
              {selecionadas.length} de {rows.length} selecionadas
            </span>
            <span className="text-emerald-700 font-medium">
              Receitas: <strong>{formatCurrency(totaisSelecionados.receitas)}</strong>
            </span>
            <span className="text-rose-700 font-medium">
              Despesas/Inv.: <strong>{formatCurrency(totaisSelecionados.despesas)}</strong>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-xs sm:text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-bg)] transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={saving || selecionadas.length === 0}
              onClick={() => handleConfirmarCopia(false)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-teal-600 bg-teal-50 px-4 py-2 text-xs sm:text-sm font-semibold text-teal-800 hover:bg-teal-100 transition disabled:opacity-50 cursor-pointer"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              <span>Copiar e permanecer no mês</span>
            </button>
            <button
              type="button"
              disabled={saving || selecionadas.length === 0}
              onClick={() => handleConfirmarCopia(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-sm hover:opacity-95 transition disabled:opacity-50 cursor-pointer"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarPlus className="h-4 w-4" />}
              <span>Copiar e ir p/ {formatMonthYearLabel(mesDestino)}</span>
            </button>
          </div>
        </div>
      </div>
    </dialog>
  )
}

