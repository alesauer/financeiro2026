/**
 * Exportação dos gráficos sem dependências extras.
 * O Recharts renderiza SVG, então serializamos SVG -> canvas -> PNG.
 * O PDF usa o jsPDF, que já é dependência do projeto.
 */

const ESCALA = 2

async function svgParaCanvas(svg: SVGSVGElement): Promise<HTMLCanvasElement> {
  const rect = svg.getBoundingClientRect()
  const largura = rect.width || Number(svg.getAttribute('width')) || 600
  const altura = rect.height || Number(svg.getAttribute('height')) || 400

  const clone = svg.cloneNode(true) as SVGSVGElement
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.setAttribute('width', String(largura))
  clone.setAttribute('height', String(altura))

  // Fundo branco, já que o SVG é transparente
  const fundo = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
  fundo.setAttribute('width', '100%')
  fundo.setAttribute('height', '100%')
  fundo.setAttribute('fill', '#ffffff')
  clone.insertBefore(fundo, clone.firstChild)

  const markup = new XMLSerializer().serializeToString(clone)
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`

  const imagem = new Image()
  imagem.crossOrigin = 'anonymous'

  await new Promise<void>((resolve, reject) => {
    imagem.onload = () => resolve()
    imagem.onerror = () => reject(new Error('Falha ao converter o gráfico em imagem.'))
    imagem.src = url
  })

  const canvas = document.createElement('canvas')
  canvas.width = largura * ESCALA
  canvas.height = altura * ESCALA

  const contexto = canvas.getContext('2d')
  if (!contexto) throw new Error('Não foi possível criar o contexto de desenho.')

  contexto.fillStyle = '#ffffff'
  contexto.fillRect(0, 0, canvas.width, canvas.height)
  contexto.drawImage(imagem, 0, 0, canvas.width, canvas.height)

  return canvas
}

function baixar(url: string, nome: string) {
  const link = document.createElement('a')
  link.href = url
  link.download = nome
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

/** Exporta um único gráfico como PNG. */
export async function exportarGraficoPng(container: HTMLElement, nomeArquivo: string) {
  const svg = container.querySelector('svg')
  if (!svg) throw new Error('Nenhum gráfico encontrado para exportar.')

  const canvas = await svgParaCanvas(svg as SVGSVGElement)
  baixar(canvas.toDataURL('image/png'), `${nomeArquivo}.png`)
}

/** Exporta todos os gráficos da área informada em um PDF paginado. */
export async function exportarGraficosPdf(container: HTMLElement, titulo: string, nomeArquivo: string) {
  const { jsPDF } = await import('jspdf')

  const svgs = Array.from(container.querySelectorAll('svg')).filter((svg) => {
    const rect = svg.getBoundingClientRect()
    return rect.width > 120 && rect.height > 120
  })

  if (svgs.length === 0) throw new Error('Nenhum gráfico disponível para exportar.')

  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const larguraPagina = pdf.internal.pageSize.getWidth()
  const alturaPagina = pdf.internal.pageSize.getHeight()
  const margem = 12

  pdf.setFontSize(16)
  pdf.text(titulo, margem, 18)
  pdf.setFontSize(9)
  pdf.setTextColor(120)
  pdf.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, margem, 25)
  pdf.setTextColor(0)

  let posicaoY = 34

  for (const svg of svgs) {
    const canvas = await svgParaCanvas(svg as SVGSVGElement)
    const proporcao = canvas.height / canvas.width

    const largura = larguraPagina - margem * 2
    const altura = largura * proporcao

    if (posicaoY + altura > alturaPagina - margem) {
      pdf.addPage()
      posicaoY = margem
    }

    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', margem, posicaoY, largura, altura, undefined, 'FAST')
    posicaoY += altura + 8
  }

  pdf.save(`${nomeArquivo}.pdf`)
}
