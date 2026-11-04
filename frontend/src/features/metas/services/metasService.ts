import { httpClient } from '@/shared/api/httpClient'

export type StatusMetaDespesa = 'ok' | 'atencao' | 'estourado'
export type StatusMetaInvestimento = 'atingida' | 'em_andamento' | 'abaixo'

export interface MetaGlobalDespesa {
  id: number
  escopo: 'global_despesa'
  titulo: string
  valor_limite: number
  valor_padrao: number | null
  is_override: boolean
  valor_realizado: number
  saldo_disponivel: number
  percentual: number
  status: StatusMetaDespesa
  acima_do_ritmo: boolean
  media_3m: number
}

export interface MetaGlobalInvestimento {
  id: number
  escopo: 'global_investimento'
  titulo: string
  valor_limite: number
  valor_padrao: number | null
  is_override: boolean
  valor_realizado: number
  faltante: number
  percentual: number
  status: StatusMetaInvestimento
  media_3m: number
}

export interface MetaCategoriaItem {
  id: number
  escopo: 'categoria'
  categoria_id: number
  nome: string
  valor_limite: number
  valor_padrao: number | null
  is_override: boolean
  valor_realizado: number
  saldo_disponivel: number
  percentual: number
  status: StatusMetaDespesa
  acima_do_ritmo: boolean
  media_3m: number
}

export interface MetaCartaoItem {
  id: number
  escopo: 'cartao'
  forma_pagamento_id: number
  nome: string
  cor: string
  valor_limite: number
  valor_padrao: number | null
  is_override: boolean
  valor_realizado: number
  parcelado_comprometido: number
  gastos_avulsos: number
  margem_livre: number
  percentual: number
  percentual_parcelado: number
  percentual_avulso: number
  status: StatusMetaDespesa
  acima_do_ritmo: boolean
  media_3m: number
}

export interface CatalogoCategoriaMeta {
  categoria_id: number
  nome: string
  tipo: string
  meta_id: number | null
  valor_limite: number | null
  valor_padrao: number | null
  valor_override: number | null
  is_override: boolean
  valor_realizado: number
  media_3m: number
  sugestao_economia_10: number
}

export interface CatalogoCartaoMeta {
  forma_pagamento_id: number
  nome: string
  cor: string
  meta_id: number | null
  valor_limite: number | null
  valor_padrao: number | null
  valor_override: number | null
  is_override: boolean
  valor_realizado: number
  parcelado_comprometido: number
  gastos_avulsos: number
  media_3m: number
  sugestao_economia_10: number
}

export interface ResumoMetasResponse {
  periodo: {
    ano: number
    mes: number
    dia_referencia: number
    dias_no_mes: number
    percentual_mes_decorrido: number
  }
  realizado_geral: {
    receita_total: number
    despesa_global: number
    investimento_global: number
  }
  sumario_alertas: {
    total_metas_ativas: number
    estouradas: number
    atencao: number
    ok: number
  }
  meta_global_despesa: MetaGlobalDespesa | null
  meta_global_investimento: MetaGlobalInvestimento | null
  metas_cartoes: MetaCartaoItem[]
  metas_categorias: MetaCategoriaItem[]
  catalogo: {
    global_despesa: {
      meta_id: number | null
      valor_limite: number | null
      valor_padrao: number | null
      valor_override: number | null
      is_override: boolean
      valor_realizado: number
      media_3m: number
      sugestao_economia_10: number
    }
    global_investimento: {
      meta_id: number | null
      valor_limite: number | null
      valor_padrao: number | null
      valor_override: number | null
      is_override: boolean
      valor_realizado: number
      media_3m: number
      sugestao_aumento_10: number
    }
    cartoes: CatalogoCartaoMeta[]
    categorias: CatalogoCategoriaMeta[]
  }
}

export interface SalvarMetaItemPayload {
  escopo: 'global_despesa' | 'global_investimento' | 'categoria' | 'cartao'
  categoria_id?: number
  forma_pagamento_id?: number
  valor_limite: number | null
}

export interface SalvarMetasLotePayload {
  modo: 'padrao' | 'mes_especifico'
  mes?: number
  ano?: number
  itens: SalvarMetaItemPayload[]
}

const BASE = '/api/metas'

export const metasService = {
  resumo(token: string, mes: number, ano: number) {
    return httpClient.get<ResumoMetasResponse>(`${BASE}/resumo?mes=${mes}&ano=${ano}`, token)
  },
  salvarLote(token: string, payload: SalvarMetasLotePayload) {
    return httpClient.post<{ message: string; salvas: number; removidas: number }>(
      `${BASE}/salvar_lote`,
      payload,
      token,
    )
  },
  remover(token: string, id: number) {
    return httpClient.del<{ message: string }>(`${BASE}/${id}`, token)
  },
}
