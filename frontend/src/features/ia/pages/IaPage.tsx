import { useState } from 'react'

import { iaService } from '@/features/ia/services/iaService'
import { getErrorMessage } from '@/shared/utils/error'

export function IaPage() {
  const [texto, setTexto] = useState('')
  const [resultado, setResultado] = useState<string[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const classificar = async () => {
    const descricoes = texto
      .split('\n')
      .map((linha) => linha.trim())
      .filter(Boolean)

    if (descricoes.length === 0) {
      setErro('Informe ao menos uma descrição (uma por linha).')
      return
    }

    setLoading(true)
    setErro(null)

    try {
      const data = await iaService.classificarCategorias({ descricoes })
      setResultado(data.categorias)
      if (data.erro) setErro(data.erro)
    } catch (err) {
      setErro(getErrorMessage(err, 'Não foi possível classificar as descrições.'))
    } finally {
      setLoading(false)
    }
  }

  const linhas = texto
    .split('\n')
    .map((linha) => linha.trim())
    .filter(Boolean)

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold text-[var(--color-text)]">IA · Classificação</h2>
        <p className="text-sm text-[var(--color-muted)]">Classifique descrições em categorias existentes no sistema.</p>
      </header>

      <article className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <textarea
          rows={10}
          value={texto}
          onChange={(event) => setTexto(event.target.value)}
          placeholder="Uma descrição por linha..."
          className="w-full resize-y rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-sm"
        />
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={classificar}
            className="rounded-[var(--radius-sm)] bg-[var(--color-primary)] px-3 py-2 text-sm font-semibold text-white"
          >
            {loading ? 'Classificando...' : 'Classificar'}
          </button>
          <button
            type="button"
            onClick={() => {
              setTexto('')
              setResultado([])
              setErro(null)
            }}
            className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-sm"
          >
            Limpar
          </button>
        </div>
        {erro ? <p className="mt-3 text-sm text-rose-600">{erro}</p> : null}
      </article>

      <article className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">Resultado</h3>
        {resultado.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">Nenhuma classificação ainda.</p>
        ) : (
          <>
            <div className="mb-3 space-y-2 md:hidden">
              {resultado.map((categoria, idx) => (
                <article
                  key={idx}
                  className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3"
                >
                  <p className="text-xs text-[var(--color-muted)]">Descrição</p>
                  <p className="text-sm font-medium text-[var(--color-text)]">{linhas[idx] ?? '-'}</p>
                  <p className="mt-2 text-xs text-[var(--color-muted)]">Categoria sugerida</p>
                  <p className="text-sm font-semibold text-[var(--color-text)]">{categoria}</p>
                </article>
              ))}
            </div>

            <div className="overflow-x-auto">
            <table className="hidden min-w-full border-collapse text-sm md:table">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-left">
                  <th className="py-2 pr-3">Descrição</th>
                  <th className="py-2 pr-3">Categoria sugerida</th>
                </tr>
              </thead>
              <tbody>
                {resultado.map((categoria, idx) => (
                  <tr key={idx} className="border-b border-[var(--color-border)]/70">
                    <td className="py-2 pr-3">{linhas[idx] ?? '-'}</td>
                    <td className="py-2 pr-3">{categoria}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </>
        )}
      </article>
    </section>
  )
}
