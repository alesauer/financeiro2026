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

export type InvestmentDashboardAsset = {
  asset_id: number
  codigo: string
  nome: string
  tipo: string
  classe_macro?: 'Renda Fixa' | 'Renda Variável'
  setor?: string | null
  bolsa?: string | null
  quantidade: number
  preco_medio?: number
  preco_atual: number
  valor_atual: number
  valor_investido: number
  p_l: number
  rentabilidade_percentual?: number
  variacao_dia?: number | null
  peso_carteira?: number
}

export type InvestmentDashboard = {
  patrimonio_total: number
  valor_investido: number
  lucro_prejuizo: number
  rentabilidade_percentual: number
  patrimonio_renda_fixa?: number
  patrimonio_renda_variavel?: number
  investido_renda_fixa?: number
  investido_renda_variavel?: number
  lucro_renda_variavel?: number
  rentabilidade_renda_variavel?: number
  dividendos_mes: number
  aporte_mes: number
  alocacao_por_tipo: Array<{
    tipo: string
    valor: number
    percentual: number
  }>
  ativos: InvestmentDashboardAsset[]
}

export type MarketSnapshotItem = {
  symbol: string
  name: string
  price: number | null
  change: number | null
  change_percent: number | null
  currency: string
  market_state?: string | null
  logo?: string | null
  max_52w?: number | null
  min_52w?: number | null
  pl?: number | null
  lpa?: number | null
  volume?: number | null
}

export type MarketSearchResult = {
  symbol: string
  name: string
  price: number | null
  change: number | null
  change_percent: number | null
  currency: string
  logo?: string | null
  sector?: string | null
  subsector?: string | null
  type?: string | null
  volume?: number | null
  market_cap?: number | null
}


export type IndicadorBcb = {
  nome: string
  valor: number
  periodo: string
  atualizado_em: string | null
  cor: string
}

export type TesouroTitulo = {
  titulo: string
  tipo: string
  indexador: string
  rentabilidade_anual: string
  taxa_estimada: number
  vencimento: string
  investimento_minimo: number
  preco_unitario: number
  risco: string
  indicacao: string
  isento_ir: boolean
}

export type MarketSnapshotResponse = {
  source: string
  indices: MarketSnapshotItem[]
  movers: MarketSnapshotItem[]
  acoes: MarketSnapshotItem[]
  fiis: MarketSnapshotItem[]
  bdrs_etfs: MarketSnapshotItem[]
  renda_fixa: {
    indicadores: Record<string, IndicadorBcb>
    tesouro_direto: TesouroTitulo[]
  }
  fx: MarketSnapshotItem[]
  updated_at: string | null
}

export type SimulacaoRendaFixaItem = {
  nome: string
  tipo: string
  taxa_desc: string
  cor: string
  isento_ir: boolean
  saldo_bruto: number
  imposto_renda: number
  saldo_liquido: number
  rendimento_liquido: number
  rentabilidade_pct: number
  equivalente_cdb_pct_cdi?: number | null
}

export type SimulacaoRendaFixaResponse = {
  parametros: {
    valor_inicial: number
    prazo_meses: number
    aporte_mensal: number
    total_investido: number
    aliquota_ir_pct: number
    cdi_anual_pct: number
    selic_anual_pct: number
    ipca_anual_pct: number
  }
  resultados: SimulacaoRendaFixaItem[]
  indicadores: Record<string, IndicadorBcb>
}
