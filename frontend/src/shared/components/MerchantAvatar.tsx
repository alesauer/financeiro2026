import { useState, useMemo } from 'react'
import {
  Utensils,
  ShoppingCart,
  Car,
  Plane,
  HeartPulse,
  Home,
  Gamepad2,
  BookOpen,
  ShoppingBag,
  Sparkles,
  Fuel,
  Store,
  CreditCard,
} from 'lucide-react'

interface MerchantAvatarProps {
  descricao?: string | null
  estabelecimentoNome?: string | null
  logoUrl?: string | null
  categoriaNome?: string | null
  size?: 'xs' | 'sm' | 'md' | 'lg'
  className?: string
}

// Cores determinísticas suaves para estabelecimentos sem logo
const COLOR_PALETTES = [
  'bg-emerald-50 text-emerald-700 border-emerald-200',
  'bg-blue-50 text-blue-700 border-blue-200',
  'bg-purple-50 text-purple-700 border-purple-200',
  'bg-amber-50 text-amber-700 border-amber-200',
  'bg-rose-50 text-rose-700 border-rose-200',
  'bg-teal-50 text-teal-700 border-teal-200',
  'bg-indigo-50 text-indigo-700 border-indigo-200',
  'bg-cyan-50 text-cyan-700 border-cyan-200',
]

function getInitialLetter(text?: string | null): string {
  if (!text) return '?'
  const clean = text.replace(/[^a-zA-Z0-9]/g, '').trim()
  return (clean[0] || '?').toUpperCase()
}

function getDeterministicColor(text?: string | null): string {
  if (!text) return COLOR_PALETTES[0]
  let hash = 0
  for (let i = 0; i < text.length; i++) {
    hash = text.charCodeAt(i) + ((hash << 5) - hash)
  }
  const index = Math.abs(hash) % COLOR_PALETTES.length
  return COLOR_PALETTES[index]
}

function getCategoryIcon(categoria?: string | null) {
  const c = (categoria || '').toLowerCase()
  if (c.includes('viag') || c.includes('aereo') || c.includes('aéreo') || c.includes('hotel') || c.includes('voo')) return Plane
  if (c.includes('combust') || c.includes('posto') || c.includes('gasolin')) return Fuel
  if (c.includes('restaur') || c.includes('lanche') || c.includes('aliment') || c.includes('bar ') || c.includes('cafe')) return Utensils
  if (c.includes('mercad') || c.includes('supermercad') || c.includes('feira')) return ShoppingCart
  if (c.includes('transp') || c.includes('carro') || c.includes('uber') || c.includes('veic') || c.includes('moto')) return Car
  if (c.includes('farmac') || c.includes('medic') || c.includes('saud') || c.includes('saúd') || c.includes('hospital')) return HeartPulse
  if (c.includes('morad') || c.includes('casa') || c.includes('alug') || c.includes('condom') || c.includes('luz') || c.includes('agua')) return Home
  if (c.includes('lazer') || c.includes('cinema') || c.includes('stream') || c.includes('jogos') || c.includes('assinat')) return Gamepad2
  if (c.includes('educ') || c.includes('livr') || c.includes('curso') || c.includes('escola')) return BookOpen
  if (c.includes('compr') || c.includes('roupa') || c.includes('calc') || c.includes('eletron')) return ShoppingBag
  if (c.includes('cuidad') || c.includes('beleza') || c.includes('barbearia') || c.includes('salao')) return Sparkles
  if (c.includes('cartao') || c.includes('fatura') || c.includes('banco') || c.includes('anuidade')) return CreditCard
  return Store
}

export function MerchantAvatar({
  descricao,
  estabelecimentoNome,
  logoUrl,
  categoriaNome,
  size = 'sm',
  className = '',
}: MerchantAvatarProps) {
  const [imgError, setImgError] = useState(false)

  const sizeClasses = {
    xs: 'h-6 w-6 text-[10px]',
    sm: 'h-7 w-7 text-xs',
    md: 'h-8 w-8 text-sm',
    lg: 'h-10 w-10 text-base',
  }[size]

  const iconSizes = {
    xs: 'h-3 w-3',
    sm: 'h-3.5 w-3.5',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  }[size]

  const initial = useMemo(() => getInitialLetter(estabelecimentoNome || descricao), [estabelecimentoNome, descricao])
  const colorClass = useMemo(() => getDeterministicColor(estabelecimentoNome || descricao), [estabelecimentoNome, descricao])
  const FallbackIcon = useMemo(() => getCategoryIcon(categoriaNome), [categoriaNome])

  const displayName = estabelecimentoNome || descricao || 'Estabelecimento'

  if (logoUrl && !imgError) {
    return (
      <div
        className={`relative inline-flex flex-shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[var(--color-border)]/60 bg-white p-0.5 shadow-2xs ${sizeClasses} ${className}`}
        title={displayName}
      >
        <img
          src={logoUrl}
          alt={displayName}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          className="h-full w-full object-contain rounded-md"
        />
      </div>
    )
  }

  // Fallback: avatar temático com cor suave e ícone da categoria ou inicial
  return (
    <div
      className={`inline-flex flex-shrink-0 items-center justify-center rounded-lg border font-semibold shadow-2xs ${colorClass} ${sizeClasses} ${className}`}
      title={displayName}
    >
      {categoriaNome ? (
        <FallbackIcon className={iconSizes} strokeWidth={2.2} />
      ) : (
        <span>{initial}</span>
      )}
    </div>
  )
}
