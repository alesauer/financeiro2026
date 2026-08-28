import { httpClient } from '@/shared/api/httpClient'
import type { Milha, MilhaPayload } from '@/shared/types/milha'
import type { PaginatedResponse } from '@/shared/types/lembrete'

const BASE = '/api/milhas'

export const milhasService = {
  list(token: string, page = 1, perPage = 20) {
    return httpClient.get<PaginatedResponse<Milha>>(`${BASE}/?page=${page}&per_page=${perPage}`, token)
  },
  get(token: string, id: number) {
    return httpClient.get<Milha>(`${BASE}/${id}`, token)
  },
  create(token: string, payload: MilhaPayload) {
    return httpClient.post<Milha>(`${BASE}/`, payload, token)
  },
  update(token: string, id: number, payload: Partial<MilhaPayload>) {
    return httpClient.put<Milha>(`${BASE}/${id}`, payload, token)
  },
  remove(token: string, id: number) {
    return httpClient.del<{ message: string }>(`${BASE}/${id}`, token)
  },
}
