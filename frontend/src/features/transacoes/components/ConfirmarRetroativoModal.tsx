import { X } from 'lucide-react'
import { formatCurrency } from '@/shared/utils/date'

interface ConfirmarRetroativoModalProps {
  open: boolean
  estabelecimento: string
  categoriaNome: string
  quantidade: number
  amostraItens: Array<{
    id: number
    descricao: string
    data_transacao: string | null
    valor: number
    categoria_atual: string
  }>
  onConfirm: (alterarAnteriores: boolean) => void
  onCancel: () => void
}

export function ConfirmarRetroativoModal({
  open,
  estabelecimento,
  categoriaNome,
  quantidade,
  amostraItens,
  onConfirm,
  onCancel,
}: ConfirmarRetroativoModalProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl">
        {/* Cabecalho */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-slate-50/70 px-5 py-4">
          <div>
            <h3 className="text-base font-bold text-[var(--color-text)]">
              Alterar categoria dos meses anteriores?
            </h3>
            <p className="text-xs text-[var(--color-muted)]">
              Identificamos lançamentos passados neste mesmo estabelecimento.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg p-1.5 text-[var(--color-muted)] hover:bg-slate-200/60 hover:text-[var(--color-text)] cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Corpo */}
        <div className="space-y-4 px-5 py-4 text-xs">
          <p className="text-sm text-[var(--color-text)]">
            Você está alterando a categoria deste lançamento para{' '}
            <strong className="text-emerald-700">{categoriaNome}</strong>.
          </p>

          <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3.5 text-amber-950">
            <p className="font-semibold">
              Existem <strong>{quantidade}</strong> {quantidade === 1 ? 'transação anterior' : 'transações anteriores'} em{' '}
              <span className="font-bold underline decoration-amber-400">{estabelecimento}</span> com outras categorias.
            </p>
            <p className="mt-1 text-[11px] text-amber-800">
              Deseja atualizar também essas transações dos meses anteriores para manter seu histórico padronizado?
            </p>
          </div>

          {amostraItens.length > 0 ? (
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold uppercase text-[var(--color-muted)]">
                Exemplos de transações encontradas:
              </span>
              <div className="max-h-36 overflow-y-auto rounded-lg border border-[var(--color-border)] bg-white divide-y divide-[var(--color-border)]/60">
                {amostraItens.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-2 text-[11px]">
                    <div className="min-w-0 pr-2">
                      <p className="truncate font-semibold text-[var(--color-text)]">{item.descricao}</p>
                      <p className="text-[10px] text-[var(--color-muted)]">
                        {item.data_transacao} • Categoria atual: <span className="font-medium text-rose-600">{item.categoria_atual}</span>
                      </p>
                    </div>
                    <span className="shrink-0 font-bold tabular-nums text-[var(--color-text)]">
                      {formatCurrency(item.valor)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {/* Rodape com escolhas claras */}
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--color-border)] bg-slate-50 px-5 py-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-[var(--color-border)] bg-white px-3.5 py-2 text-xs font-medium text-[var(--color-text)] hover:bg-slate-100 cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onConfirm(false)}
            className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-[var(--color-text)] hover:bg-slate-100 cursor-pointer shadow-2xs"
          >
            Apenas este mês
          </button>
          <button
            type="button"
            onClick={() => onConfirm(true)}
            className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-800 cursor-pointer"
          >
            Alterar este e anteriores ({quantidade})
          </button>
        </div>
      </div>
    </div>
  )
}
