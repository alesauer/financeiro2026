import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'

import { useAuth } from '@/app/providers/AuthProvider'
import { formasPagamentoService } from '@/features/formasPagamento/services/formasPagamentoService'
import type { FormaPagamento, FormaPagamentoPayload } from '@/shared/types/formaPagamento'
import { getErrorMessage } from '@/shared/utils/error'

const EMPTY_FORM: FormaPagamentoPayload = {
  nome: '',
  tipo: '',
  cartao_credito: false,
  dia_fechamento: null,
  dia_vencimento: null,
  ativo: true,
}

export function FormasPagamentoPage() {
  const { token } = useAuth()
  const [items, setItems] = useState<FormaPagamento[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<FormaPagamentoPayload>(EMPTY_FORM)
  const [isFormOpen, setIsFormOpen] = useState(false)

  const title = useMemo(() => (editingId ? 'Editar forma' : 'Nova forma'), [editingId])

  const load = async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const data = await formasPagamentoService.list(token)
      setItems(data)
    } catch (err) {
      setError(getErrorMessage(err, 'Não foi possível carregar formas de pagamento.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
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

  const handleEdit = (item: FormaPagamento) => {
    setEditingId(item.id)
    setIsFormOpen(true)
    setForm({
      nome: item.nome,
      tipo: item.tipo,
      cartao_credito: item.cartao_credito,
      dia_fechamento: item.dia_fechamento,
      dia_vencimento: item.dia_vencimento,
      ativo: item.ativo,
    })
  }

  const normalizeDay = (value: string) => {
    if (!value.trim()) return null
    const parsed = Number(value)
    return Number.isNaN(parsed) ? null : parsed
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!token) return

    if (!form.nome.trim() || !form.tipo.trim()) {
      setError('Preencha nome e tipo da forma de pagamento.')
      return
    }

    const payload: FormaPagamentoPayload = {
      nome: form.nome.trim(),
      tipo: form.tipo.trim(),
      cartao_credito: form.cartao_credito,
      ativo: form.ativo,
      dia_fechamento: form.cartao_credito ? form.dia_fechamento : null,
      dia_vencimento: form.cartao_credito ? form.dia_vencimento : null,
    }

    try {
      if (editingId) {
        await formasPagamentoService.update(token, editingId, payload)
      } else {
        await formasPagamentoService.create(token, payload)
      }
      resetForm()
      setIsFormOpen(false)
      await load()
    } catch (err) {
      setError(getErrorMessage(err, 'Não foi possível salvar forma de pagamento.'))
    }
  }

  const handleDelete = async (id: number) => {
    if (!token) return
    if (!window.confirm('Confirma a exclusão desta forma de pagamento?')) return

    try {
      await formasPagamentoService.remove(token, id)
      await load()
      if (editingId === id) cancelarFormulario()
    } catch (err) {
      setError(getErrorMessage(err, 'Não foi possível excluir forma de pagamento.'))
    }
  }

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold text-[var(--color-text)]">Formas de Pagamento</h2>
        <p className="text-sm text-[var(--color-muted)]">Configure cartões, contas e formas ativas para lançamentos.</p>
      </header>

      <article className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">Lista de formas</h3>
          <button
            type="button"
            onClick={abrirNovoFormulario}
            className="rounded-[var(--radius-sm)] bg-[var(--color-primary)] px-3 py-2 text-sm font-semibold text-white"
          >
            Nova forma
          </button>
        </div>

        {isFormOpen ? (
          <div className="mb-4 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)]/30 p-4">
            <h4 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">{title}</h4>
            <form className="space-y-3" onSubmit={handleSubmit}>
            <div className="space-y-1">
              <label className="text-sm font-medium">Nome</label>
              <input
                value={form.nome}
                onChange={(event) => setForm((prev) => ({ ...prev, nome: event.target.value }))}
                className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-sm"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Tipo</label>
              <input
                value={form.tipo}
                onChange={(event) => setForm((prev) => ({ ...prev, tipo: event.target.value }))}
                className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-sm"
                placeholder="Ex.: Pix, Cartão de Crédito"
              />
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.cartao_credito}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    cartao_credito: event.target.checked,
                    dia_fechamento: event.target.checked ? prev.dia_fechamento : null,
                    dia_vencimento: event.target.checked ? prev.dia_vencimento : null,
                  }))
                }
              />
              Cartão de crédito
            </label>

            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm font-medium">Dia fechamento</label>
                <input
                  type="number"
                  min={1}
                  max={31}
                  disabled={!form.cartao_credito}
                  value={form.dia_fechamento ?? ''}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      dia_fechamento: normalizeDay(event.target.value),
                    }))
                  }
                  className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-slate-100"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Dia vencimento</label>
                <input
                  type="number"
                  min={1}
                  max={31}
                  disabled={!form.cartao_credito}
                  value={form.dia_vencimento ?? ''}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      dia_vencimento: normalizeDay(event.target.value),
                    }))
                  }
                  className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-slate-100"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.ativo}
                onChange={(event) => setForm((prev) => ({ ...prev, ativo: event.target.checked }))}
              />
              Ativo
            </label>

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
            <p className="mb-3 text-sm text-[var(--color-muted)] md:hidden">Nenhuma forma de pagamento cadastrada.</p>
          ) : (
            <div className="mb-3 space-y-2 md:hidden">
              {items.map((item) => (
                <article
                  key={item.id}
                  className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3"
                >
                  <p className="text-sm font-semibold text-[var(--color-text)]">{item.nome}</p>
                  <div className="mt-1 space-y-0.5 text-xs text-[var(--color-muted)]">
                    <p>Tipo: {item.tipo}</p>
                    <p>Cartão: {item.cartao_credito ? 'Sim' : 'Não'}</p>
                    <p>Fechamento: {item.dia_fechamento ?? '-'}</p>
                    <p>Vencimento: {item.dia_vencimento ?? '-'}</p>
                    <p>Ativo: {item.ativo ? 'Sim' : 'Não'}</p>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleEdit(item)}
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
                  <th className="py-2 pr-3">Nome</th>
                  <th className="py-2 pr-3">Tipo</th>
                  <th className="py-2 pr-3">Cartão</th>
                  <th className="py-2 pr-3">Fechamento</th>
                  <th className="py-2 pr-3">Vencimento</th>
                  <th className="py-2 pr-3">Ativo</th>
                  <th className="py-2 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-4 text-center text-[var(--color-muted)]">
                      Carregando...
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-4 text-center text-[var(--color-muted)]">
                      Nenhuma forma de pagamento cadastrada.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr key={item.id} className="border-b border-[var(--color-border)]/70">
                      <td className="py-2 pr-3">{item.nome}</td>
                      <td className="py-2 pr-3">{item.tipo}</td>
                      <td className="py-2 pr-3">{item.cartao_credito ? 'Sim' : 'Não'}</td>
                      <td className="py-2 pr-3">{item.dia_fechamento ?? '-'}</td>
                      <td className="py-2 pr-3">{item.dia_vencimento ?? '-'}</td>
                      <td className="py-2 pr-3">{item.ativo ? 'Sim' : 'Não'}</td>
                      <td className="py-2 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleEdit(item)}
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
