export type LembreteStatus = 'Pendente' | 'Concluído'
export type LembretePrioridade = 'Baixa' | 'Média' | 'Alta'

export type Lembrete = {
  id: number
  usuario_id: number
  titulo: string
  descricao: string | null
  categoria: string | null
  data_lembrete: string | null
  hora_lembrete: string | null
  status: LembreteStatus
  prioridade: LembretePrioridade
  created_at: string
  updated_at: string
}

export type LembretePayload = {
  titulo: string
  descricao: string | null
  categoria: string | null
  data_lembrete: string | null
  hora_lembrete: string | null
  status: LembreteStatus
  prioridade: LembretePrioridade
}

export type LembreteListFilters = {
  status?: LembreteStatus | ''
  prioridade?: LembretePrioridade | ''
  data_inicio?: string
  data_fim?: string
  busca?: string
  page?: number
  per_page?: number
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

export type LembreteDashboard = {
  total: number
  pendentes: number
  concluidos: number
  hoje: number
  proximos: Lembrete[]
}
