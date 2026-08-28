import { httpClient } from '@/shared/api/httpClient'
import type { ChangePasswordPayload, Usuario, UsuarioPayload } from '@/shared/types/usuario'

const BASE = '/api/usuarios'

export const usuariosService = {
  list(token: string) {
    return httpClient.get<Usuario[]>(`${BASE}/`, token)
  },
  create(token: string, payload: UsuarioPayload) {
    return httpClient.post<Usuario>(`${BASE}/`, payload, token)
  },
  update(token: string, id: number, payload: UsuarioPayload) {
    return httpClient.put<Usuario>(`${BASE}/${id}`, payload, token)
  },
  remove(token: string, id: number) {
    return httpClient.del<{ msg: string }>(`${BASE}/${id}`, token)
  },
  changePassword(token: string, payload: ChangePasswordPayload) {
    return httpClient.post<{ msg: string }>(`${BASE}/change-password`, payload, token)
  },
}
