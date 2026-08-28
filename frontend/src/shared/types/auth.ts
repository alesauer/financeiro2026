export type AuthLoginPayload = {
  email: string
  senha: string
}

export type AuthUser = {
  id: number
  nome: string
  email: string
  data_criacao?: string
}

export type AuthLoginResponse = {
  usuario: AuthUser
  access_token: string
}
