export type MilhaTipo = 'entrada' | 'saida'

export type Milha = {
  id: number
  usuario_id: number
  programa: string
  tipo: MilhaTipo
  quantidade: number
  origem: string | null
  data_movimentacao: string | null
  data_expiracao: string | null
  descricao: string | null
  created_at: string
  updated_at: string
}

export type MilhaPayload = {
  programa: string
  tipo: MilhaTipo
  quantidade: number
  origem: string | null
  data_movimentacao: string | null
  data_expiracao: string | null
  descricao: string | null
}
