export type MilhaTipo = 'entrada' | 'saida'

export type MilhaCategoriaOrigem =
  | 'Cartão de Crédito'
  | 'Clube de Fidelidade'
  | 'Compra de Pontos'
  | 'Voo / Passagem'
  | 'Transferência'
  | 'Transferência Bonificada'
  | 'Shopping / Parceiros'
  | 'Bônus Promocional'
  | 'Resgate Passagem'
  | 'Resgate Produtos'
  | 'Venda de Milhas'
  | 'Expirada'
  | 'Outros'

export type Milha = {
  id: number
  usuario_id: number
  programa: string
  tipo: MilhaTipo
  quantidade: number
  origem: string | null
  categoria_origem: string | null
  custo_reais: number | null
  taxa_bonus: number | null
  transferencia_id: string | null
  data_movimentacao: string | null
  data_expiracao: string | null
  descricao: string | null
  cpm?: number | null
  created_at: string
  updated_at: string
}

export type MilhaPayload = {
  programa: string
  tipo: MilhaTipo
  quantidade: number
  origem?: string | null
  categoria_origem?: string | null
  custo_reais?: number | null
  taxa_bonus?: number | null
  transferencia_id?: string | null
  data_movimentacao?: string | null
  data_expiracao?: string | null
  descricao?: string | null
}

export type TransferenciaPayload = {
  programa_origem: string
  programa_destino: string
  quantidade: number
  taxa_bonus: number
  data_movimentacao?: string | null
  data_expiracao?: string | null
  custo_reais?: number | null
  observacao?: string | null
}

export type MilhaProgramaResumo = {
  nome: string
  saldo: number
  entradas: number
  saidas: number
  gasto_total_reais: number
  cpm_medio: number | null
  cpm_estimado: number
  valor_estimado: number
  tipo_programa: 'aereo' | 'bancario' | 'hotel' | 'outro'
  cor: string
  proxima_expiracao: string | null
  qtd_expirando_proxima: number
  movimentacoes_count: number
}

export type MilhaLoteExpiracao = {
  id: number
  programa: string
  quantidade: number
  data_expiracao: string
  dias_restantes: number
  urgencia: 'critica' | 'alerta' | 'normal'
}

export type MilhasResumoResponse = {
  saldo_total_milhas: number
  valor_estimado_total: number
  total_entradas: number
  total_saidas: number
  total_gasto_reais: number
  cpm_geral_medio: number | null
  programas: MilhaProgramaResumo[]
  expiracoes: {
    proximos_30d: { total: number; lotes: MilhaLoteExpiracao[] }
    proximos_90d: { total: number; lotes: MilhaLoteExpiracao[] }
    proximos_180d: { total: number; lotes: MilhaLoteExpiracao[] }
    proximos_365d: { total: number; lotes: MilhaLoteExpiracao[] }
    todos: MilhaLoteExpiracao[]
  }
  evolucao: { mes: string; entradas: number; saidas: number }[]
  programas_suportados: string[]
}

export type MilhasFiltros = {
  programa?: string
  tipo?: MilhaTipo | ''
  categoria_origem?: string
  inicio?: string
  fim?: string
  search?: string
  sort_by?: string
  sort_dir?: 'asc' | 'desc'
  page?: number
  per_page?: number
}
