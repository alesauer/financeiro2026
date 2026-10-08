import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Sparkles, Edit2, Trash2, Plus } from 'lucide-react'

import { useAuth } from '@/app/providers/AuthProvider'
import { formasPagamentoService } from '@/features/formasPagamento/services/formasPagamentoService'
import { BankCardIcon } from '@/shared/components/BankCardIcon'
import { IconSelectorModal } from '@/features/formasPagamento/components/IconSelectorModal'
import type { FormaPagamento, FormaPagamentoPayload } from '@/shared/types/formaPagamento'
import { getErrorMessage } from '@/shared/utils/error'

const EMPTY_FORM: FormaPagamentoPayload = {
  nome: '',
  tipo: '',
  cartao_credito: false,
  dia_fechamento: null,
  dia_vencimento: null,
  ativo: true,
  icone: null,
  cor: null,
}

export function FormasPagamentoPage() {
  const { token } = useAuth()
  const [items, setItems] = useState<FormaPagamento[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<FormaPagamentoPayload>(EMPTY_FORM)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isIconModalOpen, setIsIconModalOpen] = useState(false)

  const title = useMemo(() => (editingId ? 'Editar Forma de Pagamento' : 'Nova Forma de Pagamento'), [editingId])

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
      icone: item.icone ?? null,
      cor: item.cor ?? null,
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
      icone: form.icone || null,
      cor: form.cor || null,
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
      <header className="space-y-1">
        <h2 className="text-2xl font-bold text-[var(--color-text)]">Formas de Pagamento & Cartões</h2>
        <p className="text-sm text-[var(--color-muted)]">
          Configure cartões de crédito (Nubank, C6, etc.), contas bancárias e métodos de pagamento.
        </p>
      </header>

      <article className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-xs">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--color-muted)]">
              Formas Cadastradas ({items.length})
            </h3>
          </div>
          <button
            type="button"
            onClick={abrirNovoFormulario}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:opacity-95 transition"
          >
            <Plus className="h-4 w-4" />
            Nova Forma
          </button>
        </div>

        {isFormOpen ? (
          <div className="mb-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]/40 p-5 shadow-xs">
            <h4 className="mb-4 text-sm font-bold uppercase tracking-wider text-[var(--color-text)]">
              {title}
            </h4>
            <form className="space-y-4" onSubmit={handleSubmit}>
              {/* Seletor de Ícone e Cor da Forma */}
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <BankCardIcon
                    icone={form.icone}
                    cor={form.cor}
                    nome={form.nome || 'Cartão'}
                    size="xl"
                  />
                  <div>
                    <span className="text-xs font-bold text-[var(--color-text)] block">
                      Ícone & Identidade Visual
                    </span>
                    <p className="text-xs text-[var(--color-muted)] mt-0.5">
                      {form.icone
                        ? form.icone.startsWith('data:image')
                          ? 'Ícone personalizado (upload)'
                          : 'Ícone oficial selecionado'
                        : 'Ícone automático (baseado no nome)'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsIconModalOpen(true)}
                  className="inline-flex items-center gap-2 rounded-lg border border-teal-500/50 bg-teal-50/50 px-3.5 py-2 text-xs font-bold text-teal-800 hover:bg-teal-100 transition shrink-0"
                >
                  <Sparkles className="h-4 w-4 text-teal-600" />
                  <span>Escolher Ícone / Enviar Foto</span>
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[var(--color-text)]">Nome do Cartão / Forma</label>
                  <input
                    value={form.nome}
                    onChange={(event) => setForm((prev) => ({ ...prev, nome: event.target.value }))}
                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-none"
                    placeholder="Ex.: Nubank Mastercard, C6 Bank, Pix Itaú"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[var(--color-text)]">Tipo de Pagamento</label>
                  <input
                    value={form.tipo}
                    onChange={(event) => setForm((prev) => ({ ...prev, tipo: event.target.value }))}
                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-none"
                    placeholder="Ex.: Cartão de Crédito, Pix, Dinheiro, Débito"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text)] cursor-pointer">
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
                  className="rounded border-[var(--color-border)] text-teal-600 focus:ring-teal-500 h-4 w-4"
                />
                <span>É um Cartão de Crédito (possui fechamento de fatura e vencimento)</span>
              </label>

              {form.cartao_credito && (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 rounded-xl border border-teal-200/60 bg-teal-50/30 p-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-teal-950">
                      Dia de Fechamento da Fatura (1 a 31)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={31}
                      placeholder="Ex: 25 para Nubank, 12 para C6"
                      value={form.dia_fechamento ?? ''}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          dia_fechamento: normalizeDay(event.target.value),
                        }))
                      }
                      className="w-full rounded-lg border border-teal-200 bg-white px-3 py-2 text-sm text-[var(--color-text)] focus:border-teal-500 focus:outline-none"
                    />
                    <span className="text-[11px] text-teal-800">
                      Compras após este dia caem na próxima fatura.
                    </span>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-teal-950">
                      Dia de Vencimento da Fatura (1 a 31)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={31}
                      placeholder="Ex: 3 para Nubank, 20 para C6"
                      value={form.dia_vencimento ?? ''}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          dia_vencimento: normalizeDay(event.target.value),
                        }))
                      }
                      className="w-full rounded-lg border border-teal-200 bg-white px-3 py-2 text-sm text-[var(--color-text)] focus:border-teal-500 focus:outline-none"
                    />
                    <span className="text-[11px] text-teal-800">
                      Dia do mês em que o boleto deve ser pago.
                    </span>
                  </div>
                </div>
              )}

              <label className="flex items-center gap-2 text-sm font-medium text-[var(--color-muted)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.ativo}
                  onChange={(event) => setForm((prev) => ({ ...prev, ativo: event.target.checked }))}
                  className="rounded border-[var(--color-border)] text-teal-600 focus:ring-teal-500 h-4 w-4"
                />
                <span>Ativo (disponível para seleção em novos lançamentos)</span>
              </label>

              <div className="flex items-center gap-2 pt-2 border-t border-[var(--color-border)]">
                <button
                  type="submit"
                  className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-xs font-bold text-white shadow-xs hover:opacity-95 transition"
                >
                  {editingId ? 'Salvar Alterações' : 'Cadastrar Forma de Pagamento'}
                </button>
                <button
                  type="button"
                  onClick={cancelarFormulario}
                  className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-xs font-semibold text-[var(--color-text)] hover:bg-[var(--color-border)]/40 transition"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        ) : null}

        {error ? <p className="mb-3 text-sm text-rose-600">{error}</p> : null}

        {/* Lista Mobile */}
        {editingId ? null : loading ? (
          <p className="mb-3 text-sm text-[var(--color-muted)] md:hidden">Carregando...</p>
        ) : items.length === 0 ? (
          <p className="mb-3 text-sm text-[var(--color-muted)] md:hidden">Nenhuma forma de pagamento cadastrada.</p>
        ) : (
          <div className="mb-3 space-y-2 md:hidden">
            {items.map((item) => (
              <article
                key={item.id}
                className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3.5 shadow-xs flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <BankCardIcon
                    icone={item.icone}
                    cor={item.cor}
                    nome={item.nome}
                    size="lg"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[var(--color-text)] truncate">{item.nome}</p>
                    <p className="text-xs text-[var(--color-muted)]">{item.tipo}</p>
                    {item.cartao_credito && (
                      <p className="text-[11px] text-teal-700 font-medium">
                        Fecha dia {item.dia_fechamento ?? '-'} · Vence dia {item.dia_vencimento ?? '-'}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleEdit(item)}
                    className="rounded-md p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-border)]/50"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(item.id)}
                    className="rounded-md p-1.5 text-rose-500 hover:bg-rose-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}

        {/* Tabela Desktop */}
        {editingId ? null : (
          <div className="overflow-x-auto">
            <table className="hidden min-w-full border-collapse text-sm md:table">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-left text-xs uppercase tracking-wider text-[var(--color-muted)]">
                  <th className="py-2.5 pr-3">Cartão / Forma</th>
                  <th className="py-2.5 pr-3">Tipo</th>
                  <th className="py-2.5 pr-3">Crédito?</th>
                  <th className="py-2.5 pr-3">Fechamento</th>
                  <th className="py-2.5 pr-3">Vencimento</th>
                  <th className="py-2.5 pr-3">Status</th>
                  <th className="py-2.5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-[var(--color-muted)]">
                      Carregando formas de pagamento...
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-[var(--color-muted)]">
                      Nenhuma forma de pagamento cadastrada.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr key={item.id} className="border-b border-[var(--color-border)]/60 hover:bg-slate-50/50">
                      <td className="py-3 pr-3 font-semibold text-[var(--color-text)]">
                        <div className="flex items-center gap-3">
                          <BankCardIcon
                            icone={item.icone}
                            cor={item.cor}
                            nome={item.nome}
                            size="md"
                          />
                          <span>{item.nome}</span>
                        </div>
                      </td>
                      <td className="py-3 pr-3 text-[var(--color-muted)]">{item.tipo}</td>
                      <td className="py-3 pr-3">
                        {item.cartao_credito ? (
                          <span className="inline-flex rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-bold text-teal-800 border border-teal-200">
                            Cartão de Crédito
                          </span>
                        ) : (
                          <span className="text-xs text-[var(--color-muted)]">Comum</span>
                        )}
                      </td>
                      <td className="py-3 pr-3 font-medium">
                        {item.dia_fechamento ? `Dia ${item.dia_fechamento}` : '-'}
                      </td>
                      <td className="py-3 pr-3 font-medium">
                        {item.dia_vencimento ? `Dia ${item.dia_vencimento}` : '-'}
                      </td>
                      <td className="py-3 pr-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            item.ativo
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {item.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleEdit(item)}
                            className="rounded-lg border border-[var(--color-border)] px-2.5 py-1 text-xs font-semibold hover:bg-slate-100 transition"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(item.id)}
                            className="rounded-lg border border-rose-200 px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition"
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
          </div>
        )}
      </article>

      {/* Modal Seletor de Ícones Oficiais ou Upload */}
      <IconSelectorModal
        isOpen={isIconModalOpen}
        currentIcon={form.icone}
        currentColor={form.cor}
        nomeForma={form.nome}
        onClose={() => setIsIconModalOpen(false)}
        onSelect={(novoIcone, novaCor) => {
          setForm((prev) => ({
            ...prev,
            icone: novoIcone,
            cor: novaCor,
          }))
        }}
      />
    </section>
  )
}
