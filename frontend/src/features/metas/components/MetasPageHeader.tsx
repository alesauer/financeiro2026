import type { ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'

import { MESES_LISTA, navegarPeriodo } from '@/features/metas/utils/calculosMetas'

interface MetasPageHeaderProps {
  subtitulo: string
  mes?: number
  ano?: number
  onChangePeriodo?: (mes: number, ano: number) => void
  rightActions?: ReactNode
}

export function MetasPageHeader({
  subtitulo,
  mes,
  ano,
  onChangePeriodo,
  rightActions,
}: MetasPageHeaderProps) {
  const opcoesPeriodo = (() => {
    if (!ano) return []
    const anos = [ano - 1, ano, ano + 1]
    const lista: { label: string; mes: number; ano: number; value: string }[] = []
    for (const a of anos) {
      for (const m of MESES_LISTA) {
        lista.push({
          label: `${m.nome} / ${a}`,
          mes: m.numero,
          ano: a,
          value: `${a}-${String(m.numero).padStart(2, '0')}`,
        })
      }
    }
    return lista
  })()

  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--color-border)] pb-4">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-lg sm:text-xl">
          <Link
            to="/metas"
            className="font-bold text-[var(--color-text)] hover:text-emerald-700 transition-colors"
          >
            Metas de Gastos
          </Link>
          <span className="text-[var(--color-muted)]">&gt;</span>
          <span className="font-medium text-[var(--color-muted)]">{subtitulo}</span>
        </div>

        {mes && ano && onChangePeriodo ? (
          <div className="inline-flex items-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-0.5 shadow-2xs">
            <button
              type="button"
              onClick={() => {
                const p = navegarPeriodo(mes, ano, -1)
                onChangePeriodo(p.mes, p.ano)
              }}
              className="rounded-md p-1.5 text-[var(--color-muted)] hover:bg-slate-100 hover:text-[var(--color-text)] cursor-pointer"
              aria-label="Mês anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <select
              value={`${ano}-${String(mes).padStart(2, '0')}`}
              onChange={(e) => {
                const [y, m] = e.target.value.split('-').map(Number)
                if (y && m) onChangePeriodo(m, y)
              }}
              className="bg-transparent px-3 py-1 text-xs font-semibold text-[var(--color-text)] outline-none cursor-pointer"
            >
              {opcoesPeriodo.map((op) => (
                <option key={op.value} value={op.value}>
                  {op.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => {
                const p = navegarPeriodo(mes, ano, 1)
                onChangePeriodo(p.mes, p.ano)
              }}
              className="rounded-md p-1.5 text-[var(--color-muted)] hover:bg-slate-100 hover:text-[var(--color-text)] cursor-pointer"
              aria-label="Próximo mês"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        ) : null}
      </div>

      {rightActions ? <div className="flex flex-wrap items-center gap-2">{rightActions}</div> : null}
    </header>
  )
}

