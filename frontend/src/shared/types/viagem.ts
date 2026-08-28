import type { PaginatedResponse } from '@/shared/types/lembrete'

export type ViagemStatus = 'Planejada' | 'Em andamento' | 'Finalizada' | 'Cancelada'

export type Viagem = {
  id: number
  usuario_id: number
  titulo: string
  destino: string
  data_inicio: string
  data_termino: string
  descricao: string | null
  status: ViagemStatus
  custo_total: string
  created_at: string
  updated_at: string
  resumo_categorias?: Array<{ tipo: string; total: number; percentual: number }>
}

export type ViagemPayload = {
  titulo: string
  destino: string
  data_inicio: string
  data_termino: string
  descricao: string | null
  status: ViagemStatus
}

export type ViagemCusto = {
  id: number
  viagem_id: number
  nome: string
  descricao: string
  observacao: string | null
  link: string | null
  tipo: string
  data_gasto: string
  valor: string
  forma_pagamento: string | null
  created_at: string
  updated_at: string
}

export type ViagemCustoPayload = {
  nome: string
  descricao: string
  observacao: string | null
  link: string | null
  tipo: string
  data_gasto: string
  valor: number
  forma_pagamento: string | null
}

export type ViagemRoteiroItem = {
  id?: number
  data: string
  descricao: string | null
}

export type ViagemPaginated = PaginatedResponse<Viagem>
