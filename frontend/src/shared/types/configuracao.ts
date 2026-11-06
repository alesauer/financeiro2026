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

export interface IAConfig {
  provedor_ativo: 'deepseek' | 'openai'
  deepseek_api_key: string
  deepseek_modelo: string
  openai_api_key: string
  openai_modelo: string
}

export interface IATestarPayload {
  provedor: 'deepseek' | 'openai'
  api_key?: string
  modelo?: string
}

export interface IATestarResponse {
  sucesso: boolean
  mensagem: string
  resposta?: string
  tempo_ms?: number
}
