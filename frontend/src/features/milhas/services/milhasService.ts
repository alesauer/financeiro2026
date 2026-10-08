import { httpClient } from '@/shared/api/httpClient'
import type {
  Milha,
  MilhaPayload,
  MilhasFiltros,
  MilhasResumoResponse,
  TransferenciaPayload,
} from '@/shared/types/milha'
import type { PaginatedResponse } from '@/shared/types/lembrete'

const BASE = '/api/milhas'

export const milhasService = {
  list(token: string, filtros: MilhasFiltros = {}) {
    const params = new URLSearchParams()
    if (filtros.page) params.set('page', String(filtros.page))
    if (filtros.per_page) params.set('per_page', String(filtros.per_page))
    if (filtros.programa) params.set('programa', filtros.programa)
    if (filtros.tipo) params.set('tipo', filtros.tipo)
    if (filtros.categoria_origem) params.set('categoria_origem', filtros.categoria_origem)
    if (filtros.inicio) params.set('inicio', filtros.inicio)
    if (filtros.fim) params.set('fim', filtros.fim)
    if (filtros.search) params.set('search', filtros.search)
    if (filtros.sort_by) params.set('sort_by', filtros.sort_by)
    if (filtros.sort_dir) params.set('sort_dir', filtros.sort_dir)

    return httpClient.get<PaginatedResponse<Milha>>(`${BASE}/?${params.toString()}`, token)
  },
  resumo(token: string) {
    return httpClient.get<MilhasResumoResponse>(`${BASE}/resumo`, token)
  },
  get(token: string, id: number) {
    return httpClient.get<Milha>(`${BASE}/${id}`, token)
  },
  create(token: string, payload: MilhaPayload) {
    return httpClient.post<Milha>(`${BASE}/`, payload, token)
  },
  transferencia(token: string, payload: TransferenciaPayload) {
    return httpClient.post<{ message: string; transferencia_id: string; saida: Milha; entrada: Milha }>(
      `${BASE}/transferencia`,
      payload,
      token,
    )
  },
  update(token: string, id: number, payload: Partial<MilhaPayload>) {
    return httpClient.put<Milha>(`${BASE}/${id}`, payload, token)
  },
  remove(token: string, id: number, excluirPar = false) {
    return httpClient.del<{ message: string }>(`${BASE}/${id}?excluir_par=${excluirPar}`, token)
  },
  batchDelete(token: string, ids: number[]) {
    return httpClient.post<{ message: string }>(`${BASE}/lote_delete`, { ids }, token)
  },
}
