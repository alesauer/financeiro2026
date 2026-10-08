export type AlertasConfig = {
  ligado: boolean
  email: boolean
  whatsapp: boolean
  limite: number
}

export type EmailsAlertaResponse = {
  emails: string[]
}

export type SobreSistemaConfig = {
  descricao: string
  versao: string
  usuario_logado?: string | null
  data_hora?: string | null
}

export type LimparDadosTipo =
  | 'transacoes'
  | 'milhas'
  | 'lembretes'
  | 'viagens'
  | 'documentos'
  | 'total'
  | 'seed_demo'

export type LimparDadosPayload = {
  tipo: LimparDadosTipo
  confirmacao: string
}

export type LimparDadosResponse = {
  mensagem: string
  detalhes?: Record<string, number>
}
