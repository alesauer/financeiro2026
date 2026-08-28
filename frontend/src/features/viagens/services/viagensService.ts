import { env } from '@/shared/config/env'
import { httpClient } from '@/shared/api/httpClient'
import type {
  Viagem,
  ViagemCusto,
  ViagemCustoPayload,
  ViagemPaginated,
  ViagemPayload,
  ViagemRoteiroItem,
} from '@/shared/types/viagem'

const BASE = '/api/viagens'

function baseUrl(path: string) {
  if (!env.apiBaseUrl) return path
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${env.apiBaseUrl}${normalized}`
}

export const viagensService = {
  list(token: string, page = 1, perPage = 20, q = '') {
    const query = new URLSearchParams({
      page: String(page),
      per_page: String(perPage),
      q,
    })
    return httpClient.get<ViagemPaginated>(`${BASE}/?${query.toString()}`, token)
  },
  get(token: string, id: number) {
    return httpClient.get<Viagem>(`${BASE}/${id}`, token)
  },
  create(token: string, payload: ViagemPayload) {
    return httpClient.post<Viagem>(`${BASE}/`, payload, token)
  },
  update(token: string, id: number, payload: Partial<ViagemPayload>) {
    return httpClient.put<Viagem>(`${BASE}/${id}`, payload, token)
  },
  remove(token: string, id: number) {
    return httpClient.del<{ message: string }>(`${BASE}/${id}`, token)
  },
  listCustos(token: string, viagemId: number) {
    return httpClient.get<ViagemCusto[]>(`${BASE}/${viagemId}/custos`, token)
  },
  createCusto(token: string, viagemId: number, payload: ViagemCustoPayload) {
    return httpClient.post<ViagemCusto>(`${BASE}/${viagemId}/custos`, payload, token)
  },
  updateCusto(token: string, viagemId: number, custoId: number, payload: Partial<ViagemCustoPayload>) {
    return httpClient.put<ViagemCusto>(`${BASE}/${viagemId}/custos/${custoId}`, payload, token)
  },
  removeCusto(token: string, viagemId: number, custoId: number) {
    return httpClient.del<{ message: string }>(`${BASE}/${viagemId}/custos/${custoId}`, token)
  },
  listRoteiro(token: string, viagemId: number) {
    return httpClient.get<ViagemRoteiroItem[]>(`${BASE}/${viagemId}/roteiro`, token)
  },
  saveRoteiro(token: string, viagemId: number, itens: ViagemRoteiroItem[]) {
    return httpClient.post<ViagemRoteiroItem[]>(`${BASE}/${viagemId}/roteiro`, { itens }, token)
  },
  async exportFile(token: string, viagemId: number, formato: 'csv' | 'pdf') {
    const response = await fetch(baseUrl(`${BASE}/${viagemId}/export?formato=${formato}`), {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}))
      throw new Error(typeof payload === 'string' ? payload : JSON.stringify(payload))
    }

    const disposition = response.headers.get('content-disposition')
    const filenameMatch = disposition?.match(/filename="?([^\"]+)"?/)?.[1]
    const extension = formato === 'pdf' ? 'pdf' : 'csv'
    const filename = filenameMatch || `viagem-${viagemId}.${extension}`
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)

    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  },
}
