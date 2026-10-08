export type ProgramaMeta = {
  nome: string
  tipo: 'aereo' | 'bancario' | 'hotel' | 'outro'
  cpmPadrao: number
  corPrimaria: string
  corSecundaria: string
  bgLight: string
  textColor: string
  sigla: string
  descricao: string
}

export const PROGRAMAS_POPULARES: Record<string, ProgramaMeta> = {
  'Smiles': {
    nome: 'Smiles',
    tipo: 'aereo',
    cpmPadrao: 16.50,
    corPrimaria: '#FF7020',
    corSecundaria: '#E0550B',
    bgLight: 'rgba(255, 112, 32, 0.12)',
    textColor: '#EA580C',
    sigla: 'GOL',
    descricao: 'Programa de fidelidade da GOL Linhas Aéreas',
  },
  'LATAM Pass': {
    nome: 'LATAM Pass',
    tipo: 'aereo',
    cpmPadrao: 25.00,
    corPrimaria: '#E8112D',
    corSecundaria: '#1B0088',
    bgLight: 'rgba(232, 17, 45, 0.12)',
    textColor: '#DC2626',
    sigla: 'LA',
    descricao: 'Programa de fidelidade do Grupo LATAM',
  },
  'Azul Fidelidade': {
    nome: 'Azul Fidelidade',
    tipo: 'aereo',
    cpmPadrao: 16.00,
    corPrimaria: '#0080FF',
    corSecundaria: '#0052A3',
    bgLight: 'rgba(0, 128, 255, 0.12)',
    textColor: '#0284C7',
    sigla: 'AD',
    descricao: 'Programa de fidelidade da Azul Linhas Aéreas',
  },
  'Livelo': {
    nome: 'Livelo',
    tipo: 'bancario',
    cpmPadrao: 33.00,
    corPrimaria: '#E6007E',
    corSecundaria: '#AD005E',
    bgLight: 'rgba(230, 0, 126, 0.12)',
    textColor: '#DB2777',
    sigla: 'LIV',
    descricao: 'Programa de pontos Banco do Brasil e Bradesco',
  },
  'Esfera': {
    nome: 'Esfera',
    tipo: 'bancario',
    cpmPadrao: 34.00,
    corPrimaria: '#EC0000',
    corSecundaria: '#B80000',
    bgLight: 'rgba(236, 0, 0, 0.12)',
    textColor: '#E11D48',
    sigla: 'ESF',
    descricao: 'Programa de pontos do Santander',
  },
  'C6 Átomos': {
    nome: 'C6 Átomos',
    tipo: 'bancario',
    cpmPadrao: 32.00,
    corPrimaria: '#242424',
    corSecundaria: '#FFD700',
    bgLight: 'rgba(36, 36, 36, 0.12)',
    textColor: '#334155',
    sigla: 'C6',
    descricao: 'Programa de pontos do C6 Bank (não expiram)',
  },
  'TAP Miles&Go': {
    nome: 'TAP Miles&Go',
    tipo: 'aereo',
    cpmPadrao: 20.00,
    corPrimaria: '#22C55E',
    corSecundaria: '#15803D',
    bgLight: 'rgba(34, 197, 94, 0.12)',
    textColor: '#16A34A',
    sigla: 'TAP',
    descricao: 'Programa da TAP Air Portugal (Star Alliance)',
  },
  'Coopera': {
    nome: 'Coopera',
    tipo: 'bancario',
    cpmPadrao: 28.00,
    corPrimaria: '#00A868',
    corSecundaria: '#007A4B',
    bgLight: 'rgba(0, 168, 104, 0.12)',
    textColor: '#059669',
    sigla: 'SICOOB',
    descricao: 'Programa de fidelidade Sicoob',
  },
  'AAdvantage': {
    nome: 'AAdvantage',
    tipo: 'aereo',
    cpmPadrao: 75.00,
    corPrimaria: '#0078D7',
    corSecundaria: '#004C87',
    bgLight: 'rgba(0, 120, 215, 0.12)',
    textColor: '#0284C7',
    sigla: 'AA',
    descricao: 'American Airlines (Oneworld)',
  },
  'Iberia Plus': {
    nome: 'Iberia Plus',
    tipo: 'aereo',
    cpmPadrao: 65.00,
    corPrimaria: '#D90429',
    corSecundaria: '#EF233C',
    bgLight: 'rgba(217, 4, 41, 0.12)',
    textColor: '#DC2626',
    sigla: 'IB',
    descricao: 'Programa da Iberia (Avios / Oneworld)',
  },
  'Flying Blue': {
    nome: 'Flying Blue',
    tipo: 'aereo',
    cpmPadrao: 60.00,
    corPrimaria: '#0B2545',
    corSecundaria: '#134074',
    bgLight: 'rgba(11, 37, 69, 0.12)',
    textColor: '#1E40AF',
    sigla: 'AF/KLM',
    descricao: 'Air France e KLM (SkyTeam)',
  },
  'ALL Accor': {
    nome: 'ALL Accor',
    tipo: 'hotel',
    cpmPadrao: 110.00,
    corPrimaria: '#C29B38',
    corSecundaria: '#8E7020',
    bgLight: 'rgba(194, 155, 56, 0.12)',
    textColor: '#B45309',
    sigla: 'ALL',
    descricao: 'Rede hoteleira Accor (Novotel, Ibis, Mercure)',
  },
}

export function obterMetaPrograma(nome: string): ProgramaMeta {
  const chave = Object.keys(PROGRAMAS_POPULARES).find(
    (k) => k.toLowerCase() === nome.toLowerCase().trim()
  )
  if (chave) return PROGRAMAS_POPULARES[chave]

  // Fallback para programas customizados
  return {
    nome,
    tipo: 'outro',
    cpmPadrao: 20.00,
    corPrimaria: '#64748B',
    corSecundaria: '#475569',
    bgLight: 'rgba(100, 116, 139, 0.12)',
    textColor: '#475569',
    sigla: nome.slice(0, 3).toUpperCase(),
    descricao: 'Programa de pontos / milhas',
  }
}

export const CATEGORIAS_ORIGEM = [
  'Cartão de Crédito',
  'Clube de Fidelidade',
  'Compra de Pontos',
  'Voo / Passagem',
  'Transferência',
  'Transferência Bonificada',
  'Shopping / Parceiros',
  'Bônus Promocional',
  'Resgate Passagem',
  'Resgate Produtos',
  'Venda de Milhas',
  'Expirada',
  'Outros',
] as const
