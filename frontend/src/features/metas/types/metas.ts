export type SituacaoMeta = 'dentro' | 'atencao' | 'ultrapassada'
export type PeriodicidadeMeta = 'Mensal' | 'Anual' | 'Personalizado'

export interface PeriodoMetasInfo {
  ano: number
  mes: number
  mes_nome: string
  mes_curto: string
  dias_no_mes: number
  dias_transcorridos: number
  dias_restantes: number
  percentual_mes_decorrido: number
}

export interface ConfiguracaoMetas {
  limite_atencao: number
  limite_ultrapassada: number
  alerta_ritmo_ativo: boolean
  tolerancia_ritmo_pct: number
  percentuais_padrao: number[]
}

export interface MetaEnriquecida {
  id: number
  nome: string
  escopo: string
  categoria_id: number
  categoria_nome: string
  valor_planejado: number
  valor_limite: number
  valor_realizado: number
  valor_disponivel: number
  saldo_disponivel: number
  valor_excedido: number
  percentual_consumido: number
  percentual: number
  situacao: SituacaoMeta
  situacao_label: string
  status: 'ok' | 'atencao' | 'estourado'
  periodicidade: PeriodicidadeMeta | string
  data_inicio: string
  data_fim: string
  repetir_automaticamente: boolean
  alertas_percentuais: number[]
  dias_no_mes: number
  dias_transcorridos: number
  dias_restantes: number
  gasto_diario_medio: number
  projecao_mes: number
  ritmo_elevado: boolean
  acima_do_ritmo: boolean
  ritmo_status: 'dentro_do_esperado' | 'ritmo_elevado'
  ritmo_label: string
  diferenca_ritmo_pct: number
}

export interface EvolucaoMensalPonto {
  ano: number
  mes: number
  rotulo: string
  planejado: number
  realizado: number
}

export interface PainelMetasResponse {
  periodo: PeriodoMetasInfo
  configuracao: ConfiguracaoMetas
  indicadores: {
    orcamento_total: number
    gasto_total: number
    disponivel_total: number
    excedido_total: number
    percentual_execucao: number
    percentual_disponivel: number
    total_metas: number
    metas_dentro: number
    metas_atencao: number
    metas_ultrapassadas: number
    metas_em_atencao_total: number
  }
  evolucao_mensal: EvolucaoMensalPonto[]
  metas: MetaEnriquecida[]
  metas_filtradas: MetaEnriquecida[]
}

export interface CriarEditarMetaPayload {
  nome: string
  categoria_id: number
  valor_limite: number
  periodicidade: string
  data_inicio?: string | null
  data_fim?: string | null
  repetir_automaticamente: boolean
  alertas_percentuais: number[]
}

export interface EvolucaoDiariaMetaPonto {
  dia: number
  data: string
  rotulo: string
  gasto_dia: number
  gasto_acumulado: number | null
  meta: number
}

export interface LancamentoMetaItem {
  id: number
  descricao: string
  valor: number
  data_transacao: string
  data_referencia: string
  forma_pagamento_id: number
  forma_pagamento_nome: string
  cartao_credito: boolean
  parcelado: boolean
  parcela_atual: number | null
  total_parcelas: number | null
  status: string
}

export interface DetalheMetaResponse {
  periodo: PeriodoMetasInfo
  meta: MetaEnriquecida
  evolucao_diaria: EvolucaoDiariaMetaPonto[]
  lancamentos: LancamentoMetaItem[]
}

export interface PlanejadoVsRealizadoItem {
  meta_id: number
  categoria_id: number
  nome: string
  nome_curto: string
  planejado: number
  realizado: number
  variacao: number
  percentual: number
  situacao: SituacaoMeta
}

export interface Tendencia12mPonto {
  rotulo: string
  planejado: number
  realizado: number
  media_movel_3m: number
  execucao_pct: number
}

export interface ComparativoMensalItem {
  meta_id: number
  categoria_id: number
  nome: string
  nome_curto: string
  planejado: number
  mes_anterior: number
  mes_atual: number
  media_6m: number
  variacao_mensal_pct: number
}

export interface AnalisesMetasResponse {
  periodo: PeriodoMetasInfo
  resumo_periodo: {
    total_planejado: number
    total_realizado: number
    variacao: number
    execucao_orcamento_pct: number
  }
  planejado_vs_realizado: PlanejadoVsRealizadoItem[]
  evolucao_por_categoria: {
    categorias: string[]
    series: Record<string, string | number>[]
  }
  tendencia_12m: Tendencia12mPonto[]
  comparativo_mensal: ComparativoMensalItem[]
}

export interface AlertaMetaItem {
  chave: string
  meta_id: number
  meta_nome: string
  categoria_nome: string
  tipo: 'meta_ultrapassada' | 'meta_atencao' | 'ritmo_elevado' | 'meta_concluida'
  severidade: 'critica' | 'aviso' | 'info' | 'sucesso'
  titulo: string
  mensagem: string
  data_hora: string
  acao_tipo: 'ver_meta' | 'ver_analise'
  acao_label: string
  lido: boolean
}

export interface AlertasMetasResponse {
  periodo: PeriodoMetasInfo
  ativos: AlertaMetaItem[]
  historico: AlertaMetaItem[]
  configuracoes: ConfiguracaoMetas
}

