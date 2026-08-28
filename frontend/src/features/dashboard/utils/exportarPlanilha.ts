import type { MatrizAgrupamento, MatrizAnual } from '@/shared/types/relatorio'

const MESES_CURTOS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

const TITULOS: Record<string, string> = {
  Receita: 'RECEITAS',
  Despesa: 'DESPESAS',
  Cartoes: 'CARTÕES',
  Investimento: 'INVESTIMENTOS',
}

function rotuloAgrupamento(agrupar: MatrizAgrupamento) {
  return agrupar === 'descricao' ? 'Descrição' : 'Categoria'
}

/**
 * Monta a planilha anual em XLSX com o mesmo layout exibido na tela.
 * O pacote `xlsx` é importado dinamicamente para não pesar no bundle inicial.
 */
export async function exportarMatrizAnual(dados: MatrizAnual) {
  const XLSX = await import('xlsx')

  const cabecalho = [rotuloAgrupamento(dados.agrupar), ...MESES_CURTOS, 'Total']
  const linhas: (string | number)[][] = []

  linhas.push([`DESPESAS ${dados.ano}`])
  linhas.push([])
  linhas.push(cabecalho)

  linhas.push(['SUMÁRIO'])
  linhas.push(['Total Receita', ...dados.sumario.receita, dados.sumario.totais.receita])
  linhas.push(['Total Despesa', ...dados.sumario.despesa, dados.sumario.totais.despesa])
  linhas.push(['Total Investimento', ...dados.sumario.investimento, dados.sumario.totais.investimento])
  linhas.push(['Saldo', ...dados.sumario.saldo, dados.sumario.totais.saldo])
  linhas.push([])

  for (const secao of ['Receita', 'Despesa', 'Cartoes', 'Investimento'] as const) {
    const itens = dados.secoes[secao] ?? []
    if (itens.length === 0) continue

    linhas.push([TITULOS[secao]])
    for (const item of itens) {
      linhas.push([item.chave, ...item.valores, item.total])
    }

    const subtotal = Array.from({ length: 12 }, (_, i) => itens.reduce((acc, item) => acc + (item.valores[i] ?? 0), 0))
    const total = itens.reduce((acc, item) => acc + item.total, 0)
    linhas.push(['Subtotal', ...subtotal, total])
    linhas.push([])
  }

  const sheet = XLSX.utils.aoa_to_sheet(linhas)
  sheet['!cols'] = [{ wch: 32 }, ...MESES_CURTOS.map(() => ({ wch: 14 })), { wch: 16 }]

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, `Planilha ${dados.ano}`)
  XLSX.writeFile(workbook, `planilha-anual-${dados.ano}.xlsx`)
}
