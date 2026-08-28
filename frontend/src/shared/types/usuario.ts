export type Usuario = {
  id: number
  nome: string
  email: string
  data_criacao?: string
}

export type UsuarioPayload = {
  nome: string
  email: string
  senha?: string
}

export type ChangePasswordPayload = {
  senha_atual: string
  senha_nova: string
  senha_confirm: string
}
