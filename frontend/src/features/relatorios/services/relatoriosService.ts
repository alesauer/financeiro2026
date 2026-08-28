import { httpClient } from '@/shared/api/httpClient'
import type {
  RelatorioCartaoItem,
  RelatorioCategoriaItem,
  RelatorioFormaPagamentoItem,
  RelatorioParcelamentosFuturos,
  RelatorioResumoMensal,
  RelatorioStatusPeriodo,
  RelatorioSumarioAnual,
  RelatorioTopDespesaItem,
  RelatorioTotaisItem,
} from '@/shared/types/relatorio'

const BASE = '/api/relatorios'

export const relatoriosService = {
  totais(inicio?: string, fim?: string) {
    const query = new URLSearchParams()
    if (inicio) query.set('inicio', inicio)
    if (fim) query.set('fim', fim)
    return httpClient.get<RelatorioTotaisItem[]>(`${BASE}/totais?${query.toString()}`)
  },
  categorias(inicio?: string, fim?: string, tipo?: string) {
    const query = new URLSearchParams()
    if (inicio) query.set('inicio', inicio)
    if (fim) query.set('fim', fim)
    if (tipo) query.set('tipo', tipo)
    return httpClient.get<RelatorioCategoriaItem[]>(`${BASE}/categorias?${query.toString()}`)
  },
  formasPagamento(inicio?: string, fim?: string) {
    const query = new URLSearchParams()
    if (inicio) query.set('inicio', inicio)
    if (fim) query.set('fim', fim)
    return httpClient.get<RelatorioFormaPagamentoItem[]>(`${BASE}/formas_pagamento_totais?${query.toString()}`)
  },
  despesasCartao(inicio?: string, fim?: string) {
    const query = new URLSearchParams()
    if (inicio) query.set('inicio', inicio)
    if (fim) query.set('fim', fim)
    return httpClient.get<RelatorioCartaoItem[]>(`${BASE}/despesas_por_cartao?${query.toString()}`)
  },
  resumoMensal(ano: number, mes: number) {
    return httpClient.get<RelatorioResumoMensal>(`${BASE}/resumo?ano=${ano}&mes=${mes}`)
  },
  sumarioAnual(ano: number) {
    return httpClient.get<RelatorioSumarioAnual>(`${BASE}/sumario_anual?ano=${ano}`)
  },
  topDespesas(inicio?: string, fim?: string, limite = 20) {
    const query = new URLSearchParams()
    if (inicio) query.set('inicio', inicio)
    if (fim) query.set('fim', fim)
    query.set('limite', String(limite))
    return httpClient.get<RelatorioTopDespesaItem[]>(`${BASE}/top_despesas?${query.toString()}`)
  },
  statusPeriodo(inicio?: string, fim?: string) {
    const query = new URLSearchParams()
    if (inicio) query.set('inicio', inicio)
    if (fim) query.set('fim', fim)
    return httpClient.get<RelatorioStatusPeriodo>(`${BASE}/status_periodo?${query.toString()}`)
  },
  parcelamentosFuturos() {
    return httpClient.get<RelatorioParcelamentosFuturos>(`${BASE}/parcelamentos_futuros`)
  },
}
