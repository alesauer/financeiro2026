import { useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'

import { useAuth } from '@/app/providers/AuthProvider'
import { usuariosService } from '@/features/usuarios/services/usuariosService'
import type { ChangePasswordPayload, UsuarioPayload } from '@/shared/types/usuario'
import { getErrorMessage } from '@/shared/utils/error'

const EMPTY_FORM: UsuarioPayload = {
  nome: '',
  email: '',
  senha: '',
}

const EMPTY_PASS: ChangePasswordPayload = {
  senha_atual: '',
  senha_nova: '',
  senha_confirm: '',
}

export function UsuariosPage() {
  const { token, user } = useAuth()

  const [usuarios, setUsuarios] = useState<Array<{ id: number; nome: string; email: string; data_criacao?: string }>>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<UsuarioPayload>(EMPTY_FORM)
  const [passForm, setPassForm] = useState<ChangePasswordPayload>(EMPTY_PASS)
  const [isFormOpen, setIsFormOpen] = useState(false)

  const carregarUsuarios = async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const data = await usuariosService.list(token)
      setUsuarios(data)
    } catch (err) {
      setError(getErrorMessage(err, 'Não foi possível carregar usuários.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarUsuarios()
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

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!token) return

    if (!form.nome.trim() || !form.email.trim()) {
      setError('Nome e e-mail são obrigatórios.')
      return
    }

    if (!editingId && !form.senha?.trim()) {
      setError('Senha é obrigatória para novo usuário.')
      return
    }

    try {
      if (editingId) {
        const payload: UsuarioPayload = {
          nome: form.nome.trim(),
          email: form.email.trim(),
          senha: form.senha?.trim() || undefined,
        }
        await usuariosService.update(token, editingId, payload)
      } else {
        await usuariosService.create(token, {
          nome: form.nome.trim(),
          email: form.email.trim(),
          senha: form.senha?.trim(),
        })
      }

      resetForm()
      setIsFormOpen(false)
      await carregarUsuarios()
    } catch (err) {
      setError(getErrorMessage(err, 'Não foi possível salvar usuário.'))
    }
  }

  const handleEdit = (item: { id: number; nome: string; email: string }) => {
    setEditingId(item.id)
    setIsFormOpen(true)
    setForm({ nome: item.nome, email: item.email, senha: '' })
  }

  const handleDelete = async (id: number) => {
    if (!token) return
    if (!window.confirm('Confirma a exclusão deste usuário?')) return

    try {
      await usuariosService.remove(token, id)
      await carregarUsuarios()
      if (editingId === id) cancelarFormulario()
    } catch (err) {
      setError(getErrorMessage(err, 'Não foi possível excluir usuário.'))
    }
  }

  const handleChangePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!token) return

    if (!passForm.senha_atual || !passForm.senha_nova || !passForm.senha_confirm) {
      setError('Preencha todos os campos de troca de senha.')
      return
    }

    try {
      await usuariosService.changePassword(token, passForm)
      setPassForm(EMPTY_PASS)
      setError(null)
      window.alert('Senha alterada com sucesso.')
    } catch (err) {
      setError(getErrorMessage(err, 'Não foi possível alterar a senha.'))
    }
  }

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold text-[var(--color-text)]">Usuários</h2>
        <p className="text-sm text-[var(--color-muted)]">Administre contas da aplicação e troque sua senha.</p>
      </header>

      <article className="space-y-6">
        <section className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">Lista de usuários</h3>
            <button
              type="button"
              onClick={abrirNovoFormulario}
              className="rounded-[var(--radius-sm)] bg-[var(--color-primary)] px-3 py-2 text-sm font-semibold text-white"
            >
              Novo usuário
            </button>
          </div>

          {isFormOpen ? (
            <div className="mb-4 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)]/30 p-4">
              <h4 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                {editingId ? 'Editar usuário' : 'Novo usuário'}
              </h4>

              <form className="space-y-3" onSubmit={handleSubmit}>
            <Field label="Nome">
              <input
                value={form.nome}
                onChange={(event) => setForm((prev) => ({ ...prev, nome: event.target.value }))}
                className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-sm"
              />
            </Field>

            <Field label="E-mail">
              <input
                type="email"
                value={form.email}
                onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-sm"
              />
            </Field>

            <Field label={editingId ? 'Nova senha (opcional)' : 'Senha'}>
              <input
                type="password"
                value={form.senha ?? ''}
                onChange={(event) => setForm((prev) => ({ ...prev, senha: event.target.value }))}
                className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-sm"
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
            ) : usuarios.length === 0 ? (
              <p className="mb-3 text-sm text-[var(--color-muted)] md:hidden">Nenhum usuário encontrado.</p>
            ) : (
              <div className="mb-3 space-y-2 md:hidden">
                {usuarios.map((item) => (
                  <article
                    key={item.id}
                    className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3"
                  >
                    <p className="text-sm font-semibold text-[var(--color-text)]">{item.nome}</p>
                    <p className="mt-1 text-xs text-[var(--color-muted)]">{item.email}</p>
                    <p className="mt-1 text-xs text-[var(--color-muted)]">
                      Criação: {item.data_criacao ? new Date(item.data_criacao).toLocaleString('pt-BR') : '-'}
                    </p>
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
                    <th className="py-2 pr-3">E-mail</th>
                    <th className="py-2 pr-3">Criação</th>
                    <th className="py-2 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={4} className="py-4 text-center text-[var(--color-muted)]">
                        Carregando...
                      </td>
                    </tr>
                  ) : usuarios.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-4 text-center text-[var(--color-muted)]">
                        Nenhum usuário encontrado.
                      </td>
                    </tr>
                  ) : (
                    usuarios.map((item) => (
                      <tr key={item.id} className="border-b border-[var(--color-border)]/70">
                        <td className="py-2 pr-3">{item.nome}</td>
                        <td className="py-2 pr-3">{item.email}</td>
                        <td className="py-2 pr-3">{item.data_criacao ? new Date(item.data_criacao).toLocaleString('pt-BR') : '-'}</td>
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
        </section>

        {user && !editingId ? (
          <section className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">Alterar minha senha</h3>
            <form className="grid gap-3 md:grid-cols-3" onSubmit={handleChangePassword}>
              <Field label="Senha atual">
                <input
                  type="password"
                  value={passForm.senha_atual}
                  onChange={(event) => setPassForm((prev) => ({ ...prev, senha_atual: event.target.value }))}
                  className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-sm"
                />
              </Field>
              <Field label="Nova senha">
                <input
                  type="password"
                  value={passForm.senha_nova}
                  onChange={(event) => setPassForm((prev) => ({ ...prev, senha_nova: event.target.value }))}
                  className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-sm"
                />
              </Field>
              <Field label="Confirmar senha">
                <input
                  type="password"
                  value={passForm.senha_confirm}
                  onChange={(event) => setPassForm((prev) => ({ ...prev, senha_confirm: event.target.value }))}
                  className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-sm"
                />
              </Field>
              <div className="md:col-span-3">
                <button className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-sm font-medium">
                  Atualizar senha
                </button>
              </div>
            </form>
          </section>
        ) : null}
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
