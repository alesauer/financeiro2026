export type FormaPagamento = {
  id: number
  nome: string
  tipo: string
  cartao_credito: boolean
  dia_fechamento: number | null
  dia_vencimento: number | null
  ativo: boolean
  icone?: string | null
  cor?: string | null
}

export type FormaPagamentoPayload = {
  nome: string
  tipo: string
  cartao_credito: boolean
  dia_fechamento: number | null
  dia_vencimento: number | null
  ativo: boolean
  icone?: string | null
  cor?: string | null
}
