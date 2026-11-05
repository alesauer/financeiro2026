import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Bell, Plus, Trash2, X } from 'lucide-react'

import { useAuth } from '@/app/providers/AuthProvider'
import { categoriasService } from '@/features/categorias/services/categoriasService'
import { MetasPageHeader } from '@/features/metas/components/MetasPageHeader'
import { metasService } from '@/features/metas/services/metasService'
import type { Categoria } from '@/shared/types/categoria'
import { formatCurrency } from '@/shared/utils/date'
import { getErrorMessage } from '@/shared/utils/error'

const PERCENTUAIS_BASE = [50, 75, 90, 100]

function calcularDatasMes(ano: number, mes: number) {
  const ultimoDia = new Date(ano, mes, 0).getDate()
  const mStr = String(mes).padStart(2, '0')
  return {
    inicio: `${ano}-${mStr}-01`,
    fim: `${ano}-${mStr}-${String(ultimoDia).padStart(2, '0')}`,
  }
}

export function MetaFormPage() {
  const { token } = useAuth()
  const navigate = useNavigate()
  const { id } = useParams<{ id?: string }>()
  const [searchParams] = useSearchParams()

  const isEdit = Boolean(id)
  const hoje = new Date()
  const mesParam = Number(searchParams.get('mes')) || hoje.getMonth() + 1
  const anoParam = Number(searchParams.get('ano')) || hoje.getFullYear()
  const datasPadrao = useMemo(() => calcularDatasMes(anoParam, mesParam), [anoParam, mesParam])

  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [nome, setNome] = useState('')
  const [nomeEditadoManual, setNomeEditadoManual] = useState(false)
  const [categoriaId, setCategoriaId] = useState<number>(0)
  const [valorMaximo, setValorMaximo] = useState<string>('')
  const [periodicidade, setPeriodicidade] = useState<string>('Mensal')
  const [dataInicio, setDataInicio] = useState<string>(datasPadrao.inicio)
  const [dataFim, setDataFim] = useState<string>(datasPadrao.fim)
  const [repetirAutomaticamente, setRepetirAutomaticamente] = useState<boolean>(true)
  const [alertasSelecionados, setAlertasSelecionados] = useState<number[]>([50, 75, 90, 100])
  const [novoPercentualCustom, setNovoPercentualCustom] = useState<string>('')

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    setLoading(true)
    setError(null)

    Promise.all([
      categoriasService.list(token, 'Despesa'),
      isEdit && id ? metasService.obter(token, Number(id), mesParam, anoParam) : Promise.resolve(null),
    ])
      .then(([cats, metaExistente]) => {
        setCategorias(cats)
        if (metaExistente) {
          setNome(metaExistente.nome)
          setNomeEditadoManual(true)
          setCategoriaId(metaExistente.categoria_id)
          setValorMaximo(String(metaExistente.valor_planejado))
          setPeriodicidade(metaExistente.periodicidade || 'Mensal')
          setDataInicio(metaExistente.data_inicio || datasPadrao.inicio)
          setDataFim(metaExistente.data_fim || datasPadrao.fim)
          setRepetirAutomaticamente(metaExistente.repetir_automaticamente)
          setAlertasSelecionados(
            metaExistente.alertas_percentuais?.length
              ? metaExistente.alertas_percentuais
              : [50, 75, 90, 100],
          )
        } else if (cats.length > 0) {
          setCategoriaId(cats[0].id)
          setNome(cats[0].nome)
        }
      })
      .catch((err) => {
        setError(getErrorMessage(err, 'Erro ao carregar dados da meta.'))
      })
      .finally(() => {
        setLoading(false)
      })
  }, [token, isEdit, id, mesParam, anoParam, datasPadrao])

  const todosPercentuaisDisponiveis = useMemo(() => {
    const uniao = new Set([...PERCENTUAIS_BASE, ...alertasSelecionados])
    return Array.from(uniao).sort((a, b) => a - b)
  }, [alertasSelecionados])

  const togglePercentual = (pct: number) => {
    setAlertasSelecionados((prev) =>
      prev.includes(pct) ? prev.filter((x) => x !== pct) : [...prev, pct].sort((a, b) => a - b),
    )
  }

  const handleAdicionarPercentualCustom = () => {
    const val = Number(novoPercentualCustom)
    if (!Number.isFinite(val) || val < 1 || val > 200) {
      setError('Informe um percentual personalizado entre 1% e 200%.')
      return
    }
    const arred = Math.round(val)
    if (!alertasSelecionados.includes(arred)) {
      setAlertasSelecionados((prev) => [...prev, arred].sort((a, b) => a - b))
    }
    setNovoPercentualCustom('')
    setError(null)
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!token) return
    setError(null)

    if (!nome.trim()) {
      setError('O nome da meta é obrigatório.')
      return
    }
    if (!categoriaId) {
      setError('Selecione uma categoria financeira.')
      return
    }
    const valorNum = Number(valorMaximo)
    if (!Number.isFinite(valorNum) || valorNum <= 0) {
      setError('Informe um valor máximo permitido maior que zero.')
      return
    }
    if (dataInicio && dataFim && dataFim < dataInicio) {
      setError('A data final não pode ser anterior à data inicial.')
      return
    }

    setSaving(true)
    try {
      const payload = {
        nome: nome.trim(),
        categoria_id: categoriaId,
        valor_limite: valorNum,
        periodicidade,
        data_inicio: dataInicio || null,
        data_fim: dataFim || null,
        repetir_automaticamente: repetirAutomaticamente,
        alertas_percentuais: alertasSelecionados,
      }

      if (isEdit && id) {
        await metasService.atualizar(token, Number(id), payload)
        navigate(`/metas/${id}?mes=${mesParam}&ano=${anoParam}`)
      } else {
        await metasService.criar(token, payload)
        navigate(`/metas/lista?mes=${mesParam}&ano=${anoParam}`)
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Não foi possível salvar a meta.'))
    } finally {
      setSaving(false)
    }
  }

  const handleExcluir = async () => {
    if (!token || !isEdit || !id) return
    if (!window.confirm(`Tem certeza que deseja excluir a meta "${nome}"?`)) return
    setSaving(true)
    try {
      await metasService.remover(token, Number(id))
      navigate(`/metas/lista?mes=${mesParam}&ano=${anoParam}`)
    } catch (err) {
      setError(getErrorMessage(err, 'Erro ao excluir a meta.'))
      setSaving(false)
    }
  }

  const valorOrcamentoNum = Math.max(0, Number(valorMaximo) || 0)

  return (
    <section className="space-y-6">
      <MetasPageHeader subtitulo={isEdit ? 'Editar Meta' : 'Nova Meta'} />

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-10 text-center text-sm text-[var(--color-muted)]">
          Carregando formulário...
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {/* Bloco 1: Informacoes da Meta */}
            <div className="space-y-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-2xs">
              <h3 className="text-base font-bold text-[var(--color-text)]">Informações da Meta</h3>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-[var(--color-muted)]">
                  Nome da meta <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => {
                    setNome(e.target.value)
                    setNomeEditadoManual(true)
                  }}
                  placeholder="Ex.: Alimentação"
                  className="w-full rounded-lg border border-[var(--color-border)] bg-white px-3.5 py-2.5 text-sm font-medium text-[var(--color-text)] outline-none focus:border-emerald-600"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-[var(--color-muted)]">
                  Categoria <span className="text-rose-500">*</span>
                </label>
                <select
                  value={categoriaId || ''}
                  onChange={(e) => {
                    const novoId = Number(e.target.value)
                    setCategoriaId(novoId)
                    const catObj = categorias.find((c) => c.id === novoId)
                    if (catObj && (!nomeEditadoManual || !nome.trim())) {
                      setNome(catObj.nome)
                    }
                  }}
                  className="w-full rounded-lg border border-[var(--color-border)] bg-white px-3.5 py-2.5 text-sm font-medium text-[var(--color-text)] outline-none focus:border-emerald-600"
                >
                  <option value="">Selecione uma categoria</option>
                  {categorias.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-[var(--color-muted)]">
                  Valor máximo (orçamento) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-[var(--color-muted)]">
                    R$
                  </span>
                  <input
                    type="number"
                    min={0.01}
                    step="0.01"
                    value={valorMaximo}
                    onChange={(e) => setValorMaximo(e.target.value)}
                    placeholder="1.200,00"
                    className="w-full rounded-lg border border-[var(--color-border)] bg-white py-2.5 pl-10 pr-3.5 text-sm font-bold tabular-nums text-[var(--color-text)] outline-none focus:border-emerald-600"
                  />
                </div>
              </div>
            </div>

            {/* Bloco 2: Configuracao */}
            <div className="flex flex-col justify-between space-y-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-2xs">
              <div className="space-y-4">
                <h3 className="text-base font-bold text-[var(--color-text)]">Configuração</h3>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-[var(--color-muted)]">
                    Periodicidade
                  </label>
                  <select
                    value={periodicidade}
                    onChange={(e) => setPeriodicidade(e.target.value)}
                    className="w-full rounded-lg border border-[var(--color-border)] bg-white px-3.5 py-2.5 text-sm font-medium text-[var(--color-text)] outline-none focus:border-emerald-600"
                  >
                    <option value="Mensal">Mensal</option>
                    <option value="Anual">Anual</option>
                    <option value="Personalizado">Personalizado</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-[var(--color-muted)]">
                      Início
                    </label>
                    <input
                      type="date"
                      value={dataInicio}
                      onChange={(e) => setDataInicio(e.target.value)}
                      className="w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-text)] outline-none focus:border-emerald-600"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-[var(--color-muted)]">
                      Fim
                    </label>
                    <input
                      type="date"
                      value={dataFim}
                      onChange={(e) => setDataFim(e.target.value)}
                      className="w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-text)] outline-none focus:border-emerald-600"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <label className="inline-flex cursor-pointer items-center gap-3">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={repetirAutomaticamente}
                    onClick={() => setRepetirAutomaticamente((prev) => !prev)}
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                      repetirAutomaticamente ? 'bg-emerald-600' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        repetirAutomaticamente ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                  <span className="text-xs font-medium text-[var(--color-text)]">
                    Repetir automaticamente nos próximos meses
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Bloco 3: Alertas */}
          <div className="rounded-xl border border-sky-200/80 bg-sky-50/40 p-6 shadow-2xs">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-2.5">
                <Bell className="mt-0.5 h-5 w-5 text-sky-600" />
                <div>
                  <h3 className="text-sm font-bold text-[var(--color-text)]">Alertas</h3>
                  <p className="text-xs text-[var(--color-muted)]">
                    Receber notificações quando o gasto atingir:
                  </p>
                </div>
              </div>

              {/* Adicionar percentual personalizado */}
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={1}
                  max={200}
                  placeholder="Outro % (ex: 85)"
                  value={novoPercentualCustom}
                  onChange={(e) => setNovoPercentualCustom(e.target.value)}
                  className="w-32 rounded-lg border border-[var(--color-border)] bg-white px-2.5 py-1 text-xs outline-none focus:border-emerald-600"
                />
                <button
                  type="button"
                  onClick={handleAdicionarPercentualCustom}
                  className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-border)] bg-white px-2.5 py-1 text-xs font-semibold text-[var(--color-text)] hover:bg-slate-50 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Adicionar %
                </button>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-4">
              {todosPercentuaisDisponiveis.map((pct) => {
                const marcado = alertasSelecionados.includes(pct)
                const valorGatilho = (valorOrcamentoNum * pct) / 100
                const ehCustom = !PERCENTUAIS_BASE.includes(pct)
                return (
                  <label
                    key={pct}
                    className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3.5 py-2 text-xs transition-colors ${
                      marcado
                        ? 'border-emerald-300 bg-white font-semibold text-[var(--color-text)] shadow-2xs'
                        : 'border-transparent bg-white/60 text-[var(--color-muted)]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={marcado}
                      onChange={() => togglePercentual(pct)}
                      className="h-4 w-4 rounded accent-emerald-600"
                    />
                    <span>
                      <strong>{pct}%</strong> ({formatCurrency(valorGatilho)})
                    </span>
                    {ehCustom ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault()
                          setAlertasSelecionados((prev) => prev.filter((x) => x !== pct))
                        }}
                        className="ml-1 text-slate-400 hover:text-rose-600"
                        title="Remover percentual personalizado"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </label>
                )
              })}
            </div>
          </div>

          {/* Botoes de acao */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div>
              {isEdit ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleExcluir}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 cursor-pointer"
                >
                  <Trash2 className="h-4 w-4" />
                  Excluir Meta
                </button>
              ) : null}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={saving}
                onClick={() => navigate(-1)}
                className="rounded-lg border border-[var(--color-border)] bg-white px-5 py-2.5 text-xs font-semibold text-[var(--color-text)] hover:bg-slate-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-emerald-700 px-6 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-800 disabled:opacity-50 cursor-pointer"
              >
                {saving ? 'Salvando...' : 'Salvar Meta'}
              </button>
            </div>
          </div>
        </form>
      )}
    </section>
  )
}

