export type InvestmentWallet = {
  id: number
  nome: string
  cor: string
  moeda: string
  observacoes: string | null
  ativo: boolean
  created_at: string
  updated_at: string
}

export type InvestmentWalletPayload = {
  nome: string
  cor?: string
  moeda?: string
  observacoes?: string | null
  ativo?: boolean
}

export type InvestmentAssetType =
  | 'Ações'
  | 'FIIs'
  | 'ETFs'
  | 'BDRs'
  | 'Tesouro Direto'
  | 'CDB'
  | 'LCI'
  | 'LCA'
  | 'Debêntures'
  | 'Fundos'
  | 'Criptomoedas'
  | 'Previdência'

export type InvestmentAsset = {
  id: number
  wallet_id: number
  codigo: string
  nome: string
  tipo: InvestmentAssetType
  setor: string | null
  bolsa: string | null
  moeda: string
  ativo: boolean
  created_at: string
  updated_at: string
}

export type InvestmentAssetPayload = {
  wallet_id: number
  codigo: string
  nome: string
  tipo: InvestmentAssetType
  setor?: string | null
  bolsa?: string | null
  moeda?: string
  ativo?: boolean
}

export type InvestmentTransactionType =
  | 'Compra'
  | 'Venda'
  | 'Dividendos'
  | 'JCP'
  | 'Bonificação'
  | 'Split'
  | 'Grupamento'
  | 'Aporte'
  | 'Resgate'

export type InvestmentTransaction = {
  id: number
  wallet_id: number
  asset_id: number | null
  tipo: InvestmentTransactionType
  data_movimentacao: string
  quantidade: string | null
  preco: string | null
  taxas: string
  valor_total: string
  corretora: string | null
  observacoes: string | null
  ativo_codigo: string | null
  ativo_nome: string | null
  created_at: string
  updated_at: string
}

export type InvestmentTransactionPayload = {
  wallet_id: number
  asset_id?: number | null
  tipo: InvestmentTransactionType
  data_movimentacao?: string
  quantidade?: string | null
  preco?: string | null
  taxas?: string
  valor_total?: string
  corretora?: string | null
  observacoes?: string | null
}

export type InvestmentQuote = {
  id: number
  asset_id: number
  provider: string
  preco: string
  variacao_percentual: string | null
  moeda: string
  cotado_em: string
  created_at: string
  updated_at: string
}

export type InvestmentDashboard = {
  patrimonio_total: number
  valor_investido: number
  lucro_prejuizo: number
  rentabilidade_percentual: number
  dividendos_mes: number
  aporte_mes: number
  alocacao_por_tipo: Array<{
    tipo: string
    valor: number
    percentual: number
  }>
  ativos: Array<{
    asset_id: number
    codigo: string
    nome: string
    tipo: string
    quantidade: number
    preco_atual: number
    valor_atual: number
    valor_investido: number
    p_l: number
  }>
}

export type MarketSnapshotItem = {
  symbol: string
  name: string
  price: number | null
  change: number | null
  change_percent: number | null
  currency: string
  market_state: string | null
}

export type MarketSnapshotResponse = {
  source: string
  indices: MarketSnapshotItem[]
  movers: MarketSnapshotItem[]
  fx: MarketSnapshotItem[]
  updated_at: string | null
}
