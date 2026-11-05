import { httpClient } from '@/shared/api/httpClient'
import type { ClassificarCategoriaPayload, ClassificarCategoriaResponse } from '@/shared/types/ia'
import type {
  IaDashboardData,
  IaConversaItem,
  IaConversaDetalhe,
  IaMensagem,
  IaPrevisaoData,
  IaAlertaCompleto,
  IaHistoricoItem,
  IaConsumoData,
} from '../types'

export const iaService = {
  // Visão Geral
  getDashboard(token?: string) {
    return httpClient.get<IaDashboardData>('/api/ia/dashboard', token)
  },

  // Conversas & Assistente
  listConversas(token?: string) {
    return httpClient.get<{ conversas: IaConversaItem[] }>('/api/ia/conversas', token)
  },

  createConversa(titulo: string = 'Nova conversa', token?: string) {
    return httpClient.post<IaConversaItem>('/api/ia/conversas', { titulo }, token)
  },

  getConversa(id: number, token?: string) {
    return httpClient.get<IaConversaDetalhe>(`/api/ia/conversas/${id}`, token)
  },

  deleteConversa(id: number, token?: string) {
    return httpClient.del<{ mensagem: string }>(`/api/ia/conversas/${id}`, token)
  },

  sendMessage(conversaId: number, mensagem: string, token?: string) {
    return httpClient.post<IaMensagem>(`/api/ia/conversas/${conversaId}/mensagens`, { mensagem }, token)
  },

  // Previsão de Gastos
  getPrevisao(mes?: number, ano?: number, token?: string) {
    const params = new URLSearchParams()
    if (mes) params.set('mes', String(mes))
    if (ano) params.set('ano', String(ano))
    const query = params.toString() ? `?${params.toString()}` : ''
    return httpClient.get<IaPrevisaoData>(`/api/ia/previsao${query}`, token)
  },

  // Anomalias & Alertas
  listAnomalias(status?: string, gravidade?: string, token?: string) {
    const params = new URLSearchParams()
    if (status) params.set('status', status)
    if (gravidade) params.set('gravidade', gravidade)
    const query = params.toString() ? `?${params.toString()}` : ''
    return httpClient.get<{ alertas: IaAlertaCompleto[] }>(`/api/ia/anomalias${query}`, token)
  },

  analisarAnomalias(token?: string) {
    return httpClient.post<{ status: string; novos_alertas_criados: number }>('/api/ia/anomalias/analisar', {}, token)
  },

  updateAnomaliaStatus(id: number, status: 'pendente' | 'lido' | 'resolvido' | 'ignorado', token?: string) {
    return httpClient.patch<{ mensagem: string; status: string }>(`/api/ia/anomalias/${id}`, { status }, token)
  },

  // Histórico & Consumo
  listHistorico(tipo?: string, token?: string) {
    const query = tipo ? `?tipo=${tipo}` : ''
    return httpClient.get<{ historico: IaHistoricoItem[] }>(`/api/ia/historico${query}`, token)
  },

  getConsumo(token?: string) {
    return httpClient.get<IaConsumoData>('/api/ia/consumo', token)
  },

  // Classificação Legada
  classificarCategorias(payload: ClassificarCategoriaPayload, token?: string) {
    return httpClient.post<ClassificarCategoriaResponse>('/api/ia/classificar_categoria', payload, token)
  },
}
