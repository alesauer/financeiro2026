import { httpClient } from '@/shared/api/httpClient'
import type {
  Categoria,
  CategoriaPayload,
  CategoriaTipo,
  AssociacoesResponse,
  CategoriaAliasItem,
  SalvarAliasPayload,
  AtualizarAliasPayload,
  TestarAssociacaoResultado,
} from '@/shared/types/categoria'

const BASE = '/api/categorias'

export const categoriasService = {
  list(token: string, tipo?: CategoriaTipo | '') {
    const query = tipo ? `?tipo=${encodeURIComponent(tipo)}` : ''
    return httpClient.get<Categoria[]>(`${BASE}${query}`, token)
  },
  create(token: string, payload: CategoriaPayload) {
    return httpClient.post<Categoria>(BASE, payload, token)
  },
  update(token: string, id: number, payload: Partial<CategoriaPayload>) {
    return httpClient.put<Categoria>(`${BASE}/${id}`, payload, token)
  },
  remove(token: string, id: number) {
    return httpClient.del<{ message: string }>(`${BASE}/${id}`, token)
  },
  getAssociacoes(token: string) {
    return httpClient.get<AssociacoesResponse>(`${BASE}/associacoes`, token)
  },
  salvarAlias(token: string, payload: SalvarAliasPayload) {
    return httpClient.post<CategoriaAliasItem>(`${BASE}/aliases`, payload, token)
  },
  atualizarAlias(token: string, id: number, payload: AtualizarAliasPayload) {
    return httpClient.put<CategoriaAliasItem>(`${BASE}/aliases/${id}`, payload, token)
  },
  removerAlias(token: string, id: number) {
    return httpClient.del<{ message: string }>(`${BASE}/aliases/${id}`, token)
  },
  testarAssociacao(token: string, descricao: string) {
    return httpClient.post<TestarAssociacaoResultado>(`${BASE}/associacoes/testar`, { descricao }, token)
  },
}

