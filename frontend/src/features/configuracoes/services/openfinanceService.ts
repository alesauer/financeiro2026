import { httpClient } from '@/shared/api/httpClient'
import type {
  OpenFinanceConexao,
  OpenFinanceStatus,
  ConnectTokenResponse,
  SyncResumoResponse,
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

  disconnectConexao(token: string, conexaoId: number) {
    return httpClient.del<{ message: string }>(`${BASE}/conexoes/${conexaoId}`, token)
  },
}
