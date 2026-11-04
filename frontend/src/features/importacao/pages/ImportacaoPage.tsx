import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import { useAuth } from '@/app/providers/AuthProvider'
import { categoriasService } from '@/features/categorias/services/categoriasService'
import { formasPagamentoService } from '@/features/formasPagamento/services/formasPagamentoService'
import { importacaoService } from '@/features/importacao/services/importacaoService'
import { SincronizarCartaoModal } from '@/features/transacoes/components/SincronizarCartaoModal'
import type { Categoria } from '@/shared/types/categoria'
import type { FormaPagamento } from '@/shared/types/formaPagamento'
import type { ImportacaoResultado, ImportacaoTransacaoItem } from '@/shared/types/importacao'
import { getErrorMessage } from '@/shared/utils/error'

type PreviewRow = {
  linha: number
  title: string
  amount: number
  date: string
  categoria: string
  categoria_id: number | null
  metodo?: 'alias' | 'regra' | 'historico' | 'fuzzy' | 'ia' | 'fallback'
  confianca?: number
  motivo?: string
  parcelado: boolean
  parcela_atual: number
  total_parcelas: number
  valor_parcela: number
  parcelamento_id: string | null
  descricao_limpa: string
  isPagamento: boolean
  isEstorno: boolean
}

export function ImportacaoPage() {
  const { token } = useAuth()

  const [arquivo, setArquivo] = useState<File | null>(null)
  const [formasCartao, setFormasCartao] = useState<FormaPagamento[]>([])
  const [categoriasDespesa, setCategoriasDespesa] = useState<Categoria[]>([])
  const [formaPagamentoId, setFormaPagamentoId] = useState<number | null>(null)
  const [diaFechamentoOverride, setDiaFechamentoOverride] = useState('')
  const [diaVencimentoOverride, setDiaVencimentoOverride] = useState('')
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([])
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [loadingImportacao, setLoadingImportacao] = useState(false)
  const [resultado, setResultado] = useState<ImportacaoResultado | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [syncModalOpen, setSyncModalOpen] = useState(false)

  const categoriasByNome = useMemo(() => {
    const map = new Map<string, Categoria>()
    for (const item of categoriasDespesa) {
      map.set(normalizarTexto(item.nome), item)
    }
    return map
  }, [categoriasDespesa])

  useEffect(() => {
    if (!token) return

    async function carregarDependencias() {
      try {
        const [formas, categorias] = await Promise.all([
          formasPagamentoService.list(token, { ativo: true, cartao_credito: true }),
          categoriasService.list(token, 'Despesa'),
        ])

        setFormasCartao(formas)
        setCategoriasDespesa(categorias)
        setFormaPagamentoId((prev) => prev ?? formas[0]?.id ?? null)
      } catch (err) {
        setError(getErrorMessage(err, 'Não foi possível carregar cartões e categorias.'))
      }
    }

    carregarDependencias()
  }, [token])

  const gerarPreview = async () => {
    if (!arquivo) {
      setError('Selecione um arquivo de fatura para visualizar.')
      return
    }

    setLoadingPreview(true)
    setError(null)
    setAviso(null)
    setResultado(null)

    try {
      const registros = await lerArquivoComoRegistros(arquivo)
      if (registros.length === 0) {
        setPreviewRows([])
        setAviso('Nenhum registro encontrado no arquivo.')
        return
      }

      const descricoes = registros.map((item) => item.title)
      const { categorias: categoriasSugeridas, classificacoes } = await sugerirCategorias(descricoes, token ?? undefined)

      const linhas = registros.map((item, idx) => {
        const sugestao = categoriasSugeridas[idx] || 'Indefinida'
        const categoriaEncontrada = categoriasByNome.get(normalizarTexto(sugestao))
        const isPagamento = ehPagamentoFatura(item.title)
        const isEstorno = item.amount < 0 && !isPagamento
        const analise = isPagamento || isEstorno
          ? { parcelado: false, parcelaAtual: 1, totalParcelas: 1, valorParcela: item.amount, parcelamentoId: null, descricaoLimpa: item.title }
          : detectarParcelamento(item.title, item.amount)

        const classif = classificacoes[idx]

        return {
          linha: idx + 1,
          title: item.title,
          amount: item.amount,
          date: item.date,
          categoria: categoriaEncontrada?.nome ?? sugestao,
          categoria_id: categoriaEncontrada?.id ?? null,
          metodo: classif?.metodo,
          confianca: classif?.confianca,
          motivo: classif?.motivo,
          parcelado: analise.parcelado,
          parcela_atual: analise.parcelaAtual,
          total_parcelas: analise.totalParcelas,
          valor_parcela: analise.valorParcela,
          parcelamento_id: analise.parcelamentoId,
          descricao_limpa: analise.descricaoLimpa,
          isPagamento,
          isEstorno,
        } satisfies PreviewRow
      })

      setPreviewRows(linhas)
      setAviso(`Categorização concluída. ${linhas.length} registro(s) pronto(s) para revisão.`)
    } catch (err) {
      setPreviewRows([])
      setError(getErrorMessage(err, 'Não foi possível processar o arquivo de fatura.'))
    } finally {
      setLoadingPreview(false)
    }
  }

  const cartaoSelecionado = useMemo(
    () => formasCartao.find((item) => item.id === formaPagamentoId),
    [formasCartao, formaPagamentoId],
  )

  const resumoPreview = useMemo(() => {
    const totalRegistros = previewRows.length
    const compras = previewRows.filter((item) => item.amount > 0)
    const somaCompras = compras.reduce((acc, item) => acc + item.amount, 0)
    const estornos = previewRows.filter((item) => item.amount < 0 && !item.isPagamento)
    const somaEstornos = estornos.reduce((acc, item) => acc + item.amount, 0)
    const valorLiquidoGastos = somaCompras + somaEstornos

    const diaVencimento = cartaoSelecionado?.dia_vencimento ?? 3
    const pagamentos = previewRows.filter((item) => item.isPagamento)
    
    const pagamentosAnteriores = pagamentos.filter((item) => {
      const dia = Number(item.date.split('-')[2] || 0)
      return dia <= diaVencimento
    })
    const somaPagamentosAnteriores = pagamentosAnteriores.reduce((acc, item) => acc + item.amount, 0)

    const antecipacoes = pagamentos.filter((item) => {
      const dia = Number(item.date.split('-')[2] || 0)
      return dia > diaVencimento
    })
    const somaAntecipacoes = antecipacoes.reduce((acc, item) => acc + item.amount, 0)
    const valorBoletoFechado = Math.max(0, valorLiquidoGastos + somaAntecipacoes)

    return {
      totalRegistros,
      comprasQtd: compras.length,
      somaCompras,
      estornosQtd: estornos.length,
      somaEstornos,
      valorLiquidoGastos,
      pagamentosQtd: pagamentos.length,
      pagamentosAnterioresQtd: pagamentosAnteriores.length,
      somaPagamentosAnteriores,
      antecipacoesQtd: antecipacoes.length,
      somaAntecipacoes,
      valorBoletoFechado,
    }
  }, [previewRows, cartaoSelecionado])

  const importar = async () => {
    if (!formaPagamentoId) {
      setError('Selecione o cartão de crédito utilizado.')
      return
    }
    if (previewRows.length === 0) {
      setError('Gere a visualização antes de importar.')
      return
    }

    setLoadingImportacao(true)
    setError(null)
    setAviso(null)

    try {
      const transacoes: ImportacaoTransacaoItem[] = previewRows.map((item) => ({
        title: item.title,
        amount: item.amount,
        date: item.date,
        categoria: item.categoria,
        categoria_id: item.categoria_id ?? undefined,
        parcelado: item.parcelado,
        parcela_atual: item.parcela_atual,
        total_parcelas: item.total_parcelas,
        valor_parcela: item.valor_parcela,
        parcelamento_id: item.parcelamento_id ?? undefined,
        descricao_limpa: item.descricao_limpa,
      }))

      const data = await importacaoService.importarTransacoes(
        {
          forma_pagamento_id: formaPagamentoId,
          dia_fechamento_override: normalizarOverride(diaFechamentoOverride),
          dia_vencimento_override: normalizarOverride(diaVencimentoOverride),
          transacoes,
        },
        token ?? undefined,
      )

      setResultado(data)
      setAviso(`Importação concluída com sucesso para ${data.sucesso} compra(s)${data.estornos_importados ? ` e ${data.estornos_importados} estorno(s)` : ''}.`)
    } catch (err) {
      setError(getErrorMessage(err, 'Não foi possível importar transações.'))
    } finally {
      setLoadingImportacao(false)
    }
  }

  const atualizarCategoriaLinha = (index: number, categoriaId: number | null) => {
    setPreviewRows((prev) => {
      const next = [...prev]
      const categoria = categoriasDespesa.find((item) => item.id === categoriaId)
      next[index] = {
        ...next[index],
        categoria_id: categoria?.id ?? null,
        categoria: categoria?.nome ?? 'Indefinida',
        metodo: 'alias',
        confianca: 1.0,
        motivo: 'Ajustado manualmente pelo usuário',
      }
      return next
    })
  }

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold text-[var(--color-text)]">Importação de Cartão</h2>
          <p className="text-sm text-[var(--color-muted)]">Importe a fatura por arquivo ou sincronize direto via Open Finance.</p>
        </div>
        <button
          type="button"
          onClick={() => setSyncModalOpen(true)}
          className="inline-flex items-center gap-2 rounded-[var(--radius-sm)] border border-sky-200 bg-sky-50 px-3.5 py-2 text-sm font-semibold text-sky-700 hover:bg-sky-100 transition-colors"
        >
          <span>💳</span>
          <span>Sincronizar Cartão (Open Finance)</span>
        </button>
      </header>

      <SincronizarCartaoModal
        isOpen={syncModalOpen}
        onClose={() => setSyncModalOpen(false)}
        onSuccess={(resumo: any) => {
          const novas = resumo?.novas_transacoes ?? 0
          const nome = resumo?.cartao_nome || 'Cartão'
          const mes = resumo?.mes_fatura ? ` (${resumo.mes_fatura})` : ''
          setAviso(`${nome}${mes}: sincronizado via Open Finance com sucesso! ${novas} novos lançamentos importados.`)
        }}
        token={token ?? ''}
      />

      <article className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field label="Arquivo da fatura (.csv, .xlsx)">
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={(event) => setArquivo(event.target.files?.[0] ?? null)}
              className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-sm"
            />
          </Field>

          <Field label="Cartão de crédito utilizado">
            <select
              value={formaPagamentoId ?? ''}
              onChange={(event) => setFormaPagamentoId(event.target.value ? Number(event.target.value) : null)}
              className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-sm"
            >
              <option value="">Selecione</option>
              {formasCartao.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nome}
                </option>
              ))}
            </select>
            {cartaoSelecionado ? (
              <p className="mt-1 text-xs text-[var(--color-muted)]">
                Fechamento cadastrado: <span className="font-semibold text-[var(--color-text)]">dia {cartaoSelecionado.dia_fechamento ?? 'não definido'}</span>
                {' · '}
                Vencimento: <span className="font-semibold text-[var(--color-text)]">dia {cartaoSelecionado.dia_vencimento ?? 'não definido'}</span>
              </p>
            ) : null}
          </Field>

          <Field label="Dia de fechamento (override opcional)">
            <input
              value={diaFechamentoOverride}
              onChange={(event) => setDiaFechamentoOverride(event.target.value)}
              placeholder="Ex.: 25 ou 2026-09-25"
              className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-sm"
            />
          </Field>

          <Field label="Dia de vencimento (opcional)">
            <input
              value={diaVencimentoOverride}
              onChange={(event) => setDiaVencimentoOverride(event.target.value)}
              placeholder="Ex.: 3 ou 2026-10-03"
              className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-sm"
            />
          </Field>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={gerarPreview}
            className="rounded-[var(--radius-sm)] bg-[var(--color-primary)] px-3 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
          >
            {loadingPreview ? 'Processando...' : 'Visualizar'}
          </button>
          <button
            type="button"
            onClick={importar}
            disabled={loadingImportacao || previewRows.length === 0}
            className="rounded-[var(--radius-sm)] border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 disabled:opacity-60 hover:bg-emerald-100 transition-colors"
          >
            {loadingImportacao ? 'Importando...' : 'Importar registros válidos'}
          </button>
          <button
            type="button"
            onClick={() => {
              setArquivo(null)
              setResultado(null)
              setPreviewRows([])
              setError(null)
              setAviso(null)
            }}
            className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-sm hover:bg-[var(--color-bg)] transition-colors"
          >
            Limpar
          </button>
        </div>

        {aviso ? <p className="mt-3 text-sm text-emerald-700 font-medium">{aviso}</p> : null}
        {error ? <p className="mt-3 text-sm text-rose-600 font-medium">{error}</p> : null}
      </article>

      {previewRows.length > 0 ? (
        <article className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">
              Pré-visualização e Conciliação da Fatura
            </h3>
            <span className="text-xs text-[var(--color-muted)]">
              {previewRows.length} linhas analisadas ({resumoPreview.totalRegistros - resumoPreview.pagamentosQtd} importáveis)
            </span>
          </div>

          {/* Resumo de Valores e Totais da Fatura */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-[var(--radius-sm)] border border-blue-200 bg-blue-50/60 p-3 shadow-xs">
              <span className="text-xs font-semibold uppercase tracking-wider text-blue-800">Gastos Reais no Mês</span>
              <p className="mt-1 text-xl font-bold text-blue-950">{formatarMoeda(resumoPreview.valorLiquidoGastos)}</p>
              <p className="mt-0.5 text-[11px] text-blue-700">
                {resumoPreview.comprasQtd} compras ({formatarMoeda(resumoPreview.somaCompras)})
                {resumoPreview.estornosQtd > 0 ? ` · ${resumoPreview.estornosQtd} estornos (${formatarMoeda(resumoPreview.somaEstornos)})` : ''}
              </p>
            </div>

            <div className="rounded-[var(--radius-sm)] border border-amber-200 bg-amber-50/50 p-3 shadow-xs">
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-900">Antecipações no Mês</span>
              <p className="mt-1 text-xl font-bold text-amber-900">{formatarMoeda(Math.abs(resumoPreview.somaAntecipacoes))}</p>
              <p className="mt-0.5 text-[11px] text-amber-800">
                {resumoPreview.antecipacoesQtd > 0 ? `${resumoPreview.antecipacoesQtd} pagamento(s) no meio do mês` : 'Nenhuma antecipação'}
              </p>
            </div>

            <div className="rounded-[var(--radius-sm)] border border-purple-200 bg-purple-50/60 p-3 shadow-xs">
              <span className="text-xs font-semibold uppercase tracking-wider text-purple-900">Boleto Fechado (A Pagar)</span>
              <p className="mt-1 text-xl font-bold text-purple-950">{formatarMoeda(resumoPreview.valorBoletoFechado)}</p>
              <p className="mt-0.5 text-[11px] text-purple-800">Saldo restante a pagar no fechamento</p>
            </div>

            <div className="rounded-[var(--radius-sm)] border border-gray-200 bg-gray-50 p-3 shadow-xs">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-700">Quitação Fatura Anterior</span>
              <p className="mt-1 text-xl font-bold text-gray-800">{formatarMoeda(Math.abs(resumoPreview.somaPagamentosAnteriores))}</p>
              <p className="mt-0.5 text-[11px] text-gray-600">
                {resumoPreview.pagamentosAnterioresQtd > 0 ? 'Fatura anterior quitada no início do ciclo' : 'Nenhuma quitação anterior'}
              </p>
            </div>
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-left">
                  <th className="py-2 pr-3">Data</th>
                  <th className="py-2 pr-3">Descrição</th>
                  <th className="py-2 pr-3">Tipo / Status</th>
                  <th className="py-2 pr-3">Valor</th>
                  <th className="py-2 pr-3">Parcelamento</th>
                  <th className="py-2 pr-3">Categoria</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((item, index) => {
                  const isMuted = item.isPagamento
                  return (
                    <tr
                      key={`${item.linha}-${index}`}
                      className={`border-b border-[var(--color-border)]/70 transition-colors ${
                        isMuted ? 'bg-gray-50/50 opacity-60' : item.isEstorno ? 'bg-emerald-50/20' : ''
                      }`}
                    >
                      <td className="py-2 pr-3">{item.date}</td>
                      <td className="py-2 pr-3">
                        <span className={isMuted ? 'line-through text-[var(--color-muted)]' : 'font-medium text-[var(--color-text)]'}>
                          {item.title}
                        </span>
                      </td>
                      <td className="py-2 pr-3">
                        {item.isPagamento ? (
                          <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
                            Pagamento (ignorado)
                          </span>
                        ) : item.isEstorno ? (
                          <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
                            Estorno / Crédito
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                            Compra
                          </span>
                        )}
                      </td>
                      <td className={`py-2 pr-3 font-semibold ${item.amount < 0 ? 'text-emerald-700' : 'text-[var(--color-text)]'}`}>
                        {formatarMoeda(item.amount)}
                      </td>
                      <td className="py-2 pr-3">
                        {item.parcelado ? (
                          <span className="rounded bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-xs text-amber-800">
                            Parc. {item.parcela_atual}/{item.total_parcelas}
                          </span>
                        ) : (
                          <span className="text-xs text-[var(--color-muted)]">À vista</span>
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        {item.isPagamento ? (
                          <span className="text-xs text-[var(--color-muted)]">Não se aplica</span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <select
                              value={item.categoria_id ?? ''}
                              onChange={(event) => atualizarCategoriaLinha(index, event.target.value ? Number(event.target.value) : null)}
                              className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] px-2 py-1 text-xs"
                            >
                              <option value="">Selecione</option>
                              {categoriasDespesa.map((categoria) => (
                                <option key={categoria.id} value={categoria.id}>
                                  {categoria.nome}
                                </option>
                              ))}
                            </select>
                            {renderBadgeMetodo(item.metodo, item.confianca, item.motivo)}
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="space-y-2 md:hidden">
            {previewRows.map((item, index) => (
              <article
                key={`${item.linha}-mobile-${index}`}
                className={`rounded-[var(--radius-sm)] border p-2 ${
                  item.isPagamento ? 'border-gray-200 bg-gray-50/50 opacity-60' : item.isEstorno ? 'border-emerald-200 bg-emerald-50/20' : 'border-[var(--color-border)]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className={`text-sm font-medium ${item.isPagamento ? 'line-through text-[var(--color-muted)]' : 'text-[var(--color-text)]'}`}>
                    {item.title}
                  </p>
                  <p className={`text-sm font-semibold ${item.amount < 0 ? 'text-emerald-700' : ''}`}>
                    {formatarMoeda(item.amount)}
                  </p>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--color-muted)]">
                  <span>{item.date}</span>
                  <span>·</span>
                  {item.isPagamento ? (
                    <span className="text-gray-500 font-medium">Pagamento (ignorado)</span>
                  ) : item.isEstorno ? (
                    <span className="text-emerald-700 font-medium">Estorno / Crédito</span>
                  ) : item.parcelado ? (
                    <span>Parc. {item.parcela_atual}/{item.total_parcelas}</span>
                  ) : (
                    <span>À vista</span>
                  )}
                </div>
                {!item.isPagamento ? (
                  <div className="mt-2 flex items-center gap-2">
                    <select
                      value={item.categoria_id ?? ''}
                      onChange={(event) => atualizarCategoriaLinha(index, event.target.value ? Number(event.target.value) : null)}
                      className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] px-2 py-1 text-xs"
                    >
                      <option value="">Selecione categoria</option>
                      {categoriasDespesa.map((categoria) => (
                        <option key={categoria.id} value={categoria.id}>
                          {categoria.nome}
                        </option>
                      ))}
                    </select>
                    {renderBadgeMetodo(item.metodo, item.confianca, item.motivo)}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </article>
      ) : null}

      {resultado ? (
        <article className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">Resultado da Importação</h3>
          <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-5 text-sm">
            <div className="rounded border p-2 bg-emerald-50/50">
              <span className="text-xs text-emerald-700 font-medium">Compras Inseridas</span>
              <p className="text-lg font-bold text-emerald-800">{resultado.sucesso}</p>
            </div>
            <div className="rounded border p-2 bg-teal-50/50">
              <span className="text-xs text-teal-700 font-medium">Estornos Importados</span>
              <p className="text-lg font-bold text-teal-800">{resultado.estornos_importados ?? 0}</p>
            </div>
            <div className="rounded border p-2 bg-blue-50/50">
              <span className="text-xs text-blue-700 font-medium">Parcelas Geradas</span>
              <p className="text-lg font-bold text-blue-800">{resultado.parcelas_geradas}</p>
            </div>
            <div className="rounded border p-2 bg-gray-50">
              <span className="text-xs text-gray-600 font-medium">Pagamentos Ignorados</span>
              <p className="text-lg font-bold text-gray-800">{resultado.pagamentos_ignorados ?? resultado.creditos_ignorados ?? 0}</p>
            </div>
            <div className="rounded border p-2 bg-amber-50/50">
              <span className="text-xs text-amber-700 font-medium">Duplicadas Ignoradas</span>
              <p className="text-lg font-bold text-amber-800">{resultado.duplicadas_ignoradas}</p>
            </div>
          </div>

          <h4 className="mt-4 mb-2 text-sm font-semibold">Erros</h4>
          {resultado.erros.length === 0 ? (
            <p className="text-sm text-[var(--color-muted)]">Nenhum erro no processamento.</p>
          ) : (
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {resultado.erros.map((item, idx) => (
                <li key={idx}>
                  Linha {item.linha}: {item.erro}
                </li>
              ))}
            </ul>
          )}
        </article>
      ) : null}
    </section>
  )
}

function renderBadgeMetodo(metodo?: string, confianca?: number, motivo?: string) {
  if (!metodo || metodo === 'fallback') {
    return (
      <span
        title={motivo || 'Sem correspondência automática'}
        className="inline-flex shrink-0 items-center gap-1 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600 border border-gray-200"
      >
        Revisar
      </span>
    )
  }

  const percent = confianca ? `${Math.round(confianca * 100)}%` : ''
  const styles: Record<string, { bg: string; label: string }> = {
    alias: { bg: 'bg-purple-50 text-purple-700 border-purple-200', label: 'Histórico' },
    regra: { bg: 'bg-blue-50 text-blue-700 border-blue-200', label: 'Regra' },
    historico: { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'Histórico' },
    fuzzy: { bg: 'bg-amber-50 text-amber-700 border-amber-200', label: 'Similar' },
    ia: { bg: 'bg-indigo-50 text-indigo-700 border-indigo-200', label: 'IA' },
  }

  const config = styles[metodo] || { bg: 'bg-gray-100 text-gray-700 border-gray-200', label: metodo }

  return (
    <span
      title={motivo || `Identificado por ${config.label} (${percent})`}
      className={`inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold border ${config.bg}`}
    >
      <span>{config.label}</span>
      {percent ? <span className="opacity-75 font-normal">{percent}</span> : null}
    </span>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium">{label}</label>
      {children}
    </div>
  )
}

async function sugerirCategorias(descricoes: string[], token?: string) {
  try {
    const data = await importacaoService.classificarCategorias({ descricoes }, token)
    return {
      categorias: Array.isArray(data.categorias) ? data.categorias : descricoes.map(() => 'Indefinida'),
      classificacoes: Array.isArray(data.classificacoes) ? data.classificacoes : [],
    }
  } catch {
    return {
      categorias: descricoes.map(() => 'Indefinida'),
      classificacoes: [],
    }
  }
}

async function lerArquivoComoRegistros(file: File) {
  if (file.name.toLowerCase().endsWith('.csv')) {
    return lerCsvComoRegistros(file)
  }

  const buffer = await file.arrayBuffer()
  const XLSX = await import('xlsx')
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: false, raw: false })
  const primeiraAba = workbook.SheetNames[0]
  if (!primeiraAba) return []

  const sheet = workbook.Sheets[primeiraAba]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
  const registros: Array<{ title: string; amount: number; date: string }> = []

  for (const row of rows) {
    const titleRaw = obterCampo(row, ['title', 'descricao', 'descrição', 'historico', 'histórico'])
    const amountRaw = obterCampo(row, ['amount', 'valor', 'value'])
    const dateRaw = obterCampo(row, ['date', 'data', 'transactiondate', 'posteddate'])

    const title = String(titleRaw ?? '').trim()
    const amount = normalizarValorNumerico(amountRaw)
    const date = normalizarData(dateRaw)

    if (!title || !date || !Number.isFinite(amount)) continue

    registros.push({ title, amount, date })
  }

  return registros
}

async function lerCsvComoRegistros(file: File) {
  const text = await file.text()
  const linhas = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0)

  if (linhas.length === 0) return []

  const delimitador = detectarDelimitador(linhas[0])
  const headers = splitCsvLine(linhas[0], delimitador)
  const registros: Array<{ title: string; amount: number; date: string }> = []

  for (let i = 1; i < linhas.length; i += 1) {
    const colunas = splitCsvLine(linhas[i], delimitador)
    const row: Record<string, unknown> = {}

    headers.forEach((header, idx) => {
      row[header] = colunas[idx] ?? ''
    })

    let titleRaw = obterCampo(row, ['title', 'descricao', 'descrição', 'historico', 'histórico'])
    let amountRaw = obterCampo(row, ['amount', 'valor', 'value'])
    let dateRaw = obterCampo(row, ['date', 'data', 'transactiondate', 'posteddate'])

    if (!titleRaw && colunas.length >= 2) titleRaw = colunas[1]
    if ((amountRaw == null || String(amountRaw).trim() === '') && colunas.length >= 3) amountRaw = colunas[2]
    if (!dateRaw && colunas.length >= 1) dateRaw = colunas[0]

    const title = String(titleRaw ?? '').trim()
    const amount = normalizarValorNumerico(amountRaw)
    const date = normalizarData(dateRaw)

    if (!title || !date || !Number.isFinite(amount)) continue
    registros.push({ title, amount, date })
  }

  return registros
}

function detectarDelimitador(headerLine: string) {
  const candidatos = [';', ',', '\t'] as const
  let melhor = ','
  let melhorCount = -1

  for (const delimitador of candidatos) {
    const count = splitCsvLine(headerLine, delimitador).length
    if (count > melhorCount) {
      melhor = delimitador
      melhorCount = count
    }
  }

  return melhor
}

function splitCsvLine(line: string, delimiter: string) {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]

    if (char === '"') {
      const nextChar = line[i + 1]
      if (inQuotes && nextChar === '"') {
        current += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (!inQuotes && char === delimiter) {
      result.push(current.trim())
      current = ''
      continue
    }

    current += char
  }

  result.push(current.trim())
  return result
}

function obterCampo(row: Record<string, unknown>, nomes: string[]) {
  const entries = Object.entries(row)
  for (const [key, value] of entries) {
    const chave = normalizarTexto(key).replace(/[^a-z0-9]/g, '')
    if (
      nomes.some((item) => {
        const nomeNormalizado = normalizarTexto(item).replace(/[^a-z0-9]/g, '')
        return chave === nomeNormalizado || chave.includes(nomeNormalizado) || nomeNormalizado.includes(chave)
      })
    ) {
      return value
    }
  }
  return null
}

function normalizarValorNumerico(valor: unknown) {
  if (typeof valor === 'number') {
    return Number.isFinite(valor) ? valor : NaN
  }
  const texto = String(valor ?? '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/[^0-9,.-]/g, '')
  if (!texto) return NaN

  const temVirgula = texto.includes(',')
  const semMilhar = temVirgula ? texto.replace(/\./g, '') : texto
  const normalizado = semMilhar.replace(/,/g, '.')
  const parsed = Number.parseFloat(normalizado)
  return Number.isFinite(parsed) ? parsed : NaN
}

function normalizarData(valor: unknown) {
  if (typeof valor === 'number' && Number.isFinite(valor)) {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30))
    const millis = excelEpoch.getTime() + valor * 24 * 60 * 60 * 1000
    const dataExcel = new Date(millis)
    const ano = dataExcel.getUTCFullYear()
    const mes = String(dataExcel.getUTCMonth() + 1).padStart(2, '0')
    const dia = String(dataExcel.getUTCDate()).padStart(2, '0')
    return `${ano}-${mes}-${dia}`
  }

  const texto = String(valor ?? '').trim()
  if (!texto) return ''

  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
    return texto
  }

  const br = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (br) {
    return `${br[3]}-${br[2]}-${br[1]}`
  }

  const data = new Date(texto)
  if (!Number.isNaN(data.getTime())) {
    const ano = data.getFullYear()
    const mes = String(data.getMonth() + 1).padStart(2, '0')
    const dia = String(data.getDate()).padStart(2, '0')
    return `${ano}-${mes}-${dia}`
  }

  return ''
}

function normalizarTexto(valor: string) {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function ehPagamentoFatura(title: string): boolean {
  const norm = normalizarTexto(title)
  const termos = [
    'pagamento recebido',
    'pagamento da fatura',
    'pagamento fatura',
    'pagamento de fatura',
    'pagamento cartao',
    'pagamento efetuado',
    'pagamento antecipado',
  ]
  return termos.some((termo) => norm.includes(termo))
}

function normalizarDescricaoParcelada(texto: string) {
  const slug = normalizarTexto(texto)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'descricao'
}

function gerarParcelamentoId(descricao: string, totalParcelas: number, valorParcela: number) {
  const slug = normalizarDescricaoParcelada(descricao)
  const total = totalParcelas || 1
  const valorTotal = Math.round(Math.abs(valorParcela || 0) * total * 100)
  return `${slug}-${total}x-${valorTotal}`
}

function detectarParcelamento(descricao: string, valorParcela: number) {
  const resultBase = {
    parcelado: false,
    parcelaAtual: 1,
    totalParcelas: 1,
    valorParcela,
    parcelamentoId: null as string | null,
    descricaoLimpa: descricao.trim(),
  }

  const padroes = [
    /parcela\s*\(\s*(\d{1,2})\s*\/\s*(\d{1,2})\s*\)/i,
    /parc\.?\s*(\d{1,2})\s*\/\s*(\d{1,2})/i,
    /(?:-|\s)parcela\s*(\d{1,2})\s*\/\s*(\d{1,2})/i,
    /(\d{1,2})\s*\/\s*(\d{1,2})\s*parc(?:elas)?/i,
    // Sufixo "- N/M" no fim do título (ex.: "Apple Store #R095 - 2/5", "Western Union - 2/2")
    /[-\u2013]\s*(\d{1,2})\s*\/\s*(\d{1,2})\s*$/,
  ]

  for (const regex of padroes) {
    const match = descricao.match(regex)
    if (!match) continue

    const parcelaAtual = Number.parseInt(match[1], 10) || 1
    const totalParcelas = Number.parseInt(match[2], 10) || parcelaAtual || 1
    const descricaoLimpa = descricao
      .replace(regex, '')
      .replace(/\s{2,}/g, ' ')
      .replace(/-\s*-/, '-')
      .replace(/\s+-\s+/g, ' - ')
      .trim()

    return {
      parcelado: totalParcelas > 1,
      parcelaAtual,
      totalParcelas,
      valorParcela,
      parcelamentoId: gerarParcelamentoId(descricaoLimpa || descricao, totalParcelas, valorParcela),
      descricaoLimpa: descricaoLimpa || descricao.trim(),
    }
  }

  return resultBase
}

function formatarMoeda(valor: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)
}

function normalizarOverride(valor: string): string | null {
  const trimmed = valor.trim()
  return trimmed ? trimmed : null
}
