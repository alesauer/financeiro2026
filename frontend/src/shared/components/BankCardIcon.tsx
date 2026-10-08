import {
  CreditCard,
  Banknote,
  Barcode,
  ArrowLeftRight,
  Wallet,
} from 'lucide-react'

export interface PresetIconDef {
  id: string
  nome: string
  categoria: 'Bancos Digitais' | 'Grandes Bancos' | 'Bandeiras' | 'Geral'
  corPadrao: string
  descricao: string
}

export const PRESET_ICONS: PresetIconDef[] = [
  // Bancos Digitais
  {
    id: 'preset:nubank',
    nome: 'Nubank',
    categoria: 'Bancos Digitais',
    corPadrao: '#820AD1',
    descricao: 'Cartão de crédito ou conta Nubank (Roxinho)',
  },
  {
    id: 'preset:c6',
    nome: 'C6 Bank',
    categoria: 'Bancos Digitais',
    corPadrao: '#242424',
    descricao: 'Cartão C6 Bank Carbon ou Standard',
  },
  {
    id: 'preset:inter',
    nome: 'Banco Inter',
    categoria: 'Bancos Digitais',
    corPadrao: '#FF7A00',
    descricao: 'Banco Inter Gold, Platinum ou Black',
  },
  {
    id: 'preset:xp',
    nome: 'XP Investimentos',
    categoria: 'Bancos Digitais',
    corPadrao: '#111111',
    descricao: 'Cartão XP Visa Infinite',
  },
  {
    id: 'preset:btg',
    nome: 'BTG Pactual',
    categoria: 'Bancos Digitais',
    corPadrao: '#0B1D3A',
    descricao: 'Cartão BTG Black ou Platinum',
  },

  // Grandes Bancos Tradicionais
  {
    id: 'preset:itau',
    nome: 'Itaú',
    categoria: 'Grandes Bancos',
    corPadrao: '#EC7000',
    descricao: 'Itaú Unibanco, Personnalité ou Uniclass',
  },
  {
    id: 'preset:bradesco',
    nome: 'Bradesco',
    categoria: 'Grandes Bancos',
    corPadrao: '#CC092F',
    descricao: 'Bradesco, Prime ou Exclusive',
  },
  {
    id: 'preset:santander',
    nome: 'Santander',
    categoria: 'Grandes Bancos',
    corPadrao: '#EA1D25',
    descricao: 'Santander SX, Elite ou Unlimited',
  },
  {
    id: 'preset:bb',
    nome: 'Banco do Brasil',
    categoria: 'Grandes Bancos',
    corPadrao: '#003882',
    descricao: 'Banco do Brasil / Ourocard',
  },
  {
    id: 'preset:caixa',
    nome: 'Caixa Econômica',
    categoria: 'Grandes Bancos',
    corPadrao: '#0066B3',
    descricao: 'Caixa Econômica Federal',
  },

  // Bandeiras
  {
    id: 'preset:mastercard',
    nome: 'Mastercard',
    categoria: 'Bandeiras',
    corPadrao: '#222222',
    descricao: 'Bandeira Mastercard',
  },
  {
    id: 'preset:visa',
    nome: 'Visa',
    categoria: 'Bandeiras',
    corPadrao: '#1A1F71',
    descricao: 'Bandeira Visa',
  },
  {
    id: 'preset:elo',
    nome: 'Elo',
    categoria: 'Bandeiras',
    corPadrao: '#1C1C1C',
    descricao: 'Bandeira Elo',
  },
  {
    id: 'preset:amex',
    nome: 'American Express',
    categoria: 'Bandeiras',
    corPadrao: '#006FCF',
    descricao: 'Bandeira American Express',
  },

  // Formas Gerais
  {
    id: 'preset:pix',
    nome: 'Pix',
    categoria: 'Geral',
    corPadrao: '#32BCAD',
    descricao: 'Pagamento instantâneo Pix',
  },
  {
    id: 'preset:dinheiro',
    nome: 'Dinheiro',
    categoria: 'Geral',
    corPadrao: '#10B981',
    descricao: 'Dinheiro em espécie',
  },
  {
    id: 'preset:boleto',
    nome: 'Boleto Bancário',
    categoria: 'Geral',
    corPadrao: '#F59E0B',
    descricao: 'Boleto bancário',
  },
  {
    id: 'preset:transferencia',
    nome: 'Transferência / TED',
    categoria: 'Geral',
    corPadrao: '#6366F1',
    descricao: 'Transferência bancária / DOC / TED',
  },
  {
    id: 'preset:generic_card',
    nome: 'Cartão de Crédito',
    categoria: 'Geral',
    corPadrao: '#3B82F6',
    descricao: 'Cartão genérico',
  },
  {
    id: 'preset:outros',
    nome: 'Outros / Carteira',
    categoria: 'Geral',
    corPadrao: '#64748B',
    descricao: 'Outros métodos de pagamento',
  },
]

interface BankCardIconProps {
  icone?: string | null
  cor?: string | null
  nome?: string | null
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

export function BankCardIcon({
  icone,
  cor,
  nome,
  size = 'md',
  className = '',
}: BankCardIconProps) {
  // Se não foi passado `icone`, tenta adivinhar pelo nome do cartão
  let finalIcone = icone
  let finalCor = cor

  if (!finalIcone && nome) {
    const n = nome.toLowerCase()
    if (n.includes('nubank')) {
      finalIcone = 'preset:nubank'
      finalCor = finalCor || '#820AD1'
    } else if (n.includes('c6')) {
      finalIcone = 'preset:c6'
      finalCor = finalCor || '#242424'
    } else if (n.includes('inter')) {
      finalIcone = 'preset:inter'
      finalCor = finalCor || '#FF7A00'
    } else if (n.includes('itau') || n.includes('itaú')) {
      finalIcone = 'preset:itau'
      finalCor = finalCor || '#EC7000'
    } else if (n.includes('bradesco')) {
      finalIcone = 'preset:bradesco'
      finalCor = finalCor || '#CC092F'
    } else if (n.includes('santander')) {
      finalIcone = 'preset:santander'
      finalCor = finalCor || '#EA1D25'
    } else if (n.includes('brasil') || n.includes('bb')) {
      finalIcone = 'preset:bb'
      finalCor = finalCor || '#003882'
    } else if (n.includes('caixa')) {
      finalIcone = 'preset:caixa'
      finalCor = finalCor || '#0066B3'
    } else if (n.includes('xp')) {
      finalIcone = 'preset:xp'
      finalCor = finalCor || '#111111'
    } else if (n.includes('btg')) {
      finalIcone = 'preset:btg'
      finalCor = finalCor || '#0B1D3A'
    } else if (n.includes('pix')) {
      finalIcone = 'preset:pix'
      finalCor = finalCor || '#32BCAD'
    } else if (n.includes('dinheiro')) {
      finalIcone = 'preset:dinheiro'
      finalCor = finalCor || '#10B981'
    } else {
      finalIcone = 'preset:generic_card'
    }
  }

  const sizeClasses = {
    sm: 'h-6 w-6 rounded text-xs',
    md: 'h-8 w-8 rounded-md text-sm',
    lg: 'h-10 w-10 rounded-lg text-base',
    xl: 'h-12 w-12 rounded-xl text-lg',
  }[size]

  const iconSizes = {
    sm: 'h-3.5 w-3.5',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
    xl: 'h-6 w-6',
  }[size]

  // Se for imagem personalizada enviada pelo usuário (Base64 data URL ou URL remota)
  if (finalIcone && (finalIcone.startsWith('data:image/') || finalIcone.startsWith('http') || finalIcone.startsWith('/'))) {
    return (
      <div
        className={`relative flex items-center justify-center overflow-hidden border border-slate-200/80 bg-white shadow-xs shrink-0 ${sizeClasses} ${className}`}
        style={finalCor ? { borderColor: finalCor } : undefined}
      >
        <img
          src={finalIcone}
          alt={nome || 'Ícone'}
          className="h-full w-full object-contain p-0.5"
        />
      </div>
    )
  }

  // Se for Preset SVG de Bancos e Formas
  const bgStyle = finalCor ? { backgroundColor: finalCor } : { backgroundColor: '#1e293b' }

  const renderSvgContent = () => {
    switch (finalIcone) {
      case 'preset:nubank':
        return (
          <svg viewBox="0 0 48 48" className={`${iconSizes} text-white fill-current`} aria-label="Nubank">
            <path d="M11 12h5.5v13.5c0 3.2 1.8 5.5 4.8 5.5s4.7-2.3 4.7-5.5V12h5.5v14.2c0 6.2-3.8 10.8-10.2 10.8s-10.3-4.6-10.3-10.8V12z" />
            <path d="M31.5 20.5h5.5v16.5h-5.5z" />
          </svg>
        )

      case 'preset:c6':
        return (
          <svg viewBox="0 0 48 48" className={`${iconSizes} text-white fill-current`} aria-label="C6 Bank">
            <path d="M22 14c-6.6 0-12 5.4-12 12s5.4 12 12 12c4.8 0 8.9-2.8 10.8-6.9h-5.6C24.1 32.3 22.2 33 20 33c-4.4 0-8-3.6-8-8s3.6-8 8-8c2.2 0 4.1.7 5.2 1.9h5.6C28.9 16.8 24.8 14 22 14z" />
            <path d="M35 15h4v19h-4z" />
            <circle cx="37" cy="38" r="2.5" fill="#F4D03F" />
          </svg>
        )

      case 'preset:inter':
        return (
          <div className="flex items-center justify-center font-black text-white tracking-tighter" style={{ fontSize: size === 'sm' ? '9px' : size === 'md' ? '11px' : size === 'lg' ? '13px' : '15px' }}>
            inter
          </div>
        )

      case 'preset:itau':
        return (
          <div className="flex items-center justify-center rounded-xs bg-[#003399] p-0.5 text-center">
            <span className="font-extrabold text-[#EC7000] italic" style={{ fontSize: size === 'sm' ? '8px' : '10px' }}>
              Itaú
            </span>
          </div>
        )

      case 'preset:bradesco':
        return (
          <svg viewBox="0 0 32 32" className={`${iconSizes} text-white fill-current`} aria-label="Bradesco">
            <rect x="4" y="22" width="24" height="4" rx="2" />
            <path d="M8 20c0-6 4-11 8-11s8 5 8 11h-3c0-4.4-2.2-8-5-8s-5 3.6-5 8H8z" />
            <circle cx="16" cy="6" r="2.5" />
          </svg>
        )

      case 'preset:santander':
        return (
          <svg viewBox="0 0 32 32" className={`${iconSizes} text-white fill-current`} aria-label="Santander">
            <path d="M16 4c-1.5 3-4 6-4 9 0 2.2 1.8 4 4 4s4-1.8 4-4c0-3-2.5-6-4-9z" />
            <path d="M10 16c-1 2-2.5 4-2.5 6 0 2 1.5 3.5 3.5 3.5s3.5-1.5 3.5-3.5c0-2.5-2.5-4-4.5-6z" opacity="0.9" />
            <path d="M22 16c1 2 2.5 4 2.5 6 0 2-1.5 3.5-3.5 3.5s-3.5-1.5-3.5-3.5c0-2.5 2.5-4 4.5-6z" opacity="0.9" />
          </svg>
        )

      case 'preset:bb':
        return (
          <div className="flex items-center justify-center rounded-xs bg-[#003882] px-1 font-black text-[#FCE000]" style={{ fontSize: size === 'sm' ? '8px' : '10px' }}>
            BB
          </div>
        )

      case 'preset:caixa':
        return (
          <div className="flex items-center justify-center font-black text-white" style={{ fontSize: size === 'sm' ? '9px' : '11px' }}>
            <span className="text-white">CAI</span>
            <span className="text-[#F58220]">X</span>
            <span className="text-white">A</span>
          </div>
        )

      case 'preset:xp':
        return (
          <div className="flex items-center justify-center font-black text-[#F2A900]" style={{ fontSize: size === 'sm' ? '10px' : '12px' }}>
            XP
          </div>
        )

      case 'preset:btg':
        return (
          <div className="flex items-center justify-center font-bold text-white tracking-tight" style={{ fontSize: size === 'sm' ? '8px' : '10px' }}>
            BTG
          </div>
        )

      case 'preset:mastercard':
        return (
          <div className="relative flex items-center justify-center h-4 w-6">
            <div className="absolute left-0.5 h-3.5 w-3.5 rounded-full bg-[#EB001B]" />
            <div className="absolute right-0.5 h-3.5 w-3.5 rounded-full bg-[#F79E1B] opacity-85" />
          </div>
        )

      case 'preset:visa':
        return (
          <div className="flex items-center justify-center font-extrabold text-white italic tracking-wider" style={{ fontSize: size === 'sm' ? '8px' : '10px' }}>
            VISA
          </div>
        )

      case 'preset:elo':
        return (
          <div className="flex items-center gap-0.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#E51B24]" />
            <span className="h-1.5 w-1.5 rounded-full bg-[#00A4E8]" />
            <span className="h-1.5 w-1.5 rounded-full bg-[#FFCB05]" />
          </div>
        )

      case 'preset:amex':
        return (
          <div className="flex items-center justify-center rounded-xs bg-[#006FCF] px-0.5 font-bold text-white" style={{ fontSize: size === 'sm' ? '7px' : '9px' }}>
            AMEX
          </div>
        )

      case 'preset:pix':
        return (
          <svg viewBox="0 0 48 48" className={`${iconSizes} text-white fill-current`} aria-label="Pix">
            <path d="M24 6.5L12 18.5l4.2 4.2 7.8-7.8 7.8 7.8 4.2-4.2L24 6.5zm0 35L12 29.5l4.2-4.2 7.8 7.8 7.8-7.8 4.2 4.2L24 41.5z" />
          </svg>
        )

      case 'preset:dinheiro':
        return <Banknote className={`${iconSizes} text-white`} />

      case 'preset:boleto':
        return <Barcode className={`${iconSizes} text-white`} />

      case 'preset:transferencia':
        return <ArrowLeftRight className={`${iconSizes} text-white`} />

      case 'preset:outros':
        return <Wallet className={`${iconSizes} text-white`} />

      default:
        return <CreditCard className={`${iconSizes} text-white`} />
    }
  }

  return (
    <div
      className={`flex items-center justify-center text-white shadow-xs shrink-0 select-none ${sizeClasses} ${className}`}
      style={bgStyle}
      title={nome || 'Forma de Pagamento'}
    >
      {renderSvgContent()}
    </div>
  )
}
