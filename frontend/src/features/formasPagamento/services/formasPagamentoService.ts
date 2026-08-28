import { httpClient } from '@/shared/api/httpClient'
import type { FormaPagamento, FormaPagamentoPayload } from '@/shared/types/formaPagamento'

const BASE = '/api/formas_pagamento'

export const formasPagamentoService = {
  list(token: string, params?: { ativo?: boolean; cartao_credito?: boolean; tipo?: string }) {
    const search = new URLSearchParams()
    if (params?.tipo) search.set('tipo', params.tipo)
    if (typeof params?.ativo === 'boolean') search.set('ativo', String(params.ativo))
    if (typeof params?.cartao_credito === 'boolean') search.set('cartao_credito', String(params.cartao_credito))
    const query = search.toString() ? `?${search.toString()}` : ''
    return httpClient.get<FormaPagamento[]>(`${BASE}${query}`, token)
  },
  create(token: string, payload: FormaPagamentoPayload) {
    return httpClient.post<FormaPagamento>(BASE, payload, token)
  },
  update(token: string, id: number, payload: Partial<FormaPagamentoPayload>) {
    return httpClient.put<FormaPagamento>(`${BASE}/${id}`, payload, token)
  },
  remove(token: string, id: number) {
    return httpClient.del<{ message: string }>(`${BASE}/${id}`, token)
  },
}
