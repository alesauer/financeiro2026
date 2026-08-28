import { useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'

import { useAuth } from '@/app/providers/AuthProvider'
import { viagensService } from '@/features/viagens/services/viagensService'
import type {
  Viagem,
  ViagemCusto,
  ViagemCustoPayload,
  ViagemPayload,
  ViagemRoteiroItem,
  ViagemStatus,
} from '@/shared/types/viagem'
import { formatCurrency } from '@/shared/utils/date'
import { getErrorMessage } from '@/shared/utils/error'

const STATUS: ViagemStatus[] = ['Planejada', 'Em andamento', 'Finalizada', 'Cancelada']

const EMPTY_VIAGEM: ViagemPayload = {
  titulo: '',
  destino: '',
  data_inicio: '',
  data_termino: '',
  descricao: null,
  status: 'Planejada',
}

const EMPTY_CUSTO: ViagemCustoPayload = {
  nome: '',
  descricao: '',
  observacao: null,
  link: null,
  tipo: 'Outros',
  data_gasto: new Date().toISOString().slice(0, 10),
  valor: 0,
  forma_pagamento: null,
}

export function ViagensPage() {
  const { token } = useAuth()

  const [viagens, setViagens] = useState<Viagem[]>([])
  const [custos, setCustos] = useState<ViagemCusto[]>([])
  const [roteiro, setRoteiro] = useState<ViagemRoteiroItem[]>([])

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const [editingViagemId, setEditingViagemId] = useState<number | null>(null)
  const [editingCustoId, setEditingCustoId] = useState<number | null>(null)
  const [isViagemFormOpen, setIsViagemFormOpen] = useState(false)
  const [isCustoFormOpen, setIsCustoFormOpen] = useState(false)

  const [viagemForm, setViagemForm] = useState<ViagemPayload>(EMPTY_VIAGEM)
  const [custoForm, setCustoForm] = useState<ViagemCustoPayload>(EMPTY_CUSTO)
  const [roteiroText, setRoteiroText] = useState('')

  const selectedViagem = useMemo(() => viagens.find((item) => item.id === selectedId) ?? null, [viagens, selectedId])

  const carregarViagens = async () => {
    if (!token) return
    setLoading(true)
    setError(null)

    try {
      const data = await viagensService.list(token, 1, 50, query)
      setViagens(data.items)
      if (!selectedId && data.items[0]) {
        setSelectedId(data.items[0].id)
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Não foi possível carregar viagens.'))
    } finally {
      setLoading(false)
    }
  }

  const carregarCustos = async (viagemId: number) => {
    if (!token) return
    try {
      const data = await viagensService.listCustos(token, viagemId)
      setCustos(data)
    } catch (err) {
      setError(getErrorMessage(err, 'Não foi possível carregar custos da viagem.'))
    }
  }

  const carregarRoteiro = async (viagemId: number) => {
    if (!token) return
    try {
      const data = await viagensService.listRoteiro(token, viagemId)
      setRoteiro(data)
      setRoteiroText(data.map((item) => `${item.data} | ${item.descricao ?? ''}`).join('\n'))
    } catch (err) {
      setError(getErrorMessage(err, 'Não foi possível carregar roteiro da viagem.'))
    }
  }

  useEffect(() => {
    carregarViagens()
  }, [token, query])

  useEffect(() => {
    if (selectedId) {
      carregarCustos(selectedId)
      carregarRoteiro(selectedId)
    } else {
      setCustos([])
      setRoteiro([])
      setRoteiroText('')
    }
  }, [selectedId, token])

  const resetViagemForm = () => {
    setEditingViagemId(null)
    setViagemForm(EMPTY_VIAGEM)
  }

  const abrirNovaViagem = () => {
    resetViagemForm()
    setIsViagemFormOpen(true)
  }

  const cancelarViagem = () => {
    resetViagemForm()
    setIsViagemFormOpen(false)
  }

  const resetCustoForm = () => {
    setEditingCustoId(null)
    setCustoForm(EMPTY_CUSTO)
  }

  const abrirNovoCusto = () => {
    resetCustoForm()
    setIsCustoFormOpen(true)
  }

  const cancelarCusto = () => {
    resetCustoForm()
    setIsCustoFormOpen(false)
  }

  const submitViagem = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!token) return

    if (!viagemForm.titulo.trim() || !viagemForm.destino.trim() || !viagemForm.data_inicio || !viagemForm.data_termino) {
      setError('Preencha título, destino e período da viagem.')
      return
    }

    const payload: ViagemPayload = {
      ...viagemForm,
      titulo: viagemForm.titulo.trim(),
      destino: viagemForm.destino.trim(),
      descricao: viagemForm.descricao?.trim() || null,
    }

    try {
      if (editingViagemId) {
        await viagensService.update(token, editingViagemId, payload)
      } else {
        await viagensService.create(token, payload)
      }
      resetViagemForm()
      setIsViagemFormOpen(false)
      await carregarViagens()
    } catch (err) {
      setError(getErrorMessage(err, 'Não foi possível salvar viagem.'))
    }
  }

  const editarViagem = async (id: number) => {
    if (!token) return
    try {
      const viagem = await viagensService.get(token, id)
      setEditingViagemId(viagem.id)
      setIsViagemFormOpen(true)
      setViagemForm({
        titulo: viagem.titulo,
        destino: viagem.destino,
        data_inicio: viagem.data_inicio,
        data_termino: viagem.data_termino,
        descricao: viagem.descricao,
        status: viagem.status,
      })
    } catch (err) {
      setError(getErrorMessage(err, 'Não foi possível carregar viagem para edição.'))
    }
  }

  const excluirViagem = async (id: number) => {
    if (!token) return
    if (!window.confirm('Confirma a exclusão da viagem?')) return

    try {
      await viagensService.remove(token, id)
      await carregarViagens()
      if (selectedId === id) setSelectedId(null)
      if (editingViagemId === id) cancelarViagem()
    } catch (err) {
      setError(getErrorMessage(err, 'Não foi possível excluir viagem.'))
    }
  }

  const submitCusto = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!token || !selectedId) return

    if (!custoForm.nome.trim() || !custoForm.descricao.trim() || !custoForm.valor || custoForm.valor <= 0) {
      setError('Preencha nome, descrição e valor válido do custo.')
      return
    }

    const payload: ViagemCustoPayload = {
      ...custoForm,
      nome: custoForm.nome.trim(),
      descricao: custoForm.descricao.trim(),
      observacao: custoForm.observacao?.trim() || null,
      link: custoForm.link?.trim() || null,
      forma_pagamento: custoForm.forma_pagamento?.trim() || null,
    }

    try {
      if (editingCustoId) {
        await viagensService.updateCusto(token, selectedId, editingCustoId, payload)
      } else {
        await viagensService.createCusto(token, selectedId, payload)
      }
      resetCustoForm()
      setIsCustoFormOpen(false)
      await carregarCustos(selectedId)
      await carregarViagens()
    } catch (err) {
      setError(getErrorMessage(err, 'Não foi possível salvar custo da viagem.'))
    }
  }

  const editarCusto = (item: ViagemCusto) => {
    setEditingCustoId(item.id)
    setIsCustoFormOpen(true)
    setCustoForm({
      nome: item.nome,
      descricao: item.descricao,
      observacao: item.observacao,
      link: item.link,
      tipo: item.tipo,
      data_gasto: item.data_gasto,
      valor: Number(item.valor),
      forma_pagamento: item.forma_pagamento,
    })
  }

  const excluirCusto = async (id: number) => {
    if (!token || !selectedId) return
    if (!window.confirm('Confirma a exclusão deste custo?')) return

    try {
      await viagensService.removeCusto(token, selectedId, id)
      await carregarCustos(selectedId)
      await carregarViagens()
      if (editingCustoId === id) cancelarCusto()
    } catch (err) {
      setError(getErrorMessage(err, 'Não foi possível excluir custo da viagem.'))
    }
  }

  const salvarRoteiro = async () => {
    if (!token || !selectedId) return

    const itens = roteiroText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [data, ...descricao] = line.split('|')
        return {
          data: data.trim(),
          descricao: descricao.join('|').trim() || null,
        }
      })
      .filter((item) => /^\d{4}-\d{2}-\d{2}$/.test(item.data))

    try {
      await viagensService.saveRoteiro(token, selectedId, itens)
      await carregarRoteiro(selectedId)
    } catch (err) {
      setError(getErrorMessage(err, 'Não foi possível salvar roteiro da viagem.'))
    }
  }

  const exportar = async (formato: 'csv' | 'pdf', viagemId: number) => {
    if (!token) return
    try {
      await viagensService.exportFile(token, viagemId, formato)
    } catch (err) {
      setError(getErrorMessage(err, 'Não foi possível exportar a viagem.'))
    }
  }

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold text-[var(--color-text)]">Viagens</h2>
        <p className="text-sm text-[var(--color-muted)]">Planeje viagens e acompanhe custos por categoria.</p>
      </header>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      <article className="space-y-6">
        <section className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por título/destino"
                className="min-w-[220px] rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => carregarViagens()}
                className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-sm"
              >
                Atualizar
              </button>
            </div>
            <button
              type="button"
              onClick={abrirNovaViagem}
              className="rounded-[var(--radius-sm)] bg-[var(--color-primary)] px-3 py-2 text-sm font-semibold text-white"
            >
              Nova viagem
            </button>
          </div>

          {isViagemFormOpen ? (
            <div className="mb-4 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)]/30 p-4">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                {editingViagemId ? 'Editar viagem' : 'Nova viagem'}
              </h3>

              <form className="space-y-3" onSubmit={submitViagem}>
              <Field label="Título">
                <input
                  value={viagemForm.titulo}
                  onChange={(event) => setViagemForm((prev) => ({ ...prev, titulo: event.target.value }))}
                  className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-sm"
                />
              </Field>

              <Field label="Destino">
                <input
                  value={viagemForm.destino}
                  onChange={(event) => setViagemForm((prev) => ({ ...prev, destino: event.target.value }))}
                  className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-sm"
                />
              </Field>

              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <Field label="Data início">
                  <input
                    type="date"
                    value={viagemForm.data_inicio}
                    onChange={(event) => setViagemForm((prev) => ({ ...prev, data_inicio: event.target.value }))}
                    className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-sm"
                  />
                </Field>
                <Field label="Data término">
                  <input
                    type="date"
                    value={viagemForm.data_termino}
                    onChange={(event) => setViagemForm((prev) => ({ ...prev, data_termino: event.target.value }))}
                    className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-sm"
                  />
                </Field>
              </div>

              <Field label="Status">
                <select
                  value={viagemForm.status}
                  onChange={(event) => setViagemForm((prev) => ({ ...prev, status: event.target.value as ViagemStatus }))}
                  className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-sm"
                >
                  {STATUS.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Descrição">
                <textarea
                  rows={3}
                  value={viagemForm.descricao ?? ''}
                  onChange={(event) => setViagemForm((prev) => ({ ...prev, descricao: event.target.value || null }))}
                  className="w-full resize-y rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-sm"
                />
              </Field>

              <div className="flex items-center gap-2 pt-2">
                <button className="rounded-[var(--radius-sm)] bg-[var(--color-primary)] px-3 py-2 text-sm font-semibold text-white">
                  {editingViagemId ? 'Salvar alterações' : 'Adicionar'}
                </button>
                <button
                  type="button"
                  onClick={cancelarViagem}
                  className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-sm"
                >
                  Cancelar
                </button>
              </div>
            </form>
            </div>
          ) : null}

          {editingViagemId ? null : loading ? (
            <p className="mb-3 text-sm text-[var(--color-muted)] md:hidden">Carregando...</p>
          ) : viagens.length === 0 ? (
            <p className="mb-3 text-sm text-[var(--color-muted)] md:hidden">Nenhuma viagem cadastrada.</p>
          ) : (
            <div className="mb-3 space-y-2 md:hidden">
              {viagens.map((item) => (
                <article
                  key={item.id}
                  className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3"
                >
                  <p className="text-sm font-semibold text-[var(--color-text)]">{item.titulo}</p>
                  <div className="mt-1 space-y-0.5 text-xs text-[var(--color-muted)]">
                    <p>Destino: {item.destino}</p>
                    <p>Status: {item.status}</p>
                    <p>Custo total: {formatCurrency(item.custo_total)}</p>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedId(item.id)}
                      className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-2 py-1 text-xs"
                    >
                      Custos
                    </button>
                    <button
                      type="button"
                      onClick={() => editarViagem(item.id)}
                      className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-2 py-1 text-xs"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => exportar('csv', item.id)}
                      className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-2 py-1 text-xs"
                    >
                      CSV
                    </button>
                    <button
                      type="button"
                      onClick={() => exportar('pdf', item.id)}
                      className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-2 py-1 text-xs"
                    >
                      PDF
                    </button>
                    <button
                      type="button"
                      onClick={() => excluirViagem(item.id)}
                      className="rounded-[var(--radius-sm)] border border-rose-200 px-2 py-1 text-xs text-rose-600"
                    >
                      Excluir
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}

          {editingViagemId ? null : <div className="overflow-x-auto">
            <table className="hidden min-w-full border-collapse text-sm md:table">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-left">
                  <th className="py-2 pr-3">Título</th>
                  <th className="py-2 pr-3">Destino</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Custo total</th>
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
                ) : viagens.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-[var(--color-muted)]">
                      Nenhuma viagem cadastrada.
                    </td>
                  </tr>
                ) : (
                  viagens.map((item) => (
                    <tr key={item.id} className="border-b border-[var(--color-border)]/70">
                      <td className="py-2 pr-3">{item.titulo}</td>
                      <td className="py-2 pr-3">{item.destino}</td>
                      <td className="py-2 pr-3">{item.status}</td>
                      <td className="py-2 pr-3">{formatCurrency(item.custo_total)}</td>
                      <td className="py-2 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedId(item.id)}
                            className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-2 py-1 text-xs"
                          >
                            Custos
                          </button>
                          <button
                            type="button"
                            onClick={() => editarViagem(item.id)}
                            className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-2 py-1 text-xs"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => exportar('csv', item.id)}
                            className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-2 py-1 text-xs"
                          >
                            Exportar CSV
                          </button>
                          <button
                            type="button"
                            onClick={() => exportar('pdf', item.id)}
                            className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-2 py-1 text-xs"
                          >
                            Exportar PDF
                          </button>
                          <button
                            type="button"
                            onClick={() => excluirViagem(item.id)}
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

        {selectedId && !editingViagemId ? (
          <>
            <section className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                Custos · {selectedViagem?.titulo ?? 'Viagem'}
              </h3>
              <button
                type="button"
                onClick={abrirNovoCusto}
                className="rounded-[var(--radius-sm)] bg-[var(--color-primary)] px-3 py-2 text-sm font-semibold text-white"
              >
                Novo custo
              </button>
            </div>

            {isCustoFormOpen ? (
              <div className="mb-4 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)]/30 p-4">
                <h4 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                  {editingCustoId ? 'Editar custo' : 'Novo custo'}
                </h4>

                <form className="space-y-3" onSubmit={submitCusto}>
                <Field label="Nome">
                  <input
                    value={custoForm.nome}
                    onChange={(event) => setCustoForm((prev) => ({ ...prev, nome: event.target.value }))}
                    className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-sm"
                  />
                </Field>
                <Field label="Descrição">
                  <input
                    value={custoForm.descricao}
                    onChange={(event) => setCustoForm((prev) => ({ ...prev, descricao: event.target.value }))}
                    className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-sm"
                  />
                </Field>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  <Field label="Tipo">
                    <input
                      value={custoForm.tipo}
                      onChange={(event) => setCustoForm((prev) => ({ ...prev, tipo: event.target.value }))}
                      className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-sm"
                    />
                  </Field>
                  <Field label="Valor">
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={custoForm.valor || ''}
                      onChange={(event) => setCustoForm((prev) => ({ ...prev, valor: Number(event.target.value) }))}
                      className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-sm"
                    />
                  </Field>
                </div>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  <Field label="Data gasto">
                    <input
                      type="date"
                      value={custoForm.data_gasto}
                      onChange={(event) => setCustoForm((prev) => ({ ...prev, data_gasto: event.target.value }))}
                      className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-sm"
                    />
                  </Field>
                  <Field label="Forma de pagamento">
                    <input
                      value={custoForm.forma_pagamento ?? ''}
                      onChange={(event) => setCustoForm((prev) => ({ ...prev, forma_pagamento: event.target.value || null }))}
                      className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-sm"
                    />
                  </Field>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-sm font-medium">
                    {editingCustoId ? 'Salvar custo' : 'Adicionar custo'}
                  </button>
                  <button
                    type="button"
                    onClick={cancelarCusto}
                    className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-sm"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
              </div>
            ) : null}

            {editingCustoId ? null : custos.length === 0 ? (
              <p className="mb-3 text-sm text-[var(--color-muted)] md:hidden">Nenhum custo registrado para a viagem.</p>
            ) : (
              <div className="mb-3 space-y-2 md:hidden">
                {custos.map((item) => (
                  <article
                    key={item.id}
                    className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3"
                  >
                    <p className="text-sm font-semibold text-[var(--color-text)]">{item.descricao}</p>
                    <div className="mt-1 space-y-0.5 text-xs text-[var(--color-muted)]">
                      <p>Data: {item.data_gasto}</p>
                      <p>Tipo: {item.tipo}</p>
                      <p>Valor: {formatCurrency(item.valor)}</p>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => editarCusto(item)}
                        className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-2 py-1 text-xs"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => excluirCusto(item.id)}
                        className="rounded-[var(--radius-sm)] border border-rose-200 px-2 py-1 text-xs text-rose-600"
                      >
                        Excluir
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}

            {editingCustoId ? null : <div className="overflow-x-auto">
              <table className="hidden min-w-full border-collapse text-sm md:table">
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-left">
                    <th className="py-2 pr-3">Data</th>
                    <th className="py-2 pr-3">Tipo</th>
                    <th className="py-2 pr-3">Descrição</th>
                    <th className="py-2 pr-3">Valor</th>
                    <th className="py-2 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {custos.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-4 text-center text-[var(--color-muted)]">
                        Nenhum custo registrado para a viagem.
                      </td>
                    </tr>
                  ) : (
                    custos.map((item) => (
                      <tr key={item.id} className="border-b border-[var(--color-border)]/70">
                        <td className="py-2 pr-3">{item.data_gasto}</td>
                        <td className="py-2 pr-3">{item.tipo}</td>
                        <td className="py-2 pr-3">{item.descricao}</td>
                        <td className="py-2 pr-3">{formatCurrency(item.valor)}</td>
                        <td className="py-2 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => editarCusto(item)}
                              className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-2 py-1 text-xs"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => excluirCusto(item.id)}
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

            {editingCustoId ? null : <section className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">Roteiro</h3>
              <p className="mb-3 text-xs text-[var(--color-muted)]">Formato: AAAA-MM-DD | descrição (uma linha por item)</p>
              <textarea
                rows={6}
                value={roteiroText}
                onChange={(event) => setRoteiroText(event.target.value)}
                className="w-full resize-y rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-sm"
              />
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={salvarRoteiro}
                  className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-sm"
                >
                  Salvar roteiro
                </button>
                <span className="text-xs text-[var(--color-muted)]">Itens atuais: {roteiro.length}</span>
              </div>
            </section>}
          </>
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
