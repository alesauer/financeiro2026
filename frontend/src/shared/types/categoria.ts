export type CategoriaTipo = 'Receita' | 'Despesa' | 'Investimento'

export type Categoria = {
  id: number
  nome: string
  tipo: CategoriaTipo
}

export type CategoriaPayload = {
  nome: string
  tipo: CategoriaTipo
}
