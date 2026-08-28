import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'

import { GRUPOS, RELATORIOS } from '@/features/relatorios/reports/registry'

export function RelatoriosPage() {
  return (
    <section className="space-y-6">
      <header className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <h2 className="text-2xl font-semibold text-[var(--color-text)]">Central de relatórios</h2>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Escolha um relatório para abrir a análise completa, com filtros e exportação em CSV, XLSX e PDF.
        </p>
      </header>

      {GRUPOS.map((grupo) => {
        const itens = RELATORIOS.filter((r) => r.grupo === grupo)
        return (
          <div key={grupo} className="space-y-3">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">{grupo}</h3>
              <span className="rounded-full bg-[var(--color-surface)] px-2 py-0.5 text-xs text-[var(--color-muted)] ring-1 ring-[var(--color-border)]">
                {itens.length}
              </span>
              <div className="h-px flex-1 bg-[var(--color-border)]" />
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {itens.map((relatorio) => {
                const Icone = relatorio.icone
                return (
                  <Link
                    key={relatorio.id}
                    to={`/relatorios/${relatorio.id}`}
                    className="group flex flex-col rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 transition-all hover:-translate-y-0.5 hover:border-[var(--color-primary)]/50 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span
                        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-sm)]"
                        style={{ backgroundColor: `${relatorio.cor}1a`, color: relatorio.cor }}
                      >
                        <Icone size={20} />
                      </span>
                      <ArrowRight
                        size={16}
                        className="mt-1 text-[var(--color-muted)] opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100"
                      />
                    </div>

                    <h4 className="mt-3 text-sm font-semibold text-[var(--color-text)] group-hover:text-[var(--color-primary)]">
                      {relatorio.titulo}
                    </h4>
                    <p className="mt-1 text-xs leading-relaxed text-[var(--color-muted)]">{relatorio.descricao}</p>
                  </Link>
                )
              })}
            </div>
          </div>
        )
      })}
    </section>
  )
}
