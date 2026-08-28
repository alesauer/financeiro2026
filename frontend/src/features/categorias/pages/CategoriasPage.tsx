import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'

import { useAuth } from '@/app/providers/AuthProvider'
import { categoriasService } from '@/features/categorias/services/categoriasService'
import type { Categoria, CategoriaPayload, CategoriaTipo } from '@/shared/types/categoria'
import { getErrorMessage } from '@/shared/utils/error'

const TIPOS: CategoriaTipo[] = ['Receita', 'Despesa', 'Investimento']

const EMPTY_FORM: CategoriaPayload = {
  nome: '',
  tipo: 'Despesa',
}

export function CategoriasPage() {
  const { token } = useAuth()
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filtroTipo, setFiltroTipo] = useState<CategoriaTipo | ''>('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<CategoriaPayload>(EMPTY_FORM)
  const [isFormOpen, setIsFormOpen] = useState(false)

  const formTitle = useMemo(() => (editingId ? 'Editar categoria' : 'Nova categoria'), [editingId])

  const carregarCategorias = async () => {
    if (!token) return
    setLoading(true)
    setError(null)

    try {
      const data = await categoriasService.list(token, filtroTipo)
      setCategorias(data)
    } catch (err) {
      setError(getErrorMessage(err, 'Não foi possível carregar categorias.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarCategorias()
  }, [token, filtroTipo])

  const resetForm = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  const abrirNovoFormulario = () => {
    resetForm()
    setIsFormOpen(true)
  }

  const cancelarFormulario = () => {
    resetForm()
    setIsFormOpen(false)
  }

  const handleEdit = (item: Categoria) => {
    setEditingId(item.id)
    setIsFormOpen(true)
    setForm({ nome: item.nome, tipo: item.tipo })
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!token) return
    if (!form.nome.trim()) {
      setError('Informe o nome da categoria.')
      return
    }

    setError(null)

    try {
      if (editingId) {
        await categoriasService.update(token, editingId, { nome: form.nome.trim(), tipo: form.tipo })
      } else {
        await categoriasService.create(token, { nome: form.nome.trim(), tipo: form.tipo })
      }
      resetForm()
      setIsFormOpen(false)
      await carregarCategorias()
    } catch (err) {
      setError(getErrorMessage(err, 'Não foi possível salvar categoria.'))
    }
  }

  const handleDelete = async (id: number) => {
    if (!token) return
    if (!window.confirm('Confirma a exclusão desta categoria?')) return

    try {
      await categoriasService.remove(token, id)
      await carregarCategorias()
      if (editingId === id) cancelarFormulario()
    } catch (err) {
      setError(getErrorMessage(err, 'Não foi possível excluir categoria.'))
    }
  }

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold text-[var(--color-text)]">Categorias</h2>
        <p className="text-sm text-[var(--color-muted)]">Gerencie categorias de receita, despesa e investimento.</p>
      </header>

      <article className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">Lista de categorias</h3>
          <div className="flex items-center gap-2">
            <select
              value={filtroTipo}
              onChange={(event) => setFiltroTipo(event.target.value as CategoriaTipo | '')}
              className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-sm"
            >
              <option value="">Todos os tipos</option>
              {TIPOS.map((tipo) => (
                <option key={tipo} value={tipo}>
                  {tipo}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={abrirNovoFormulario}
              className="rounded-[var(--radius-sm)] bg-[var(--color-primary)] px-3 py-2 text-sm font-semibold text-white"
            >
              Nova categoria
            </button>
          </div>
        </div>

        {isFormOpen ? (
          <div className="mb-4 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)]/30 p-4">
            <h4 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">{formTitle}</h4>
            <form className="space-y-3" onSubmit={handleSubmit}>
              <div className="space-y-1">
                <label htmlFor="categoria-nome" className="text-sm font-medium text-[var(--color-text)]">
                  Nome
                </label>
                <input
                  id="categoria-nome"
                  value={form.nome}
                  onChange={(event) => setForm((prev) => ({ ...prev, nome: event.target.value }))}
                  className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-sm outline-none ring-[var(--color-primary)]/30 transition focus:ring-4"
                  placeholder="Ex.: Moradia"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="categoria-tipo" className="text-sm font-medium text-[var(--color-text)]">
                  Tipo
                </label>
                <select
                  id="categoria-tipo"
                  value={form.tipo}
                  onChange={(event) => setForm((prev) => ({ ...prev, tipo: event.target.value as CategoriaTipo }))}
                  className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-sm outline-none ring-[var(--color-primary)]/30 transition focus:ring-4"
                >
                  {TIPOS.map((tipo) => (
                    <option key={tipo} value={tipo}>
                      {tipo}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  className="rounded-[var(--radius-sm)] bg-[var(--color-primary)] px-3 py-2 text-sm font-semibold text-white transition hover:opacity-90"
                >
                  {editingId ? 'Salvar alterações' : 'Adicionar'}
                </button>
                <button
                  type="button"
                  onClick={cancelarFormulario}
                  className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-sm font-medium"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        ) : null}

        {error ? <p className="mb-3 text-sm text-rose-600">{error}</p> : null}

        {editingId ? null : loading ? (
          <p className="mb-3 text-sm text-[var(--color-muted)] md:hidden">Carregando...</p>
        ) : categorias.length === 0 ? (
          <p className="mb-3 text-sm text-[var(--color-muted)] md:hidden">Nenhuma categoria encontrada.</p>
        ) : (
          <div className="mb-3 space-y-2 md:hidden">
            {categorias.map((categoria) => (
              <article
                key={categoria.id}
                className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3"
              >
                <p className="text-sm font-semibold text-[var(--color-text)]">{categoria.nome}</p>
                <p className="mt-1 text-xs text-[var(--color-muted)]">Tipo: {categoria.tipo}</p>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleEdit(categoria)}
                    className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-2 py-1 text-xs font-medium"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(categoria.id)}
                    className="rounded-[var(--radius-sm)] border border-rose-200 px-2 py-1 text-xs font-medium text-rose-600"
                  >
                    Excluir
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}

        {editingId ? null : <div className="overflow-x-auto">
          <table className="hidden min-w-full border-collapse text-sm md:table">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left">
                <th className="py-2 pr-3 font-semibold">Nome</th>
                <th className="py-2 pr-3 font-semibold">Tipo</th>
                <th className="py-2 text-right font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={3} className="py-4 text-center text-[var(--color-muted)]">
                    Carregando...
                  </td>
                </tr>
              ) : categorias.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-4 text-center text-[var(--color-muted)]">
                    Nenhuma categoria encontrada.
                  </td>
                </tr>
              ) : (
                categorias.map((categoria) => (
                  <tr key={categoria.id} className="border-b border-[var(--color-border)]/70">
                    <td className="py-2 pr-3">{categoria.nome}</td>
                    <td className="py-2 pr-3">{categoria.tipo}</td>
                    <td className="py-2 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleEdit(categoria)}
                          className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-2 py-1 text-xs font-medium"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(categoria.id)}
                          className="rounded-[var(--radius-sm)] border border-rose-200 px-2 py-1 text-xs font-medium text-rose-600"
                        >
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>}
      </article>
    </section>
  )
}
