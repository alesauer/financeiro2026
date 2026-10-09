import { httpClient } from '@/shared/api/httpClient'
import type {
  OpenFinanceConta,
  OpenFinanceConexao,
  OpenFinanceStatus,
  ConnectTokenResponse,
  SyncResumoResponse,
  CartaoOpenFinance,
  SyncCartaoResponse,
} from '@/shared/types/openfinance'

const BASE = '/api/openfinance'

export const openfinanceService = {
  getStatus(token: string) {
    return httpClient.get<OpenFinanceStatus>(`${BASE}/status`, token)
  },

  getConnectToken(token: string, itemId?: string) {
    return httpClient.post<ConnectTokenResponse>(`${BASE}/connect-token`, { itemId }, token)
  },

  listConexoes(token: string) {
    return httpClient.get<{ items: OpenFinanceConexao[]; total: number }>(`${BASE}/conexoes`, token)
  },

  listCartoes(token: string) {
    return httpClient.get<{ cartoes: CartaoOpenFinance[] }>(`${BASE}/cartoes`, token)
  },

  registerConexao(token: string, itemId: string) {
    return httpClient.post<{ message: string; conexao_id: number; connector_name: string; status: string }>(
      `${BASE}/conexoes`,
      { itemId },
      token
    )
  },

  syncConexao(token: string, conexaoId: number) {
    return httpClient.post<SyncResumoResponse>(`${BASE}/conexoes/${conexaoId}/sync`, {}, token)
  },

  syncCartao(token: string, payload: { forma_pagamento_id?: number; conta_map_id?: number; mes_fatura?: string }) {
    return httpClient.post<SyncCartaoResponse>(`${BASE}/sync_cartao`, payload, token)
  },

  disconnectConexao(token: string, conexaoId: number) {
    return httpClient.del<{ message: string }>(`${BASE}/conexoes/${conexaoId}`, token)
  },

  updateConta(token: string, contaId: number, payload: { sincronizar?: boolean; forma_pagamento_id?: number | null }) {
    return httpClient.put<{ message: string; conta: Partial<OpenFinanceConta> }>(
      `${BASE}/contas/${contaId}`,
      payload,
      token
    )
  },
}
