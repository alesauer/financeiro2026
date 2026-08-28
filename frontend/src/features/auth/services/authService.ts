import { httpClient } from '@/shared/api/httpClient'
import type { AuthLoginPayload, AuthLoginResponse, AuthUser } from '@/shared/types/auth'

const AUTH_ENDPOINT = '/api/usuarios'

export const authService = {
  login(payload: AuthLoginPayload) {
    return httpClient.post<AuthLoginResponse>(`${AUTH_ENDPOINT}/login`, payload)
  },
  me(token: string) {
    return httpClient.get<AuthUser>(`${AUTH_ENDPOINT}/me`, token)
  },
}
