import { httpClient } from '@/shared/api/httpClient'
import type { EvolucaoDiariaResponse, MatrizAnual, MatrizAnualParams } from '@/shared/types/relatorio'

const BASE = '/api/relatorios'

export const dashboardService = {
  matrizAnual(token: string, params: MatrizAnualParams) {
    const query = new URLSearchParams()
    query.set('ano', String(params.ano))
    if (params.agrupar) query.set('agrupar', params.agrupar)
    if (params.base) query.set('base', params.base)
    if (params.cartoes) query.set('cartoes', params.cartoes)
    if (params.status) query.set('status', params.status)
    if (params.comparar) query.set('comparar', 'true')

    return httpClient.get<MatrizAnual>(`${BASE}/matriz_anual?${query.toString()}`, token)
  },

  evolucaoDiaria(token: string, params: { ano: number; mes: number; base?: string }) {
    const query = new URLSearchParams()
    query.set('ano', String(params.ano))
    query.set('mes', String(params.mes))
    if (params.base) query.set('base', params.base)

    return httpClient.get<EvolucaoDiariaResponse>(`${BASE}/evolucao_diaria?${query.toString()}`, token)
  },
}
