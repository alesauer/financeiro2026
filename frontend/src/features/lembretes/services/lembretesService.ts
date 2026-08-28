import { httpClient } from '@/shared/api/httpClient'
import type {
  Lembrete,
  LembreteDashboard,
  LembreteListFilters,
  LembretePayload,
  LembreteStatus,
  PaginatedResponse,
} from '@/shared/types/lembrete'

const BASE = '/api/lembretes'

function buildListQuery(filters: LembreteListFilters) {
  const search = new URLSearchParams({
    page: String(filters.page ?? 1),
    per_page: String(filters.per_page ?? 20),
  })

  if (filters.status) search.set('status', filters.status)
  if (filters.prioridade) search.set('prioridade', filters.prioridade)
  if (filters.data_inicio) search.set('data_inicio', filters.data_inicio)
  if (filters.data_fim) search.set('data_fim', filters.data_fim)
  if (filters.busca) search.set('busca', filters.busca)

  return search.toString()
}

export const lembretesService = {
  list(token: string, filters: LembreteListFilters) {
    return httpClient.get<PaginatedResponse<Lembrete>>(`${BASE}/?${buildListQuery(filters)}`, token)
  },
  dashboard(token: string) {
    return httpClient.get<LembreteDashboard>(`${BASE}/dashboard`, token)
  },
  get(token: string, id: number) {
    return httpClient.get<Lembrete>(`${BASE}/${id}`, token)
  },
  create(token: string, payload: LembretePayload) {
    return httpClient.post<Lembrete>(`${BASE}/`, payload, token)
  },
  update(token: string, id: number, payload: Partial<LembretePayload>) {
    return httpClient.put<Lembrete>(`${BASE}/${id}`, payload, token)
  },
  patchStatus(token: string, id: number, status: LembreteStatus) {
    return httpClient.patch<Lembrete>(`${BASE}/${id}/status`, { status }, token)
  },
  remove(token: string, id: number) {
    return httpClient.del<{ message: string }>(`${BASE}/${id}`, token)
  },
}
