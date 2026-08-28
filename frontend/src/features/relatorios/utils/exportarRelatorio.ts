/**
 * Exportação genérica dos relatórios em CSV, XLSX e PDF.
 * Os pacotes pesados (xlsx, jspdf) são importados dinamicamente.
 */

export type DadosExportacao = {
  titulo: string
  subtitulo?: string
  colunas: string[]
  linhas: (string | number | null)[][]
}

function nomeArquivo(titulo: string, extensao: string) {
  const slug = titulo
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
  const data = new Date().toISOString().slice(0, 10)
  return `${slug}-${data}.${extensao}`
}

function formatarCelula(valor: string | number | null) {
  if (valor === null || valor === undefined) return ''
  if (typeof valor === 'number') {
    return valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }
  return valor
}

export function exportarCsv(dados: DadosExportacao) {
  const escapar = (valor: string) => (/[";\n]/.test(valor) ? `"${valor.replace(/"/g, '""')}"` : valor)

  const linhas = [
    dados.colunas.map(escapar).join(';'),
    ...dados.linhas.map((linha) => linha.map((c) => escapar(formatarCelula(c))).join(';')),
  ]

  const blob = new Blob([`\ufeff${linhas.join('\r\n')}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = nomeArquivo(dados.titulo, 'csv')
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export async function exportarXlsx(dados: DadosExportacao) {
  const XLSX = await import('xlsx')

  const aoa: (string | number | null)[][] = [
    [dados.titulo],
    dados.subtitulo ? [dados.subtitulo] : [],
    [],
    dados.colunas,
    ...dados.linhas,
  ].filter((linha) => linha.length > 0 || true)

  const sheet = XLSX.utils.aoa_to_sheet(aoa)
  sheet['!cols'] = dados.colunas.map((_, i) => ({ wch: i === 0 ? 40 : 18 }))

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, 'Relatório')
  XLSX.writeFile(workbook, nomeArquivo(dados.titulo, 'xlsx'))
}

export async function exportarPdf(dados: DadosExportacao) {
  const { jsPDF } = await import('jspdf')

  const doc = new jsPDF({ orientation: dados.colunas.length > 5 ? 'landscape' : 'portrait', unit: 'mm' })
  const larguraPagina = doc.internal.pageSize.getWidth()
  const alturaPagina = doc.internal.pageSize.getHeight()
  const margem = 14
  const larguraUtil = larguraPagina - margem * 2

  // Primeira coluna mais larga (descrições)
  const pesoPrimeira = 2
  const larguraColuna = larguraUtil / (dados.colunas.length - 1 + pesoPrimeira)
  const larguras = dados.colunas.map((_, i) => (i === 0 ? larguraColuna * pesoPrimeira : larguraColuna))

  let y = margem

  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text(dados.titulo, margem, y)
  y += 6

  if (dados.subtitulo) {
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(110)
    doc.text(dados.subtitulo, margem, y)
    doc.setTextColor(0)
    y += 6
  }
  y += 2

  const desenharCabecalho = () => {
    doc.setFillColor(241, 245, 249)
    doc.rect(margem, y - 4, larguraUtil, 7, 'F')
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    let x = margem
    dados.colunas.forEach((coluna, i) => {
      const alinhamento = i === 0 ? x + 1.5 : x + larguras[i] - 1.5
      doc.text(coluna, alinhamento, y, { align: i === 0 ? 'left' : 'right' })
      x += larguras[i]
    })
    y += 6
    doc.setFont('helvetica', 'normal')
  }

  desenharCabecalho()

  for (const linha of dados.linhas) {
    if (y > alturaPagina - margem) {
      doc.addPage()
      y = margem
      desenharCabecalho()
    }

    doc.setFontSize(8)
    let x = margem
    linha.forEach((celula, i) => {
      const texto = formatarCelula(celula)
      const maxLargura = larguras[i] - 3
      const recortado = doc.splitTextToSize(texto, maxLargura)[0] ?? ''
      doc.text(recortado, i === 0 ? x + 1.5 : x + larguras[i] - 1.5, y, { align: i === 0 ? 'left' : 'right' })
      x += larguras[i]
    })

    doc.setDrawColor(226, 232, 240)
    doc.line(margem, y + 1.5, margem + larguraUtil, y + 1.5)
    y += 6
  }

  doc.save(nomeArquivo(dados.titulo, 'pdf'))
}
