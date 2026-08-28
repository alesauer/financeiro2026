import { httpClient } from '@/shared/api/httpClient'
import type {
  PaginatedResponse,
  Transacao,
  TransacaoListFilters,
  TransacaoPayload,
  TransacaoSummary,
} from '@/shared/types/transacao'

const BASE = '/api/transacoes'

function buildListQuery(filters: TransacaoListFilters) {
  const search = new URLSearchParams({
    inicio: filters.inicio,
    fim: filters.fim,
    page: String(filters.page ?? 1),
    per_page: String(filters.per_page ?? 20),
    sort_field: filters.sort_field ?? 'data_transacao',
    sort_order: filters.sort_order ?? 'desc',
  })

  if (filters.tipo) search.set('tipo', filters.tipo)
  if (filters.status) search.set('status', filters.status)
  if (filters.categoria_id) search.set('categoria_id', String(filters.categoria_id))
  if (filters.forma_pagamento_id) search.set('forma_pagamento_id', String(filters.forma_pagamento_id))
  if (typeof filters.cartao_credito === 'boolean') {
    search.set('cartao_credito', String(filters.cartao_credito))
  }

  return search.toString()
}

export const transacoesService = {
  list(token: string, filters: TransacaoListFilters) {
    return httpClient.get<PaginatedResponse<Transacao>>(`${BASE}?${buildListQuery(filters)}`, token)
  },
  cartaoCredito(token: string, inicio: string, fim: string) {
    const search = new URLSearchParams({ inicio, fim })
    return httpClient.get<{ transacoes: Transacao[] }>(`${BASE}/cartao_credito?${search.toString()}`, token)
  },
  summary(token: string, inicio: string, fim: string) {
    return httpClient.get<TransacaoSummary>(`${BASE}/summary?inicio=${inicio}&fim=${fim}`, token)
  },
  create(token: string, payload: TransacaoPayload) {
    return httpClient.post<Transacao | Transacao[]>(BASE, payload, token)
  },
  update(token: string, id: number, payload: Partial<TransacaoPayload>) {
    return httpClient.put<Transacao>(`${BASE}/${id}`, payload, token)
  },
  remove(token: string, id: number) {
    return httpClient.del<{ message: string }>(`${BASE}/${id}`, token)
  },
}
