import { httpClient } from '@/shared/api/httpClient'
import type {
  CartaoCreditoResponse,
  CopiarMesItemInput,
  CopiarMesPreviewResponse,
  CopiarMesResponse,
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
    per_page: String(filters.per_page ?? 50),
    sort_field: filters.sort_field ?? 'data_transacao',
    sort_order: filters.sort_order ?? 'desc',
  })

  if (filters.tipo) search.set('tipo', filters.tipo)
  if (filters.status) search.set('status', filters.status)
  if (filters.categoria_id) search.set('categoria_id', String(filters.categoria_id))
  if (filters.forma_pagamento_id) search.set('forma_pagamento_id', String(filters.forma_pagamento_id))
  if (filters.origem) search.set('origem', filters.origem)
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
    return httpClient.get<CartaoCreditoResponse>(`${BASE}/cartao_credito?${search.toString()}`, token)
  },
  quitarFatura(token: string, formaPagamentoId: number, competencia: string, status: 'Pago' | 'Pendente' = 'Pago') {
    return httpClient.post<{ message: string; quantidade: number; status: string }>(
      `${BASE}/quitar_fatura`,
      { forma_pagamento_id: formaPagamentoId, competencia, status },
      token
    )
  },
  summary(token: string, inicio: string, fim: string) {
    return httpClient.get<TransacaoSummary>(`${BASE}/summary?inicio=${inicio}&fim=${fim}`, token)
  },
  create(token: string, payload: TransacaoPayload) {
    return httpClient.post<Transacao | Transacao[]>(BASE, payload, token)
  },
  update(
    token: string,
    id: number,
    payload: Partial<TransacaoPayload> & { alterar_meses_anteriores?: boolean },
  ) {
    return httpClient.put<Transacao & { anteriores_atualizadas?: number }>(`${BASE}/${id}`, payload, token)
  },
  verificarAnterioresEstabelecimento(token: string, id: number, novaCategoriaId?: number) {
    const search = new URLSearchParams()
    if (novaCategoriaId) search.set('nova_categoria_id', String(novaCategoriaId))
    const qs = search.toString() ? `?${search.toString()}` : ''
    return httpClient.get<{
      quantidade: number
      estabelecimento: string
      itens: Array<{
        id: number
        descricao: string
        data_transacao: string | null
        valor: number
        categoria_atual: string
      }>
    }>(`${BASE}/${id}/anteriores_estabelecimento${qs}`, token)
  },
  remove(token: string, id: number) {
    return httpClient.del<{ message: string }>(`${BASE}/${id}`, token)
  },
  removeLote(token: string, ids: number[]) {
    return httpClient.del<{ message: string; quantidade: number }>(`${BASE}/lote`, token, undefined, { ids })
  },
  previewCopiarMes(token: string, mesOrigem: string, mesDestino?: string) {
    const search = new URLSearchParams({ mes_origem: mesOrigem })
    if (mesDestino) search.set('mes_destino', mesDestino)
    return httpClient.get<CopiarMesPreviewResponse>(`${BASE}/copiar_mes/preview?${search.toString()}`, token)
  },
  executarCopiarMes(token: string, mesDestino: string, itens: CopiarMesItemInput[]) {
    return httpClient.post<CopiarMesResponse>(
      `${BASE}/copiar_mes`,
      { mes_destino: mesDestino, itens },
      token
    )
  },
}
