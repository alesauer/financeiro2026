import { useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'

import { useAuth } from '@/app/providers/AuthProvider'
import { milhasService } from '@/features/milhas/services/milhasService'
import type { Milha, MilhaPayload, MilhaTipo } from '@/shared/types/milha'
import { formatDateBr } from '@/shared/utils/date'
import { getErrorMessage } from '@/shared/utils/error'

const TIPOS: MilhaTipo[] = ['entrada', 'saida']

const EMPTY_FORM: MilhaPayload = {
  programa: '',
  tipo: 'entrada',
  quantidade: 0,
  origem: null,
  data_movimentacao: null,
  data_expiracao: null,
  descricao: null,
}

export function MilhasPage() {
  const { token } = useAuth()

  const [items, setItems] = useState<Milha[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<MilhaPayload>(EMPTY_FORM)
  const [isFormOpen, setIsFormOpen] = useState(false)

  const carregar = async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const data = await milhasService.list(token, 1, 50)
      setItems(data.items)
    } catch (err) {
      setError(getErrorMessage(err, 'Não foi possível carregar milhas.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregar()
  }, [token])

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

  const carregarParaEditar = async (id: number) => {
    if (!token) return
    try {
      const item = await milhasService.get(token, id)
      setEditingId(item.id)
      setIsFormOpen(true)
      setForm({
        programa: item.programa,
        tipo: item.tipo,
        quantidade: item.quantidade,
        origem: item.origem,
        data_movimentacao: item.data_movimentacao,
        data_expiracao: item.data_expiracao,
        descricao: item.descricao,
      })
    } catch (err) {
      setError(getErrorMessage(err, 'Não foi possível carregar movimentação para edição.'))
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!token) return

    if (!form.programa.trim() || !form.quantidade || form.quantidade <= 0) {
      setError('Informe programa e quantidade válida (> 0).')
      return
    }

    const payload: MilhaPayload = {
      ...form,
      programa: form.programa.trim(),
      origem: form.origem?.trim() || null,
      descricao: form.descricao?.trim() || null,
    }

    try {
      if (editingId) {
        await milhasService.update(token, editingId, payload)
      } else {
        await milhasService.create(token, payload)
      }
      resetForm()
      setIsFormOpen(false)
      await carregar()
    } catch (err) {
      setError(getErrorMessage(err, 'Não foi possível salvar movimentação de milhas.'))
    }
  }

  const handleDelete = async (id: number) => {
    if (!token) return
    if (!window.confirm('Confirma a exclusão desta movimentação?')) return

    try {
      await milhasService.remove(token, id)
      await carregar()
      if (editingId === id) cancelarFormulario()
    } catch (err) {
      setError(getErrorMessage(err, 'Não foi possível excluir movimentação de milhas.'))
    }
  }

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold text-[var(--color-text)]">Milhas</h2>
        <p className="text-sm text-[var(--color-muted)]">Controle entradas e saídas de programas de milhagem.</p>
      </header>

      <article className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">Movimentações</h3>
          <button
            type="button"
            onClick={abrirNovoFormulario}
            className="rounded-[var(--radius-sm)] bg-[var(--color-primary)] px-3 py-2 text-sm font-semibold text-white"
          >
            Nova movimentação
          </button>
        </div>

        {isFormOpen ? (
          <div className="mb-4 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)]/30 p-4">
            <h4 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">
              {editingId ? 'Editar movimentação' : 'Nova movimentação'}
            </h4>

            <form className="space-y-3" onSubmit={handleSubmit}>
            <Field label="Programa">
              <input
                value={form.programa}
                onChange={(event) => setForm((prev) => ({ ...prev, programa: event.target.value }))}
                className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-sm"
              />
            </Field>

            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <Field label="Tipo">
                <select
                  value={form.tipo}
                  onChange={(event) => setForm((prev) => ({ ...prev, tipo: event.target.value as MilhaTipo }))}
                  className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-sm"
                >
                  {TIPOS.map((tipo) => (
                    <option key={tipo} value={tipo}>
                      {tipo === 'entrada' ? 'Entrada' : 'Saída'}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Quantidade">
                <input
                  type="number"
                  min={1}
                  value={form.quantidade || ''}
                  onChange={(event) => setForm((prev) => ({ ...prev, quantidade: Number(event.target.value) }))}
                  className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-sm"
                />
              </Field>
            </div>

            <Field label="Origem">
              <input
                value={form.origem ?? ''}
                onChange={(event) => setForm((prev) => ({ ...prev, origem: event.target.value || null }))}
                className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-sm"
              />
            </Field>

            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <Field label="Data movimentação">
                <input
                  type="date"
                  value={form.data_movimentacao ?? ''}
                  onChange={(event) => setForm((prev) => ({ ...prev, data_movimentacao: event.target.value || null }))}
                  className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-sm"
                />
              </Field>
              <Field label="Data expiração">
                <input
                  type="date"
                  value={form.data_expiracao ?? ''}
                  onChange={(event) => setForm((prev) => ({ ...prev, data_expiracao: event.target.value || null }))}
                  className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-sm"
                />
              </Field>
            </div>

            <Field label="Descrição">
              <textarea
                rows={3}
                value={form.descricao ?? ''}
                onChange={(event) => setForm((prev) => ({ ...prev, descricao: event.target.value || null }))}
                className="w-full resize-y rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-sm"
              />
            </Field>

            <div className="flex items-center gap-2 pt-2">
              <button className="rounded-[var(--radius-sm)] bg-[var(--color-primary)] px-3 py-2 text-sm font-semibold text-white">
                {editingId ? 'Salvar alterações' : 'Adicionar'}
              </button>
              <button
                type="button"
                onClick={cancelarFormulario}
                className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-sm"
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
          ) : items.length === 0 ? (
            <p className="mb-3 text-sm text-[var(--color-muted)] md:hidden">Nenhuma movimentação encontrada.</p>
          ) : (
            <div className="mb-3 space-y-2 md:hidden">
              {items.map((item) => (
                <article
                  key={item.id}
                  className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3"
                >
                  <p className="text-sm font-semibold text-[var(--color-text)]">{item.programa}</p>
                  <div className="mt-1 space-y-0.5 text-xs text-[var(--color-muted)]">
                    <p>Tipo: {item.tipo === 'entrada' ? 'Entrada' : 'Saída'}</p>
                    <p>Qtd: {item.quantidade}</p>
                    <p>Data mov.: {formatDateBr(item.data_movimentacao)}</p>
                    <p>Expira: {formatDateBr(item.data_expiracao)}</p>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => carregarParaEditar(item.id)}
                      className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-2 py-1 text-xs"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(item.id)}
                      className="rounded-[var(--radius-sm)] border border-rose-200 px-2 py-1 text-xs text-rose-600"
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
                  <th className="py-2 pr-3">Programa</th>
                  <th className="py-2 pr-3">Tipo</th>
                  <th className="py-2 pr-3">Qtd</th>
                  <th className="py-2 pr-3">Data mov.</th>
                  <th className="py-2 pr-3">Expira</th>
                  <th className="py-2 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-4 text-center text-[var(--color-muted)]">
                      Carregando...
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-4 text-center text-[var(--color-muted)]">
                      Nenhuma movimentação encontrada.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr key={item.id} className="border-b border-[var(--color-border)]/70">
                      <td className="py-2 pr-3">{item.programa}</td>
                      <td className="py-2 pr-3">{item.tipo === 'entrada' ? 'Entrada' : 'Saída'}</td>
                      <td className="py-2 pr-3">{item.quantidade}</td>
                      <td className="py-2 pr-3">{formatDateBr(item.data_movimentacao)}</td>
                      <td className="py-2 pr-3">{formatDateBr(item.data_expiracao)}</td>
                      <td className="py-2 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => carregarParaEditar(item.id)}
                            className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-2 py-1 text-xs"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(item.id)}
                            className="rounded-[var(--radius-sm)] border border-rose-200 px-2 py-1 text-xs text-rose-600"
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

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1 text-sm">
      <span className="font-medium">{label}</span>
      {children}
    </label>
  )
}
