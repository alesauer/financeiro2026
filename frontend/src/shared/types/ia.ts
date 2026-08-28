export type ClassificarCategoriaPayload = {
  descricoes: string[]
}

export type ClassificarCategoriaResponse = {
  categorias: string[]
  erro?: string
  erros?: string[]
}
