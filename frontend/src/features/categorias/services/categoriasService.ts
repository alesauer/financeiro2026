import { httpClient } from '@/shared/api/httpClient'
import type { Categoria, CategoriaPayload, CategoriaTipo } from '@/shared/types/categoria'

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
}
