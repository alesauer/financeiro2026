import { useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'

import { useAuth } from '@/app/providers/AuthProvider'
import { lembretesService } from '@/features/lembretes/services/lembretesService'
import type {
  Lembrete,
  LembreteDashboard,
  LembretePayload,
  LembretePrioridade,
  LembreteStatus,
} from '@/shared/types/lembrete'
import { formatDateBr } from '@/shared/utils/date'
import { getErrorMessage } from '@/shared/utils/error'

const STATUS: LembreteStatus[] = ['Pendente', 'Concluído']
const PRIORIDADES: LembretePrioridade[] = ['Baixa', 'Média', 'Alta']

const EMPTY_FORM: LembretePayload = {
  titulo: '',
  descricao: null,
  categoria: null,
  data_lembrete: null,
  hora_lembrete: null,
  status: 'Pendente',
  prioridade: 'Média',
}

export function LembretesPage() {
  const { token } = useAuth()

  const [dashboard, setDashboard] = useState<LembreteDashboard | null>(null)
  const [items, setItems] = useState<Lembrete[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [statusFiltro, setStatusFiltro] = useState<LembreteStatus | ''>('')
  const [prioridadeFiltro, setPrioridadeFiltro] = useState<LembretePrioridade | ''>('')
  const [busca, setBusca] = useState('')

  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<LembretePayload>(EMPTY_FORM)
  const [isFormOpen, setIsFormOpen] = useState(false)

  const tituloFormulario = useMemo(() => (editingId ? 'Editar lembrete' : 'Novo lembrete'), [editingId])

  const carregar = async () => {
    if (!token) return
    setLoading(true)
    setError(null)

    try {
      const [dash, lista] = await Promise.all([
        lembretesService.dashboard(token),
        lembretesService.list(token, {
          page: 1,
          per_page: 50,
          status: statusFiltro,
          prioridade: prioridadeFiltro,
          busca,
        }),
      ])

      setDashboard(dash)
      setItems(lista.items)
    } catch (err) {
      setError(getErrorMessage(err, 'Não foi possível carregar lembretes.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregar()
  }, [token, statusFiltro, prioridadeFiltro, busca])

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
      const item = await lembretesService.get(token, id)
      setEditingId(item.id)
      setIsFormOpen(true)
      setForm({
        titulo: item.titulo,
        descricao: item.descricao,
        categoria: item.categoria,
        data_lembrete: item.data_lembrete,
        hora_lembrete: item.hora_lembrete ? item.hora_lembrete.slice(0, 5) : null,
        status: item.status,
        prioridade: item.prioridade,
      })
    } catch (err) {
      setError(getErrorMessage(err, 'Não foi possível carregar lembrete para edição.'))
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!token) return

    if (!form.titulo.trim()) {
      setError('Informe o título do lembrete.')
      return
    }

    if (form.hora_lembrete && !form.data_lembrete) {
      setError('Para definir hora, informe também a data do lembrete.')
      return
    }

    const payload: LembretePayload = {
      ...form,
      titulo: form.titulo.trim(),
      descricao: form.descricao?.trim() || null,
      categoria: form.categoria?.trim() || null,
      hora_lembrete: form.hora_lembrete || null,
    }

    try {
      if (editingId) {
        await lembretesService.update(token, editingId, payload)
      } else {
        await lembretesService.create(token, payload)
      }
      resetForm()
      setIsFormOpen(false)
      await carregar()
    } catch (err) {
      setError(getErrorMessage(err, 'Não foi possível salvar lembrete.'))
    }
  }

  const toggleStatus = async (item: Lembrete) => {
    if (!token) return
    const novoStatus: LembreteStatus = item.status === 'Concluído' ? 'Pendente' : 'Concluído'
    try {
      await lembretesService.patchStatus(token, item.id, novoStatus)
      await carregar()
    } catch (err) {
      setError(getErrorMessage(err, 'Não foi possível atualizar status.'))
    }
  }

  const handleDelete = async (id: number) => {
    if (!token) return
    if (!window.confirm('Confirma a exclusão deste lembrete?')) return

    try {
      await lembretesService.remove(token, id)
      await carregar()
      if (editingId === id) cancelarFormulario()
    } catch (err) {
      setError(getErrorMessage(err, 'Não foi possível excluir lembrete.'))
    }
  }

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold text-[var(--color-text)]">Lembretes</h2>
        <p className="text-sm text-[var(--color-muted)]">Organize compromissos financeiros e tarefas recorrentes.</p>
      </header>

      {dashboard ? (
        <div className="grid gap-3 md:grid-cols-4">
          <Metric title="Total" value={dashboard.total} />
          <Metric title="Pendentes" value={dashboard.pendentes} />
          <Metric title="Concluídos" value={dashboard.concluidos} />
          <Metric title="Hoje" value={dashboard.hoje} />
        </div>
      ) : null}

      <article className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">Lembretes</h3>
          <button
            type="button"
            onClick={abrirNovoFormulario}
            className="rounded-[var(--radius-sm)] bg-[var(--color-primary)] px-3 py-2 text-sm font-semibold text-white"
          >
            Novo lembrete
          </button>
        </div>

        {isFormOpen ? (
          <div className="mb-4 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)]/30 p-4">
            <h4 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">{tituloFormulario}</h4>

            <form className="space-y-3" onSubmit={handleSubmit}>
            <Field label="Título">
              <input
                value={form.titulo}
                onChange={(event) => setForm((prev) => ({ ...prev, titulo: event.target.value }))}
                className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-sm"
              />
            </Field>

            <Field label="Categoria">
              <input
                value={form.categoria ?? ''}
                onChange={(event) => setForm((prev) => ({ ...prev, categoria: event.target.value || null }))}
                className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-sm"
              />
            </Field>

            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <Field label="Data">
                <input
                  type="date"
                  value={form.data_lembrete ?? ''}
                  onChange={(event) => setForm((prev) => ({ ...prev, data_lembrete: event.target.value || null }))}
                  className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-sm"
                />
              </Field>

              <Field label="Hora">
                <input
                  type="time"
                  value={form.hora_lembrete ?? ''}
                  onChange={(event) => setForm((prev) => ({ ...prev, hora_lembrete: event.target.value || null }))}
                  className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-sm"
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <Field label="Prioridade">
                <select
                  value={form.prioridade}
                  onChange={(event) => setForm((prev) => ({ ...prev, prioridade: event.target.value as LembretePrioridade }))}
                  className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-sm"
                >
                  {PRIORIDADES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Status">
                <select
                  value={form.status}
                  onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value as LembreteStatus }))}
                  className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-sm"
                >
                  {STATUS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
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

        {editingId ? null : <div className="mb-4 grid gap-2 md:grid-cols-4">
            <select
              value={statusFiltro}
              onChange={(event) => setStatusFiltro(event.target.value as LembreteStatus | '')}
              className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-sm"
            >
              <option value="">Todos status</option>
              {STATUS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <select
              value={prioridadeFiltro}
              onChange={(event) => setPrioridadeFiltro(event.target.value as LembretePrioridade | '')}
              className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-sm"
            >
              <option value="">Todas prioridades</option>
              {PRIORIDADES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <input
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
              placeholder="Buscar por título"
              className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() => {
                setStatusFiltro('')
                setPrioridadeFiltro('')
                setBusca('')
              }}
              className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-sm"
            >
              Limpar filtros
            </button>
        </div>}

        {error ? <p className="mb-3 text-sm text-rose-600">{error}</p> : null}

          {editingId ? null : loading ? (
            <p className="mb-3 text-sm text-[var(--color-muted)] md:hidden">Carregando...</p>
          ) : items.length === 0 ? (
            <p className="mb-3 text-sm text-[var(--color-muted)] md:hidden">Nenhum lembrete encontrado.</p>
          ) : (
            <div className="mb-3 space-y-2 md:hidden">
              {items.map((item) => (
                <article
                  key={item.id}
                  className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3"
                >
                  <p className="text-sm font-semibold text-[var(--color-text)]">{item.titulo}</p>
                  <div className="mt-1 space-y-0.5 text-xs text-[var(--color-muted)]">
                    <p>Categoria: {item.categoria ?? '-'}</p>
                    <p>
                      Quando: {formatDateBr(item.data_lembrete)} {item.hora_lembrete ? `· ${item.hora_lembrete.slice(0, 5)}` : ''}
                    </p>
                    <p>Prioridade: {item.prioridade}</p>
                    <p>Status: {item.status}</p>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleStatus(item)}
                      className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-2 py-1 text-xs"
                    >
                      {item.status === 'Concluído' ? 'Reabrir' : 'Concluir'}
                    </button>
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
                  <th className="py-2 pr-3">Título</th>
                  <th className="py-2 pr-3">Quando</th>
                  <th className="py-2 pr-3">Prioridade</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-[var(--color-muted)]">
                      Carregando...
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-[var(--color-muted)]">
                      Nenhum lembrete encontrado.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr key={item.id} className="border-b border-[var(--color-border)]/70">
                      <td className="py-2 pr-3">
                        <p className="font-medium">{item.titulo}</p>
                        <p className="text-xs text-[var(--color-muted)]">{item.categoria ?? '-'}</p>
                      </td>
                      <td className="py-2 pr-3">
                        {formatDateBr(item.data_lembrete)} {item.hora_lembrete ? `· ${item.hora_lembrete.slice(0, 5)}` : ''}
                      </td>
                      <td className="py-2 pr-3">{item.prioridade}</td>
                      <td className="py-2 pr-3">{item.status}</td>
                      <td className="py-2 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => toggleStatus(item)}
                            className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-2 py-1 text-xs"
                          >
                            {item.status === 'Concluído' ? 'Reabrir' : 'Concluir'}
                          </button>
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

function Metric({ title, value }: { title: string; value: number }) {
  return (
    <article className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">{title}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </article>
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
