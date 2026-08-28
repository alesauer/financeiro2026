import { httpClient } from '@/shared/api/httpClient'
import type {
  InvestmentAsset,
  InvestmentAssetPayload,
  InvestmentDashboard,
  MarketSnapshotResponse,
  InvestmentQuote,
  InvestmentTransaction,
  InvestmentTransactionPayload,
  InvestmentWallet,
  InvestmentWalletPayload,
} from '@/shared/types/investimento'

const BASE = '/api/investimentos'

export const investimentosService = {
  listWallets(token: string) {
    return httpClient.get<InvestmentWallet[]>(`${BASE}/wallets`, token)
  },
  createWallet(token: string, payload: InvestmentWalletPayload) {
    return httpClient.post<InvestmentWallet>(`${BASE}/wallets`, payload, token)
  },
  updateWallet(token: string, id: number, payload: Partial<InvestmentWalletPayload>) {
    return httpClient.put<InvestmentWallet>(`${BASE}/wallets/${id}`, payload, token)
  },
  deleteWallet(token: string, id: number) {
    return httpClient.del<{ message: string }>(`${BASE}/wallets/${id}`, token)
  },

  listAssets(token: string, walletId?: number) {
    const query = walletId ? `?wallet_id=${walletId}` : ''
    return httpClient.get<InvestmentAsset[]>(`${BASE}/assets${query}`, token)
  },
  createAsset(token: string, payload: InvestmentAssetPayload) {
    return httpClient.post<InvestmentAsset>(`${BASE}/assets`, payload, token)
  },
  updateAsset(token: string, id: number, payload: Partial<InvestmentAssetPayload>) {
    return httpClient.put<InvestmentAsset>(`${BASE}/assets/${id}`, payload, token)
  },
  deleteAsset(token: string, id: number) {
    return httpClient.del<{ message: string }>(`${BASE}/assets/${id}`, token)
  },

  listTransactions(token: string, walletId?: number, assetId?: number) {
    const params = new URLSearchParams()
    if (walletId) params.set('wallet_id', String(walletId))
    if (assetId) params.set('asset_id', String(assetId))
    const query = params.toString() ? `?${params.toString()}` : ''
    return httpClient.get<InvestmentTransaction[]>(`${BASE}/transactions${query}`, token)
  },
  createTransaction(token: string, payload: InvestmentTransactionPayload) {
    return httpClient.post<InvestmentTransaction>(`${BASE}/transactions`, payload, token)
  },
  updateTransaction(token: string, id: number, payload: Partial<InvestmentTransactionPayload>) {
    return httpClient.put<InvestmentTransaction>(`${BASE}/transactions/${id}`, payload, token)
  },
  deleteTransaction(token: string, id: number) {
    return httpClient.del<{ message: string }>(`${BASE}/transactions/${id}`, token)
  },

  listQuotes(token: string, walletId?: number) {
    const query = walletId ? `?wallet_id=${walletId}` : ''
    return httpClient.get<InvestmentQuote[]>(`${BASE}/quotes${query}`, token)
  },
  refreshQuotes(token: string, walletId?: number, ttlMin = 15) {
    return httpClient.post<{ updated: number; skipped: number; items: InvestmentQuote[] }>(
      `${BASE}/quotes/refresh`,
      { wallet_id: walletId, ttl_min: ttlMin },
      token,
    )
  },

  dashboard(token: string, walletId?: number) {
    const query = walletId ? `?wallet_id=${walletId}` : ''
    return httpClient.get<InvestmentDashboard>(`${BASE}/dashboard${query}`, token)
  },

  marketSnapshot(token: string) {
    return httpClient.get<MarketSnapshotResponse>(`${BASE}/mercado/snapshot`, token)
  },
}
