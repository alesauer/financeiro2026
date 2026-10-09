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
