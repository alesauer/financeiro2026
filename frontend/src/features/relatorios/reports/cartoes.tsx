import { useEffect, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { CHART_COLORS, corDaSerie, eixoProps, formatarEixo } from '@/features/dashboard/charts/chartTheme'
import {
  BarraShare,
  fmt,
  KpiBox,
  PeriodoFiltro,
  ReportShell,
  TabelaCard,
  tdCls,
  tdNumCls,
  thCls,
  thNumCls,
} from '@/features/relatorios/components/ReportShell'
import { relatoriosService } from '@/features/relatorios/services/relatoriosService'
import type {
  RelatorioCartaoItem,
  RelatorioParcelamentosFuturos,
  RelatorioStatusPeriodo,
} from '@/shared/types/relatorio'
import { formatCurrency, formatDateBr, getCurrentMonthRange } from '@/shared/utils/date'
import { getErrorMessage } from '@/shared/utils/error'

const tooltipMoeda = (valor: number | string) => formatCurrency(Number(valor))

const MESES_LABEL: Record<string, string> = {
  '01': 'Jan', '02': 'Fev', '03': 'Mar', '04': 'Abr', '05': 'Mai', '06': 'Jun',
  '07': 'Jul', '08': 'Ago', '09': 'Set', '10': 'Out', '11': 'Nov', '12': 'Dez',
}

function rotuloMes(chave: string) {
  const [ano, mes] = chave.split('-')
  return `${MESES_LABEL[mes] ?? mes}/${ano.slice(2)}`
}

/* ================================================================== */
/* 9. Gastos por cartão                                                */
/* ================================================================== */

export function GastosCartaoReport() {
  const range = getCurrentMonthRange()
  const [inicio, setInicio] = useState(range.firstDay)
  const [fim, setFim] = useState(range.lastDay)
  const [cartoes, setCartoes] = useState<RelatorioCartaoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let ativo = true
    setLoading(true)
    setError(null)
    relatoriosService
      .despesasCartao(inicio, fim)
      .then((dados) => ativo && setCartoes(dados.sort((a, b) => b.total - a.total)))
      .catch((err) => ativo && setError(getErrorMessage(err, 'Não foi possível carregar o relatório.')))
      .finally(() => ativo && setLoading(false))
    return () => {
      ativo = false
    }
  }, [inicio, fim])

  const total = cartoes.reduce((acc, c) => acc + c.total, 0)
  const totalCompras = cartoes.reduce((acc, c) => acc + c.qtd, 0)

  return (
    <ReportShell
      titulo="Gastos por cartão"
      descricao="Total gasto, número de compras e ticket médio de cada cartão de crédito."
      filtros={<PeriodoFiltro inicio={inicio} fim={fim} onChange={(i, f) => (setInicio(i), setFim(f))} />}
      loading={loading}
      error={error}
      exportData={() => ({
        titulo: 'Gastos por cartão',
        subtitulo: `Período: ${inicio} a ${fim}`,
        colunas: ['Cartão', 'Compras', 'Total', 'Ticket médio', 'Participação (%)'],
        linhas: cartoes.map((c) => [
          c.cartao,
          c.qtd,
          c.total,
          c.qtd > 0 ? Number((c.total / c.qtd).toFixed(2)) : 0,
          total > 0 ? Number(((c.total / total) * 100).toFixed(1)) : 0,
        ]),
      })}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <KpiBox titulo="Total nos cartões" valor={fmt(total)} cor={CHART_COLORS.cartoes} destaque />
        <KpiBox titulo="Compras no período" valor={String(totalCompras)} />
        <KpiBox titulo="Ticket médio geral" valor={totalCompras > 0 ? fmt(total / totalCompras) : '—'} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cartoes.map((cartao, i) => (
          <article key={cartao.cartao} className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[var(--color-text)]">{cartao.cartao}</h3>
              <span className="rounded-full bg-[var(--color-bg)] px-2 py-0.5 text-xs text-[var(--color-muted)]">
                {cartao.qtd} compras
              </span>
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums" style={{ color: corDaSerie(i) }}>
              {fmt(cartao.total)}
            </p>
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              Ticket médio {cartao.qtd > 0 ? fmt(cartao.total / cartao.qtd) : '—'}
            </p>
            <div className="mt-3">
              <BarraShare percentual={total > 0 ? (cartao.total / total) * 100 : 0} cor={corDaSerie(i)} />
            </div>
          </article>
        ))}
      </div>

      {cartoes.length > 0 ? (
        <article className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <h3 className="mb-3 text-sm font-semibold text-[var(--color-text)]">Comparativo entre cartões</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cartoes.map((c) => ({ nome: c.cartao, total: c.total }))} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 16 }}>
                <CartesianGrid stroke={CHART_COLORS.grid} horizontal={false} />
                <XAxis type="number" {...eixoProps} tickFormatter={formatarEixo} />
                <YAxis type="category" dataKey="nome" {...eixoProps} width={90} />
                <Tooltip formatter={tooltipMoeda} />
                <Bar dataKey="total" name="Total" radius={[0, 4, 4, 0]}>
                  {cartoes.map((_, i) => (
                    <Cell key={i} fill={corDaSerie(i)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>
      ) : null}
    </ReportShell>
  )
}

/* ================================================================== */
/* 10. Parcelamentos futuros                                           */
/* ================================================================== */

export function ParcelamentosFuturosReport() {
  const [dados, setDados] = useState<RelatorioParcelamentosFuturos | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let ativo = true
    relatoriosService
      .parcelamentosFuturos()
      .then((resposta) => ativo && setDados(resposta))
      .catch((err) => ativo && setError(getErrorMessage(err, 'Não foi possível carregar o relatório.')))
      .finally(() => ativo && setLoading(false))
    return () => {
      ativo = false
    }
  }, [])

  return (
    <ReportShell
      titulo="Parcelamentos futuros"
      descricao="Compromissos já assumidos: parcelas a vencer e impacto mês a mês."
      loading={loading}
      error={error}
      exportData={() =>
        dados
          ? {
              titulo: 'Parcelamentos futuros',
              subtitulo: `Gerado em ${formatDateBr(new Date().toISOString().slice(0, 10))}`,
              colunas: ['Descrição', 'Cartão/Forma', 'Parcela Atual', 'Parcelas Restantes', 'Valor parcela', 'Valor restante', 'Próxima', 'Última'],
              linhas: dados.grupos.map((g) => [
                g.descricao,
                g.forma_pagamento,
                g.parcela_atual && g.total_parcelas ? `${g.parcela_atual}/${g.total_parcelas}` : String(g.total_parcelas ?? '-'),
                String(g.parcelas_restantes),
                g.valor_parcela,
                g.valor_restante,
                formatDateBr(g.proxima_data),
                formatDateBr(g.ultima_data),
              ]),
            }
          : null
      }
    >
      {dados ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <KpiBox titulo="Total comprometido" valor={fmt(dados.total_restante)} cor={CHART_COLORS.cartoes} destaque />
            <KpiBox titulo="Parcelas a vencer" valor={String(dados.qtd_parcelas)} />
            <KpiBox titulo="Compras parceladas ativas" valor={String(dados.qtd_grupos)} />
          </div>

          {dados.mensal.length > 0 ? (
            <article className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
              <h3 className="mb-3 text-sm font-semibold text-[var(--color-text)]">Impacto mês a mês</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dados.mensal.map((m) => ({ ...m, rotulo: rotuloMes(m.mes) }))} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
                    <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
                    <XAxis dataKey="rotulo" {...eixoProps} />
                    <YAxis {...eixoProps} tickFormatter={formatarEixo} width={56} />
                    <Tooltip formatter={tooltipMoeda} />
                    <Bar dataKey="total" name="Parcelas do mês" fill={CHART_COLORS.cartoes} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </article>
          ) : null}

          <TabelaCard titulo="Compras parceladas em aberto" subtitulo="Ordenadas pelo valor restante">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  <th className={thCls}>Descrição</th>
                  <th className={thCls}>Cartão/Forma</th>
                  <th className={thNumCls}>Parcela Atual</th>
                  <th className={thNumCls}>Restantes</th>
                  <th className={thNumCls}>Valor parcela</th>
                  <th className={thNumCls}>Valor restante</th>
                  <th className={thCls}>Próxima</th>
                  <th className={thCls}>Última</th>
                </tr>
              </thead>
              <tbody>
                {dados.grupos.map((grupo, i) => (
                  <tr key={`${grupo.descricao}-${i}`} className="border-b border-[var(--color-border)]/60">
                    <td className={tdCls}>{grupo.descricao}</td>
                    <td className={tdCls}>{grupo.forma_pagamento}</td>
                    <td className={tdNumCls}>
                      <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
                        {grupo.parcela_atual ? `${grupo.parcela_atual} de ${grupo.total_parcelas}` : `${grupo.total_parcelas}x`}
                      </span>
                    </td>
                    <td className={tdNumCls}>
                      <span className="font-semibold text-purple-900">
                        {grupo.parcelas_restantes} {grupo.parcelas_restantes === 1 ? 'parcela' : 'parcelas'}
                      </span>
                    </td>
                    <td className={tdNumCls}>{fmt(grupo.valor_parcela)}</td>
                    <td className={`${tdNumCls} font-medium`}>{fmt(grupo.valor_restante)}</td>
                    <td className={tdCls}>{formatDateBr(grupo.proxima_data)}</td>
                    <td className={tdCls}>{formatDateBr(grupo.ultima_data)}</td>
                  </tr>
                ))}
                {dados.grupos.length === 0 ? (
                  <tr>
                    <td colSpan={7} className={`${tdCls} text-center text-[var(--color-muted)]`}>
                      Nenhum parcelamento com parcelas futuras.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </TabelaCard>
        </>
      ) : null}
    </ReportShell>
  )
}

/* ================================================================== */
/* 11. Contas pendentes × pagas                                        */
/* ================================================================== */

export function PendentesPagasReport() {
  const range = getCurrentMonthRange()
  const [inicio, setInicio] = useState(range.firstDay)
  const [fim, setFim] = useState(range.lastDay)
  const [dados, setDados] = useState<RelatorioStatusPeriodo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let ativo = true
    setLoading(true)
    setError(null)
    relatoriosService
      .statusPeriodo(inicio, fim)
      .then((resposta) => ativo && setDados(resposta))
      .catch((err) => ativo && setError(getErrorMessage(err, 'Não foi possível carregar o relatório.')))
      .finally(() => ativo && setLoading(false))
    return () => {
      ativo = false
    }
  }, [inicio, fim])

  const resumo = dados?.resumo ?? []
  const totalPago = resumo.filter((r) => r.status === 'Pago').reduce((acc, r) => acc + r.total, 0)
  const totalPendente = resumo.filter((r) => r.status === 'Pendente').reduce((acc, r) => acc + r.total, 0)
  const qtdPendentes = resumo.filter((r) => r.status === 'Pendente').reduce((acc, r) => acc + r.qtd, 0)
  const qtdPagas = resumo.filter((r) => r.status === 'Pago').reduce((acc, r) => acc + r.qtd, 0)

  const dadosDonut = [
    { name: 'Pago', value: totalPago },
    { name: 'Pendente', value: totalPendente },
  ].filter((d) => d.value > 0)

  return (
    <ReportShell
      titulo="Contas pendentes × pagas"
      descricao="Status dos lançamentos do período e lista de pendências em aberto."
      filtros={<PeriodoFiltro inicio={inicio} fim={fim} onChange={(i, f) => (setInicio(i), setFim(f))} />}
      loading={loading}
      error={error}
      exportData={() =>
        dados
          ? {
              titulo: 'Contas pendentes',
              subtitulo: `Período: ${inicio} a ${fim}`,
              colunas: ['Descrição', 'Tipo', 'Categoria', 'Forma', 'Data', 'Valor'],
              linhas: dados.pendentes.map((p) => [
                p.descricao,
                p.tipo,
                p.categoria,
                p.forma_pagamento,
                p.data ? formatDateBr(p.data) : '',
                p.valor,
              ]),
            }
          : null
      }
    >
      {dados ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiBox titulo="Total pago" valor={fmt(totalPago)} cor={CHART_COLORS.receita} detalhe={`${qtdPagas} lançamentos`} />
            <KpiBox titulo="Total pendente" valor={fmt(totalPendente)} cor="#d97706" destaque detalhe={`${qtdPendentes} lançamentos`} />
            <KpiBox
              titulo="Percentual quitado"
              valor={totalPago + totalPendente > 0 ? `${((totalPago / (totalPago + totalPendente)) * 100).toFixed(1).replace('.', ',')}%` : '—'}
              detalhe="Sobre o valor total do período"
            />
            <KpiBox titulo="Pendências listadas" valor={String(dados.pendentes.length)} />
          </div>

          <div className="grid gap-4 lg:grid-cols-5">
            <article className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 lg:col-span-2">
              <h3 className="mb-3 text-sm font-semibold text-[var(--color-text)]">Pago × pendente (valor)</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={dadosDonut} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="85%" paddingAngle={2}>
                      {dadosDonut.map((item) => (
                        <Cell key={item.name} fill={item.name === 'Pago' ? '#059669' : '#d97706'} />
                      ))}
                    </Pie>
                    <Tooltip formatter={tooltipMoeda} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </article>

            <div className="lg:col-span-3">
              <TabelaCard titulo="Resumo por tipo e status">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[var(--color-border)]">
                      <th className={thCls}>Tipo</th>
                      <th className={thCls}>Status</th>
                      <th className={thNumCls}>Lançamentos</th>
                      <th className={thNumCls}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resumo.map((item) => (
                      <tr key={`${item.tipo}-${item.status}`} className="border-b border-[var(--color-border)]/60">
                        <td className={tdCls}>{item.tipo}</td>
                        <td className={tdCls}>
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              item.status === 'Pago' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                            }`}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td className={tdNumCls}>{item.qtd}</td>
                        <td className={tdNumCls}>{fmt(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TabelaCard>
            </div>
          </div>

          <TabelaCard titulo="Pendências em aberto" subtitulo="Ordenadas pela data (mais antigas primeiro)">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  <th className={thCls}>Descrição</th>
                  <th className={thCls}>Tipo</th>
                  <th className={thCls}>Categoria</th>
                  <th className={thCls}>Forma</th>
                  <th className={thCls}>Data</th>
                  <th className={thNumCls}>Valor</th>
                </tr>
              </thead>
              <tbody>
                {dados.pendentes.map((item) => (
                  <tr key={item.id} className="border-b border-[var(--color-border)]/60">
                    <td className={tdCls}>{item.descricao}</td>
                    <td className={tdCls}>{item.tipo}</td>
                    <td className={tdCls}>{item.categoria}</td>
                    <td className={tdCls}>{item.forma_pagamento}</td>
                    <td className={tdCls}>{item.data ? formatDateBr(item.data) : '—'}</td>
                    <td className={`${tdNumCls} font-medium`}>{fmt(item.valor)}</td>
                  </tr>
                ))}
                {dados.pendentes.length === 0 ? (
                  <tr>
                    <td colSpan={6} className={`${tdCls} text-center text-[var(--color-muted)]`}>
                      Nenhuma pendência no período. Tudo em dia!
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </TabelaCard>
        </>
      ) : null}
    </ReportShell>
  )
}
