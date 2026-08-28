import { Suspense } from 'react'
import { Link, useParams } from 'react-router-dom'

import { buscarRelatorio } from '@/features/relatorios/reports/registry'

export function RelatorioDetalhePage() {
  const { id } = useParams<{ id: string }>()
  const relatorio = id ? buscarRelatorio(id) : null

  if (!relatorio) {
    return (
      <section className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center">
        <p className="text-sm text-[var(--color-muted)]">Relatório não encontrado.</p>
        <Link to="/relatorios" className="mt-3 inline-block text-sm font-medium text-[var(--color-primary)] hover:underline">
          Voltar para a central de relatórios
        </Link>
      </section>
    )
  }

  const Componente = relatorio.Componente

  return (
    <Suspense
      fallback={
        <p className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center text-sm text-[var(--color-muted)]">
          Carregando relatório...
        </p>
      }
    >
      <Componente />
    </Suspense>
  )
}
