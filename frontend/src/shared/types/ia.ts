export type ClassificacaoItem = {
  categoria: string
  categoria_id?: number | null
  confianca: number
  metodo: 'alias' | 'regra' | 'historico' | 'fuzzy' | 'ia' | 'fallback'
  motivo: string
  descricao_original: string
  descricao_normalizada: string
}

export type ClassificarCategoriaPayload = {
  descricoes: string[]
}

export type ClassificarCategoriaResponse = {
  categorias: string[]
  classificacoes?: ClassificacaoItem[]
  erro?: string
  erros?: string[]
}
