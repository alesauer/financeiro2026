import { httpClient } from '@/shared/api/httpClient'
import type {
  AlertasConfig,
  EmailsAlertaResponse,
  LimparDadosPayload,
  LimparDadosResponse,
  SobreSistemaConfig,
} from '@/shared/types/configuracao'

const BASE = '/api/config'

export const configuracoesService = {
  getAlertas(token: string) {
    return httpClient.get<AlertasConfig>(`${BASE}/alertas-config`, token)
  },
  saveAlertas(token: string, payload: AlertasConfig) {
    return httpClient.put<AlertasConfig>(`${BASE}/alertas-config`, payload, token)
  },

  getEmailsAlerta(token: string) {
    return httpClient.get<EmailsAlertaResponse>(`${BASE}/emails-alerta`, token)
  },
  addEmailAlerta(token: string, email: string) {
    return httpClient.post<EmailsAlertaResponse>(`${BASE}/emails-alerta`, { email }, token)
  },
  removeEmailAlerta(token: string, email: string) {
    return httpClient.del<EmailsAlertaResponse>(`${BASE}/emails-alerta`, token, undefined, { email })
  },

  getSobreSistema(token: string) {
    return httpClient.get<SobreSistemaConfig>(`${BASE}/sobre-sistema`, token)
  },
  saveSobreSistema(token: string, payload: { descricao: string; versao: string }) {
    return httpClient.put<SobreSistemaConfig>(`${BASE}/sobre-sistema`, payload, token)
  },

  limparDados(token: string, payload: LimparDadosPayload) {
    return httpClient.post<LimparDadosResponse>(`${BASE}/limpar-dados`, payload, token)
  },

  exportarBackupJson(token: string) {
    return httpClient.get<Record<string, unknown>>(`${BASE}/backup/exportar-json`, token)
  },

  recalcularCompetencias(token: string, formaPagamentoId: number) {
    return httpClient.post<{ atualizados: number; total_considerado: number }>(
      '/api/transacoes/recalcular_competencia',
      { forma_pagamento_id: formaPagamentoId },
      token,
    )
  },
}
