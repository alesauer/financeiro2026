import type { CategoriaTipo } from '@/shared/types/categoria'

export type TransacaoStatus = 'Pago' | 'Pendente'
export type RecorrenciaTipo = 'Assinatura' | 'Parcelamento'
export type FrequenciaRecorrencia = 'Diária' | 'Semanal' | 'Mensal' | 'Semestral' | 'Anual'

export type Transacao = {
  id: number
  tipo: CategoriaTipo
  categoria_id: number
  categoria_nome?: string | null
  descricao: string
  valor: string
  data_transacao: string
  forma_pagamento_id: number
  forma_pagamento_nome?: string | null
  forma_pagamento_cartao?: boolean
  status: TransacaoStatus
  recorrente: boolean
  recorrencia_tipo: RecorrenciaTipo | null
  frequencia: FrequenciaRecorrencia | null
  data_fim: string | null
  parcelado: boolean
  total_parcelas: number | null
  parcela_atual: number
  valor_parcela: string | null
  parcelamento_id?: string | null
  observacoes: string | null
  competencia_fatura?: string | null
}

export type TransacaoPayload = {
  tipo: CategoriaTipo
  categoria_id: number
  descricao: string
  valor: number
  data_transacao: string
  forma_pagamento_id: number
  status: TransacaoStatus
  recorrente: boolean
  recorrencia_tipo: RecorrenciaTipo | null
  frequencia: FrequenciaRecorrencia | null
  data_fim: string | null
  parcelado: boolean
  total_parcelas: number | null
  observacoes: string | null
}

export type PaginatedResponse<T> = {
  items: T[]
  total_items: number
  total_pages: number
  current_page: number
  per_page: number
  has_next: boolean
  has_prev: boolean
}

export type TransacaoListFilters = {
  inicio: string
  fim: string
  tipo?: CategoriaTipo | ''
  status?: TransacaoStatus | ''
  categoria_id?: number | ''
  forma_pagamento_id?: number | ''
  cartao_credito?: boolean
  sort_field?:
    | 'id'
    | 'data_transacao'
    | 'valor'
    | 'descricao'
    | 'tipo'
    | 'status'
    | 'categoria_id'
    | 'tipo_prioridade'
  sort_order?: 'asc' | 'desc'
  page?: number
  per_page?: number
}

export type TransacaoSummary = {
  receitas: number
  despesas: number
  saldo: number
  cartao_credito_total: number
}
