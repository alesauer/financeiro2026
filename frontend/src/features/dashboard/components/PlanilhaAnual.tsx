import { useMemo } from 'react'

import type { MatrizAnual, MatrizLinha, MatrizSecaoChave, MatrizTipo } from '@/shared/types/relatorio'
import { formatCurrency } from '@/shared/utils/date'

type CelulaClickPayload = {
  secao: MatrizSecaoChave
  tipo: MatrizTipo
  mes: number
  linha: MatrizLinha | null
}

type Props = {
  dados: MatrizAnual
  onCelulaClick?: (payload: CelulaClickPayload) => void
}

const SECOES: { secao: MatrizSecaoChave; tipo: MatrizTipo; titulo: string; cor: string }[] = [
  { secao: 'Receita', tipo: 'Receita', titulo: 'RECEITAS', cor: 'text-emerald-700' },
  { secao: 'Despesa', tipo: 'Despesa', titulo: 'DESPESAS', cor: 'text-rose-700' },
  { secao: 'Cartoes', tipo: 'Despesa', titulo: 'CARTÕES', cor: 'text-orange-700' },
  { secao: 'Investimento', tipo: 'Investimento', titulo: 'INVESTIMENTOS', cor: 'text-sky-700' },
]

const MESES_CURTOS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

function valorOuTraco(valor: number) {
  if (!valor) return '-'
  return formatCurrency(valor)
}

const stickyCol = 'sticky left-0 z-10 bg-[var(--color-surface)]'

export function PlanilhaAnual({ dados, onCelulaClick }: Props) {
  const mesAtual = useMemo(() => {
    const hoje = new Date()
    return hoje.getFullYear() === dados.ano ? hoje.getMonth() : -1
  }, [dados.ano])

  const temDados = useMemo(() => {
    return SECOES.some((secao) => (dados.secoes[secao.secao] ?? []).length > 0)
  }, [dados])

  const destacar = (indice: number) => (indice === mesAtual ? 'bg-amber-50' : '')

  if (!temDados) {
    return (
      <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center text-sm text-[var(--color-muted)]">
        Nenhuma transação encontrada para {dados.ano}.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)]">
      <table className="w-full min-w-[1100px] border-collapse text-xs">
        <thead className="sticky top-0 z-20 bg-[var(--color-surface)]">
          <tr className="border-b border-[var(--color-border)]">
            <th className={`${stickyCol} w-56 border-r border-[var(--color-border)] px-3 py-2 text-left font-semibold uppercase tracking-wide text-[var(--color-muted)]`}>
              Descrição
            </th>
            {dados.meses.map((mes, indice) => (
              <th
                key={mes}
                className={`px-3 py-2 text-right font-semibold text-[var(--color-text)] ${destacar(indice)}`}
                title={mes}
              >
                {MESES_CURTOS[indice]}
              </th>
            ))}
            <th className="border-l border-[var(--color-border)] px-3 py-2 text-right font-semibold text-[var(--color-text)]">
              Total
            </th>
          </tr>
        </thead>

        <tbody>
          {/* ---------- SUMÁRIO ---------- */}
          <tr className="bg-slate-100">
            <td colSpan={14} className={`${stickyCol} bg-slate-100 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-slate-600`}>
              Sumário
            </td>
          </tr>

          <LinhaSumario
            rotulo="Total Receita"
            valores={dados.sumario.receita}
            total={dados.sumario.totais.receita}
            classe="text-emerald-700"
            destacar={destacar}
          />
          <LinhaSumario
            rotulo="Total Despesa"
            valores={dados.sumario.despesa}
            total={dados.sumario.totais.despesa}
            classe="text-rose-700"
            destacar={destacar}
          />
          <LinhaSumario
            rotulo="Total Investimento"
            valores={dados.sumario.investimento}
            total={dados.sumario.totais.investimento}
            classe="text-sky-700"
            destacar={destacar}
          />
          <LinhaSumario
            rotulo="Saldo (Receita - Despesa)"
            valores={dados.sumario.saldo}
            total={dados.sumario.totais.saldo}
            classe="font-semibold"
            destacar={destacar}
            saldo
          />

          {/* ---------- SEÇÕES DETALHADAS ---------- */}
          {SECOES.map((secao) => {
            const linhas = dados.secoes[secao.secao] ?? []
            if (linhas.length === 0) return null

            const subtotal = Array.from({ length: 12 }, (_, i) =>
              linhas.reduce((acc, linha) => acc + (linha.valores[i] ?? 0), 0),
            )
            const totalSecao = linhas.reduce((acc, linha) => acc + linha.total, 0)

            return (
              <FragmentoSecao
                key={secao.secao}
                secao={secao.secao}
                tipo={secao.tipo}
                titulo={secao.titulo}
                cor={secao.cor}
                linhas={linhas}
                subtotal={subtotal}
                totalSecao={totalSecao}
                destacar={destacar}
                onCelulaClick={onCelulaClick}
              />
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

type LinhaSumarioProps = {
  rotulo: string
  valores: number[]
  total: number
  classe?: string
  destacar: (indice: number) => string
  saldo?: boolean
}

function LinhaSumario({ rotulo, valores, total, classe = '', destacar, saldo = false }: LinhaSumarioProps) {
  const corValor = (valor: number) => {
    if (!saldo) return ''
    if (valor > 0) return 'text-emerald-700'
    if (valor < 0) return 'text-rose-700'
    return ''
  }

  return (
    <tr className="border-b border-[var(--color-border)] bg-slate-50/60">
      <td className={`${stickyCol} border-r border-[var(--color-border)] bg-slate-50 px-3 py-1.5 font-semibold ${classe}`}>
        {rotulo}
      </td>
      {valores.map((valor, indice) => (
        <td key={indice} className={`px-3 py-1.5 text-right tabular-nums ${classe} ${corValor(valor)} ${destacar(indice)}`}>
          {valorOuTraco(valor)}
        </td>
      ))}
      <td className={`border-l border-[var(--color-border)] px-3 py-1.5 text-right font-bold tabular-nums ${classe} ${corValor(total)}`}>
        {valorOuTraco(total)}
      </td>
    </tr>
  )
}

type FragmentoSecaoProps = {
  secao: MatrizSecaoChave
  tipo: MatrizTipo
  titulo: string
  cor: string
  linhas: MatrizLinha[]
  subtotal: number[]
  totalSecao: number
  destacar: (indice: number) => string
  onCelulaClick?: (payload: CelulaClickPayload) => void
}

function FragmentoSecao({
  secao,
  tipo,
  titulo,
  cor,
  linhas,
  subtotal,
  totalSecao,
  destacar,
  onCelulaClick,
}: FragmentoSecaoProps) {
  return (
    <>
      <tr className="bg-slate-100">
        <td colSpan={14} className={`${stickyCol} bg-slate-100 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest ${cor}`}>
          {titulo}
        </td>
      </tr>

      {linhas.map((linha) => (
        <tr key={`${secao}-${linha.chave}`} className="border-b border-[var(--color-border)] hover:bg-slate-50">
          <td className={`${stickyCol} border-r border-[var(--color-border)] px-3 py-1.5 text-[var(--color-text)]`} title={linha.chave}>
            <span className="block max-w-[13rem] truncate">{linha.chave}</span>
          </td>
          {linha.valores.map((valor, indice) => (
            <td key={indice} className={`px-0 py-0 text-right tabular-nums ${destacar(indice)}`}>
              {valor ? (
                <button
                  type="button"
                  onClick={() => onCelulaClick?.({ secao, tipo, mes: indice, linha })}
                  className="w-full px-3 py-1.5 text-right transition-colors hover:bg-sky-100 hover:underline"
                  title="Ver transações do mês"
                >
                  {formatCurrency(valor)}
                </button>
              ) : (
                <span className="block px-3 py-1.5 text-[var(--color-muted)]">-</span>
              )}
            </td>
          ))}
          <td className="border-l border-[var(--color-border)] px-3 py-1.5 text-right font-semibold tabular-nums">
            {valorOuTraco(linha.total)}
          </td>
        </tr>
      ))}

      <tr className="border-b-2 border-[var(--color-border)] bg-slate-50/80">
        <td className={`${stickyCol} border-r border-[var(--color-border)] bg-slate-50 px-3 py-1.5 text-[11px] font-semibold uppercase text-[var(--color-muted)]`}>
          Subtotal
        </td>
        {subtotal.map((valor, indice) => (
          <td key={indice} className={`px-3 py-1.5 text-right font-semibold tabular-nums ${destacar(indice)}`}>
            {valorOuTraco(valor)}
          </td>
        ))}
        <td className="border-l border-[var(--color-border)] px-3 py-1.5 text-right font-bold tabular-nums">
          {valorOuTraco(totalSecao)}
        </td>
      </tr>
    </>
  )
}

export type { CelulaClickPayload }
