export type IaKpis = {
  gasto_acumulado: number
  projecao_final: number
  orcamento_total: number
  excedente_previsto: number
  alertas_pendentes: number
  total_analises: number
  total_conversas: number
  grau_confianca_previsao: number
}

export type IaRecomendacao = {
  tipo: 'alerta' | 'sucesso' | 'info'
  titulo: string
  texto: string
}

export type IaAlertaResumo = {
  id: number
  tipo_anomalia: string
  gravidade: 'info' | 'atencao' | 'critico'
  titulo: string
  descricao: string
  valor_envolvido: number | null
  created_at: string | null
}

export type IaDashboardData = {
  periodo: string
  kpis: IaKpis
  alertas_recentes: IaAlertaResumo[]
  recomendacoes: IaRecomendacao[]
  resumo_previsao: string
}

export type IaConversaItem = {
  id: number
  titulo: string
  created_at: string | null
  updated_at: string | null
  total_mensagens: number
}

export type IaMensagem = {
  id: number
  role: 'user' | 'assistant' | 'system'
  conteudo: string
  metadados?: any
  created_at: string | null
}

export type IaConversaDetalhe = {
  id: number
  titulo: string
  created_at: string | null
  mensagens: IaMensagem[]
}

export type IaCategoriaProjecao = {
  categoria_id: number
  categoria: string
  realizado_ate_agora: number
  projecao_fim_mes: number
  orcamento_limite: number
  status: string
}

export type IaProjecaoDiariaItem = {
  dia: number
  realizado_acumulado: number | null
  projetado_acumulado: number
}

export type IaPrevisaoData = {
  mes: number
  ano: number
  dias_transcorridos: number
  dias_restantes: number
  ultimo_dia_mes: number
  gasto_acumulado: number
  previsao_restante: number
  projecao_final: number
  orcamento_total: number
  excedente_previsto: number
  percentual_orcamento: number
  confiabilidade: string
  grau_confianca: number
  media_historica: number
  historico_meses: Array<{
    mes: number
    ano: number
    label: string
    total: number
  }>
  categorias_projecao: IaCategoriaProjecao[]
  projecao_diaria: IaProjecaoDiariaItem[]
  explicacao_ia: string
}

export type IaAlertaCompleto = {
  id: number
  tipo_anomalia: string
  gravidade: 'info' | 'atencao' | 'critico'
  titulo: string
  descricao: string
  valor_envolvido: number | null
  transacao_id: number | null
  categoria_id: number | null
  categoria_nome: string | null
  status: 'pendente' | 'lido' | 'resolvido' | 'ignorado'
  created_at: string | null
}

export type IaHistoricoItem = {
  id: number
  tipo_analise: string
  periodo_referencia: string | null
  titulo: string
  resultado: any
  recomendacoes: any
  origem: string
  created_at: string | null
}

export type IaConsumoData = {
  total_chamadas: number
  total_tokens_prompt: number
  total_tokens_completion: number
  total_tokens: number
  custo_estimado_usd: number
  logs_recentes: Array<{
    id: number
    funcionalidade: string
    modelo: string
    tokens: number
    custo_usd: number
    created_at: string | null
  }>
}

