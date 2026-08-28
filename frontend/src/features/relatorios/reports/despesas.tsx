import { useEffect, useMemo, useState } from 'react'
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'

import { corDaSerie } from '@/features/dashboard/charts/chartTheme'
import {
  BarraShare,
  fmt,
  KpiBox,
  PeriodoFiltro,
  periodoAnterior,
  ReportShell,
  TabelaCard,
  tdCls,
  tdNumCls,
  thCls,
  thNumCls,
  VariacaoBadge,
} from '@/features/relatorios/components/ReportShell'
import { relatoriosService } from '@/features/relatorios/services/relatoriosService'
import type {
  RelatorioCategoriaItem,
  RelatorioFormaPagamentoItem,
  RelatorioTopDespesaItem,
  RelatorioTotaisItem,
} from '@/shared/types/relatorio'
import { formatCurrency, formatDateBr, getCurrentMonthRange } from '@/shared/utils/date'
import { getErrorMessage } from '@/shared/utils/error'

const tooltipMoeda = (valor: number | string) => formatCurrency(Number(valor))

function usePeriodo() {
  const range = getCurrentMonthRange()
  const [inicio, setInicio] = useState(range.firstDay)
  const [fim, setFim] = useState(range.lastDay)
  return { inicio, fim, setPeriodo: (i: string, f: string) => (setInicio(i), setFim(f)) }
}

/* ================================================================== */
/* 6. Despesas por categoria                                           */
/* ================================================================== */

export function DespesasCategoriaReport() {
  const { inicio, fim, setPeriodo } = usePeriodo()
  const [categorias, setCategorias] = useState<RelatorioCategoriaItem[]>([])
  const [categoriasAnt, setCategoriasAnt] = useState<RelatorioCategoriaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let ativo = true
    setLoading(true)
    setError(null)
    const anterior = periodoAnterior(inicio, fim)
    Promise.all([
      relatoriosService.categorias(inicio, fim, 'Despesa'),
      relatoriosService.categorias(anterior.inicio, anterior.fim, 'Despesa'),
    ])
      .then(([atual, ant]) => {
        if (!ativo) return
        setCategorias(atual.sort((a, b) => b.total - a.total))
        setCategoriasAnt(ant)
      })
      .catch((err) => ativo && setError(getErrorMessage(err, 'Não foi possível carregar o relatório.')))
      .finally(() => ativo && setLoading(false))
    return () => {
      ativo = false
    }
  }, [inicio, fim])

  const total = categorias.reduce((acc, c) => acc + c.total, 0)

  const dadosDonut = useMemo(() => {
    const top = categorias.slice(0, 8)
    const outras = categorias.slice(8).reduce((acc, c) => acc + c.total, 0)
    const dados = top.map((c) => ({ name: c.categoria, value: c.total }))
    if (outras > 0) dados.push({ name: 'Outras', value: outras })
    return dados
  }, [categorias])

  const anteriorPorCategoria = useMemo(() => {
    const mapa = new Map<string, number>()
    categoriasAnt.forEach((c) => mapa.set(c.categoria, c.total))
    return mapa
  }, [categoriasAnt])

  return (
    <ReportShell
      titulo="Despesas por categoria"
      descricao="Composição das despesas com participação percentual e variação vs período anterior."
      filtros={<PeriodoFiltro inicio={inicio} fim={fim} onChange={setPeriodo} />}
      loading={loading}
      error={error}
      exportData={() => ({
        titulo: 'Despesas por categoria',
        subtitulo: `Período: ${inicio} a ${fim}`,
        colunas: ['Categoria', 'Valor', 'Participação (%)', 'Período anterior'],
        linhas: categorias.map((c) => [
          c.categoria,
          c.total,
          total > 0 ? Number(((c.total / total) * 100).toFixed(1)) : 0,
          anteriorPorCategoria.get(c.categoria) ?? 0,
        ]),
      })}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <KpiBox titulo="Total de despesas" valor={fmt(total)} destaque />
        <KpiBox titulo="Categorias com gasto" valor={String(categorias.length)} />
        <KpiBox
          titulo="Maior categoria"
          valor={categorias[0] ? fmt(categorias[0].total) : '—'}
          detalhe={categorias[0]?.categoria ?? 'Sem dados'}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <article className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 lg:col-span-2">
          <h3 className="mb-3 text-sm font-semibold text-[var(--color-text)]">Composição das despesas</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={dadosDonut} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="85%" paddingAngle={2}>
                  {dadosDonut.map((_, i) => (
                    <Cell key={i} fill={corDaSerie(i)} />
                  ))}
                </Pie>
                <Tooltip formatter={tooltipMoeda} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </article>

        <div className="lg:col-span-3">
          <TabelaCard titulo="Detalhamento por categoria" subtitulo="Participação e variação vs período anterior">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  <th className={thCls}>Categoria</th>
                  <th className={thNumCls}>Valor</th>
                  <th className={`${thCls} w-1/4`}>Participação</th>
                  <th className={thNumCls}>Variação</th>
                </tr>
              </thead>
              <tbody>
                {categorias.map((cat, i) => (
                  <tr key={cat.categoria} className="border-b border-[var(--color-border)]/60">
                    <td className={tdCls}>
                      <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: corDaSerie(i) }} />
                      {cat.categoria}
                    </td>
                    <td className={tdNumCls}>{fmt(cat.total)}</td>
                    <td className={tdCls}>
                      <BarraShare percentual={total > 0 ? (cat.total / total) * 100 : 0} cor={corDaSerie(i)} />
                    </td>
                    <td className={`${tdNumCls} text-xs`}>
                      <VariacaoBadge atual={cat.total} anterior={anteriorPorCategoria.get(cat.categoria) ?? null} inverter rotulo="" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TabelaCard>
        </div>
      </div>
    </ReportShell>
  )
}

/* ================================================================== */
/* 7. Top despesas do período                                          */
/* ================================================================== */

export function TopDespesasReport() {
  const { inicio, fim, setPeriodo } = usePeriodo()
  const [limite, setLimite] = useState(20)
  const [itens, setItens] = useState<RelatorioTopDespesaItem[]>([])
  const [totais, setTotais] = useState<RelatorioTotaisItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let ativo = true
    setLoading(true)
    setError(null)
    Promise.all([relatoriosService.topDespesas(inicio, fim, limite), relatoriosService.totais(inicio, fim)])
      .then(([top, t]) => {
        if (!ativo) return
        setItens(top)
        setTotais(t)
      })
      .catch((err) => ativo && setError(getErrorMessage(err, 'Não foi possível carregar o relatório.')))
      .finally(() => ativo && setLoading(false))
    return () => {
      ativo = false
    }
  }, [inicio, fim, limite])

  const totalDespesas = totais.find((t) => t.tipo === 'Despesa')?.total ?? 0
  const somaTop = itens.reduce((acc, i) => acc + i.valor, 0)

  return (
    <ReportShell
      titulo="Top despesas do período"
      descricao="Ranking dos maiores lançamentos individuais e peso sobre o total de despesas."
      filtros={
        <div className="flex flex-wrap items-end gap-3">
          <PeriodoFiltro inicio={inicio} fim={fim} onChange={setPeriodo} />
          <label className="inline-flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted)]">Exibir</span>
            <select
              value={limite}
              onChange={(e) => setLimite(Number(e.target.value))}
              className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
            >
              {[10, 20, 50, 100].map((n) => (
                <option key={n} value={n}>
                  Top {n}
                </option>
              ))}
            </select>
          </label>
        </div>
      }
      loading={loading}
      error={error}
      exportData={() => ({
        titulo: `Top ${limite} despesas`,
        subtitulo: `Período: ${inicio} a ${fim}`,
        colunas: ['#', 'Descrição', 'Categoria', 'Forma de pagamento', 'Data', 'Status', 'Valor'],
        linhas: itens.map((item, i) => [
          i + 1,
          item.descricao,
          item.categoria,
          item.forma_pagamento,
          item.data ? formatDateBr(item.data) : '',
          item.status,
          item.valor,
        ]),
      })}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <KpiBox titulo={`Soma do top ${limite}`} valor={fmt(somaTop)} destaque />
        <KpiBox titulo="Total de despesas" valor={fmt(totalDespesas)} />
        <KpiBox
          titulo="Peso do ranking"
          valor={totalDespesas > 0 ? `${((somaTop / totalDespesas) * 100).toFixed(1).replace('.', ',')}%` : '—'}
          detalhe="Participação do ranking no total"
        />
      </div>

      <TabelaCard titulo={`Maiores lançamentos`} subtitulo={`${itens.length} despesas listadas`}>
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--color-border)]">
              <th className={thCls}>#</th>
              <th className={thCls}>Descrição</th>
              <th className={thCls}>Categoria</th>
              <th className={thCls}>Forma</th>
              <th className={thCls}>Data</th>
              <th className={thCls}>Status</th>
              <th className={thNumCls}>Valor</th>
              <th className={`${thCls} w-1/6`}>% do total</th>
            </tr>
          </thead>
          <tbody>
            {itens.map((item, i) => (
              <tr key={item.id} className="border-b border-[var(--color-border)]/60">
                <td className={`${tdCls} font-semibold text-[var(--color-muted)]`}>{i + 1}</td>
                <td className={tdCls}>{item.descricao}</td>
                <td className={tdCls}>{item.categoria}</td>
                <td className={tdCls}>{item.forma_pagamento}</td>
                <td className={tdCls}>{item.data ? formatDateBr(item.data) : '—'}</td>
                <td className={tdCls}>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      item.status === 'Pago' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {item.status}
                  </span>
                </td>
                <td className={`${tdNumCls} font-medium`}>{fmt(item.valor)}</td>
                <td className={tdCls}>
                  <BarraShare percentual={totalDespesas > 0 ? (item.valor / totalDespesas) * 100 : 0} cor="#f97316" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TabelaCard>
    </ReportShell>
  )
}

/* ================================================================== */
/* 8. Despesas por forma de pagamento                                  */
/* ================================================================== */

export function FormasPagamentoReport() {
  const { inicio, fim, setPeriodo } = usePeriodo()
  const [formas, setFormas] = useState<RelatorioFormaPagamentoItem[]>([])
  const [formasAnt, setFormasAnt] = useState<RelatorioFormaPagamentoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let ativo = true
    setLoading(true)
    setError(null)
    const anterior = periodoAnterior(inicio, fim)
    Promise.all([
      relatoriosService.formasPagamento(inicio, fim),
      relatoriosService.formasPagamento(anterior.inicio, anterior.fim),
    ])
      .then(([atual, ant]) => {
        if (!ativo) return
        setFormas(atual.sort((a, b) => b.total - a.total))
        setFormasAnt(ant)
      })
      .catch((err) => ativo && setError(getErrorMessage(err, 'Não foi possível carregar o relatório.')))
      .finally(() => ativo && setLoading(false))
    return () => {
      ativo = false
    }
  }, [inicio, fim])

  const total = formas.reduce((acc, f) => acc + f.total, 0)
  const anteriorPorForma = useMemo(() => {
    const mapa = new Map<string, number>()
    formasAnt.forEach((f) => mapa.set(f.forma_pagamento, f.total))
    return mapa
  }, [formasAnt])

  return (
    <ReportShell
      titulo="Despesas por forma de pagamento"
      descricao="Movimentação por forma de pagamento com participação e variação."
      filtros={<PeriodoFiltro inicio={inicio} fim={fim} onChange={setPeriodo} />}
      loading={loading}
      error={error}
      exportData={() => ({
        titulo: 'Despesas por forma de pagamento',
        subtitulo: `Período: ${inicio} a ${fim}`,
        colunas: ['Forma de pagamento', 'Valor', 'Participação (%)', 'Período anterior'],
        linhas: formas.map((f) => [
          f.forma_pagamento,
          f.total,
          total > 0 ? Number(((f.total / total) * 100).toFixed(1)) : 0,
          anteriorPorForma.get(f.forma_pagamento) ?? 0,
        ]),
      })}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <KpiBox titulo="Total movimentado" valor={fmt(total)} destaque />
        <KpiBox titulo="Formas utilizadas" valor={String(formas.length)} />
        <KpiBox
          titulo="Forma principal"
          valor={formas[0] ? fmt(formas[0].total) : '—'}
          detalhe={formas[0]?.forma_pagamento ?? 'Sem dados'}
        />
      </div>

      <TabelaCard titulo="Participação por forma de pagamento" subtitulo="Comparação com o período anterior de mesma duração">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--color-border)]">
              <th className={thCls}>Forma de pagamento</th>
              <th className={thNumCls}>Valor</th>
              <th className={`${thCls} w-1/3`}>Participação</th>
              <th className={thNumCls}>Variação</th>
            </tr>
          </thead>
          <tbody>
            {formas.map((forma, i) => (
              <tr key={forma.forma_pagamento} className="border-b border-[var(--color-border)]/60">
                <td className={tdCls}>
                  <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: corDaSerie(i) }} />
                  {forma.forma_pagamento}
                </td>
                <td className={tdNumCls}>{fmt(forma.total)}</td>
                <td className={tdCls}>
                  <BarraShare percentual={total > 0 ? (forma.total / total) * 100 : 0} cor={corDaSerie(i)} />
                </td>
                <td className={`${tdNumCls} text-xs`}>
                  <VariacaoBadge atual={forma.total} anterior={anteriorPorForma.get(forma.forma_pagamento) ?? null} inverter rotulo="" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TabelaCard>
    </ReportShell>
  )
}
