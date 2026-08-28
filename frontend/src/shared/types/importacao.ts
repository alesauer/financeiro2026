export type ImportacaoTransacaoItem = {
  title: string
  amount: number
  date: string
  categoria?: string
  categoria_id?: number
  descricao_limpa?: string
  parcelado?: boolean
  parcela_atual?: number
  total_parcelas?: number
  valor_parcela?: number
  parcelamento_id?: string
}

export type ImportacaoPayload = {
  transacoes: ImportacaoTransacaoItem[]
  forma_pagamento_id?: number
  dia_fechamento_override?: number | string | null
  dia_vencimento_override?: number | string | null
}

export type ClassificacaoCategoriasPayload = {
  descricoes: string[]
}

export type ClassificacaoCategoriasResultado = {
  categorias: string[]
  erro?: string
  erros?: string[]
}

export type ImportacaoResultado = {
  sucesso: number
  atualizadas: number
  parcelas_geradas: number
  duplicadas_ignoradas: number
  creditos_ignorados?: number
  erros: Array<{ linha: number; erro: string }>
}
