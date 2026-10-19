export type OpenFinanceConta = {
  id: number
  pluggy_account_id: string
  tipo: 'CREDIT' | 'BANK'
  nome: string
  numero?: string | null
  forma_pagamento_id?: number | null
  forma_pagamento_nome?: string | null
  is_cartao: boolean
  sincronizar: boolean
}

export type OpenFinanceConexao = {
  id: number
  item_id: string
  connector_id?: number | null
  connector_name: string
  connector_image_url?: string | null
  connector_primary_color?: string | null
  status: 'UPDATED' | 'UPDATING' | 'LOGIN_ERROR' | 'WAITING_USER_INPUT' | string
  last_sync_at?: string | null
  consent_expires_at?: string | null
  erro_mensagem?: string | null
  contas: OpenFinanceConta[]
}

export type OpenFinanceStatus = {
  configured: boolean
  connected: boolean
  error?: string | null
  details?: {
    authenticated: boolean
    status: string
    token_length: number
  } | null
}

export type ConnectTokenResponse = {
  accessToken: string
}

export type SyncResumoResponse = {
  message: string
  resumo: {
    conexao_id: number
    connector_name: string
    contas_mapeadas: number
    novas_transacoes: number
    duplicadas_ignoradas: number
    pagamentos_fatura_ignorados: number
    status: string
    last_sync_at: string
  }
}

export type CartaoOpenFinance = {
  conta_map_id: number
  conexao_id: number
  conexao_nome: string
  forma_pagamento_id: number
  forma_pagamento_nome: string
  forma_pagamento_icone?: string | null
  forma_pagamento_cor?: string | null
  dia_fechamento?: number | null
  dia_vencimento?: number | null
  pluggy_account_id: string
  pluggy_account_name: string
  sincronizar: boolean
  last_sync_at?: string | null
}

export type SyncCartaoResponse = {
  message: string
  resumo: {
    cartao_nome: string
    forma_pagamento_id: number
    mes_fatura: string
    novas_transacoes: number
    duplicadas_ignoradas: number
    pagamentos_fatura_ignorados: number
    fora_do_mes_ignorados: number
    last_sync_at: string
    resources_collected_at?: string | null
    connector_name?: string | null
  }
}

