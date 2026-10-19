export type RelatorioTotaisItem = {
  tipo: string
  total: number
}

export type RelatorioCategoriaItem = {
  categoria: string
  total: number
}

export type RelatorioFormaPagamentoItem = {
  forma_pagamento: string
  total: number
}

export type RelatorioCartaoItem = {
  cartao: string
  qtd: number
  total: number
}

export type RelatorioResumoMensal = {
  dias: string[]
  saldo: number[]
  acum_invest: number[]
}

export type DiaEvolucaoItem = {
  dia: number
  label: string
  data: string
  Receita: number
  Despesa: number
  Saldo: number
  Investimento: number
  SaldoAcumulado: number
  qtd_transacoes: number
}

export type EvolucaoDiariaResponse = {
  ano: number
  mes: number
  mes_nome: string
  base: string
  dias: DiaEvolucaoItem[]
  total_receita: number
  total_despesa: number
  total_investimento: number
  total_saldo: number
}

export type RelatorioTopDespesaItem = {
  id: number
  descricao: string
  categoria: string
  forma_pagamento: string
  data: string | null
  status: string
  valor: number
}

export type RelatorioStatusResumoItem = {
  status: string
  tipo: string
  qtd: number
  total: number
}

export type RelatorioPendenteItem = {
  id: number
  descricao: string
  tipo: string
  categoria: string
  forma_pagamento: string
  data: string | null
  valor: number
}

export type RelatorioStatusPeriodo = {
  resumo: RelatorioStatusResumoItem[]
  pendentes: RelatorioPendenteItem[]
}

export type RelatorioParcelamentoGrupo = {
  descricao: string
  forma_pagamento: string
  total_parcelas: number | null
  parcelas_restantes: number
  parcela_atual?: number
  proxima_parcela?: number
  valor_parcela: number
  valor_restante: number
  proxima_data: string
  ultima_data: string
}

export type RelatorioParcelamentoItemMensal = {
  descricao: string
  forma_pagamento: string
  numero_parcela: number
  total_parcelas: number
  valor: number
  data_vencimento: string
}

export type RelatorioParcelamentoMensal = {
  mes: string
  qtd: number
  total: number
  itens?: RelatorioParcelamentoItemMensal[]
}

export type RelatorioParcelamentosFuturos = {
  grupos: RelatorioParcelamentoGrupo[]
  mensal: RelatorioParcelamentoMensal[]
  total_restante: number
  qtd_parcelas: number
  qtd_grupos: number
}

export type RelatorioSumarioAnual = {
  meses: string[]
  receita: number[]
  despesa: number[]
  investimento: number[]
  sobrou: number[]
  total_receita: number
  total_despesa: number
  total_investimento: number
  total_sobrou: number
}

export type MatrizAgrupamento = 'categoria' | 'descricao'

export type MatrizBase = 'data' | 'competencia'

export type MatrizTipo = 'Receita' | 'Despesa' | 'Investimento'

export type MatrizSecaoChave = MatrizTipo | 'Cartoes'

export type MatrizCartoesModo = 'separado' | 'categoria'

export type MatrizLinha = {
  chave: string
  categoria_id: number | null
  valores: number[]
  total: number
}

export type MatrizSumario = {
  receita: number[]
  despesa: number[]
  investimento: number[]
  saldo: number[]
  totais: {
    receita: number
    despesa: number
    investimento: number
    saldo: number
  }
}

export type MatrizProjecaoItem = {
  realizado: number
  agendado: number
  media_mensal: number
  projetado: number
}

export type MatrizProjecao = {
  meses_realizados: number
  receita: MatrizProjecaoItem
  despesa: MatrizProjecaoItem
  investimento: MatrizProjecaoItem
  saldo: { projetado: number }
}

export type MatrizInsight = {
  tipo: 'positivo' | 'alerta' | 'info'
  titulo: string
  texto: string
}

export type MatrizComparativo = {
  ano: number
  sumario: MatrizSumario
  variacoes: {
    receita: number | null
    despesa: number | null
    investimento: number | null
    saldo: number | null
  }
}

export type MatrizAnual = {
  ano: number
  agrupar: MatrizAgrupamento
  base: MatrizBase
  cartoes: MatrizCartoesModo
  meses: string[]
  sumario: MatrizSumario
  secoes: Record<MatrizSecaoChave, MatrizLinha[]>
  projecao: MatrizProjecao | null
  insights: MatrizInsight[]
  comparativo?: MatrizComparativo
}

export type MatrizAnualParams = {
  ano: number
  agrupar?: MatrizAgrupamento
  base?: MatrizBase
  cartoes?: MatrizCartoesModo
  status?: 'Pago' | 'Pendente'
  comparar?: boolean
}
