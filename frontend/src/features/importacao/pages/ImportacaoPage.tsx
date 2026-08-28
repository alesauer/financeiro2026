import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import { useAuth } from '@/app/providers/AuthProvider'
import { categoriasService } from '@/features/categorias/services/categoriasService'
import { formasPagamentoService } from '@/features/formasPagamento/services/formasPagamentoService'
import { importacaoService } from '@/features/importacao/services/importacaoService'
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
  parcelado: boolean
  parcela_atual: number
  total_parcelas: number
  valor_parcela: number
  parcelamento_id: string | null
  descricao_limpa: string
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
      const categoriasSugeridas = await sugerirCategorias(descricoes, token ?? undefined)

      const linhas = registros.map((item, idx) => {
        const sugestao = categoriasSugeridas[idx] || 'Indefinida'
        const categoriaEncontrada = categoriasByNome.get(normalizarTexto(sugestao))
        const analise = detectarParcelamento(item.title, item.amount)
        return {
          linha: idx + 1,
          title: item.title,
          amount: item.amount,
          date: item.date,
          categoria: categoriaEncontrada?.nome ?? sugestao,
          categoria_id: categoriaEncontrada?.id ?? null,
          parcelado: analise.parcelado,
          parcela_atual: analise.parcelaAtual,
          total_parcelas: analise.totalParcelas,
          valor_parcela: analise.valorParcela,
          parcelamento_id: analise.parcelamentoId,
          descricao_limpa: analise.descricaoLimpa,
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
      setAviso(`Importação concluída com sucesso para ${data.sucesso} registro(s).`)
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
      }
      return next
    })
  }

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold text-[var(--color-text)]">Importação de Cartão</h2>
        <p className="text-sm text-[var(--color-muted)]">Importe a fatura por arquivo, revise categorias e confirme o envio.</p>
      </header>

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
          </Field>

          <Field label="Dia de fechamento (override opcional)">
            <input
              value={diaFechamentoOverride}
              onChange={(event) => setDiaFechamentoOverride(event.target.value)}
              placeholder="Ex.: 8 ou 2026-07-08"
              className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-sm"
            />
          </Field>

          <Field label="Dia de vencimento (opcional)">
            <input
              value={diaVencimentoOverride}
              onChange={(event) => setDiaVencimentoOverride(event.target.value)}
              placeholder="Ex.: 15 ou 2026-07-15"
              className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-sm"
            />
          </Field>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={gerarPreview}
            className="rounded-[var(--radius-sm)] bg-[var(--color-primary)] px-3 py-2 text-sm font-semibold text-white"
          >
            {loadingPreview ? 'Processando...' : 'Visualizar'}
          </button>
          <button
            type="button"
            onClick={importar}
            disabled={loadingImportacao || previewRows.length === 0}
            className="rounded-[var(--radius-sm)] border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 disabled:opacity-60"
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
            className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-sm"
          >
            Limpar
          </button>
        </div>

        {aviso ? <p className="mt-3 text-sm text-emerald-700">{aviso}</p> : null}
        {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
      </article>

      {previewRows.length > 0 ? (
        <article className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">Pré-visualização</h3>

          <div className="mb-3 grid gap-2 text-sm md:grid-cols-3">
            <p>Registros: {previewRows.length}</p>
            <p>Parcelados: {previewRows.filter((item) => item.parcelado).length}</p>
            <p>Sem categoria: {previewRows.filter((item) => !item.categoria_id).length}</p>
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-left">
                  <th className="py-2 pr-3">Data</th>
                  <th className="py-2 pr-3">Descrição</th>
                  <th className="py-2 pr-3">Valor</th>
                  <th className="py-2 pr-3">Parcelamento</th>
                  <th className="py-2 pr-3">Categoria</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((item, index) => (
                  <tr key={`${item.linha}-${index}`} className="border-b border-[var(--color-border)]/70">
                    <td className="py-2 pr-3">{item.date}</td>
                    <td className="py-2 pr-3">{item.title}</td>
                    <td className="py-2 pr-3">{formatarMoeda(item.amount)}</td>
                    <td className="py-2 pr-3">
                      {item.parcelado ? `Parc. ${item.parcela_atual}/${item.total_parcelas}` : 'À vista'}
                    </td>
                    <td className="py-2 pr-3">
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
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-2 md:hidden">
            {previewRows.map((item, index) => (
              <article key={`${item.linha}-mobile-${index}`} className="rounded-[var(--radius-sm)] border border-[var(--color-border)] p-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-[var(--color-text)]">{item.title}</p>
                  <p className="text-sm font-semibold">{formatarMoeda(item.amount)}</p>
                </div>
                <p className="mt-1 text-xs text-[var(--color-muted)]">
                  {item.date} · {item.parcelado ? `Parc. ${item.parcela_atual}/${item.total_parcelas}` : 'À vista'}
                </p>
                <select
                  value={item.categoria_id ?? ''}
                  onChange={(event) => atualizarCategoriaLinha(index, event.target.value ? Number(event.target.value) : null)}
                  className="mt-2 w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] px-2 py-1 text-xs"
                >
                  <option value="">Selecione categoria</option>
                  {categoriasDespesa.map((categoria) => (
                    <option key={categoria.id} value={categoria.id}>
                      {categoria.nome}
                    </option>
                  ))}
                </select>
              </article>
            ))}
          </div>
        </article>
      ) : null}

      {resultado ? (
        <article className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">Resultado</h3>
          <div className="grid gap-2 md:grid-cols-4 text-sm">
            <p>Sucesso: {resultado.sucesso}</p>
            <p>Atualizadas: {resultado.atualizadas}</p>
            <p>Parcelas geradas: {resultado.parcelas_geradas}</p>
            <p>Duplicadas ignoradas: {resultado.duplicadas_ignoradas}</p>
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
    return Array.isArray(data.categorias) ? data.categorias : descricoes.map(() => 'Indefinida')
  } catch {
    return descricoes.map(() => 'Indefinida')
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
