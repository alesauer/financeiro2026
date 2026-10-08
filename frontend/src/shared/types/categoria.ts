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

export type RegraSistemaItem = {
  id: string
  categoria: string
  categoria_id: number | null
  categoria_tipo: CategoriaTipo
  confianca: number
  padrao_regex: string
  origem: string
  icone: string
  exemplos: string[]
  descricao: string
}

export type CategoriaAliasItem = {
  id: number
  descricao_normalizada: string
  descricao_exemplo: string
  categoria_id: number
  categoria_nome: string
  categoria_tipo: CategoriaTipo
  origem: string
  ocorrencias: number
  confianca: number
  atualizado_em: string | null
}

export type AssociacoesResponse = {
  regras_sistema: RegraSistemaItem[]
  aliases: CategoriaAliasItem[]
  totais: {
    total_regras_sistema: number
    total_aliases_aprendidos: number
    total_estabelecimentos_mapeados: number
  }
}

export type SalvarAliasPayload = {
  descricao: string
  categoria_id: number
}

export type AtualizarAliasPayload = {
  categoria_id?: number
  descricao_exemplo?: string
}

export type TestarAssociacaoResultado = {
  descricao_original: string
  descricao_normalizada: string
  categoria: string
  categoria_id: number | null
  confianca: number
  metodo: string
  motivo: string
}

