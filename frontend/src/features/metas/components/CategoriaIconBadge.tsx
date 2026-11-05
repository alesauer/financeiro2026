import {
  BookOpen,
  Car,
  Gamepad2,
  HeartPulse,
  Home,
  MoreHorizontal,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Utensils,
} from 'lucide-react'

interface CategoriaIconBadgeProps {
  nome: string
  size?: 'sm' | 'md' | 'lg'
}

export function CategoriaIconBadge({ nome, size = 'md' }: CategoriaIconBadgeProps) {
  const n = (nome || '').toLowerCase()

  let Icon = MoreHorizontal
  let bgClass = 'bg-slate-100 text-slate-600'

  if (n.includes('aliment') || n.includes('mercad') || n.includes('supermercad') || n.includes('feira')) {
    Icon = ShoppingCart
    bgClass = 'bg-emerald-50 text-emerald-600'
  } else if (n.includes('restaur') || n.includes('lanche') || n.includes('delivery') || n.includes('padaria')) {
    Icon = Utensils
    bgClass = 'bg-orange-50 text-orange-600'
  } else if (n.includes('transp') || n.includes('combust') || n.includes('carro') || n.includes('uber') || n.includes('veic')) {
    Icon = Car
    bgClass = 'bg-amber-50 text-amber-600'
  } else if (n.includes('morad') || n.includes('casa') || n.includes('alug') || n.includes('condom') || n.includes('luz') || n.includes('agua')) {
    Icon = Home
    bgClass = 'bg-rose-50 text-rose-600'
  } else if (n.includes('saud') || n.includes('saúd') || n.includes('medic') || n.includes('farmac') || n.includes('hospital')) {
    Icon = HeartPulse
    bgClass = 'bg-pink-50 text-pink-600'
  } else if (n.includes('lazer') || n.includes('viag') || n.includes('passeio') || n.includes('assinat') || n.includes('stream')) {
    Icon = Gamepad2
    bgClass = 'bg-sky-50 text-sky-600'
  } else if (n.includes('educ') || n.includes('escola') || n.includes('curso') || n.includes('faculd')) {
    Icon = BookOpen
    bgClass = 'bg-indigo-50 text-indigo-600'
  } else if (n.includes('compr') || n.includes('roupa') || n.includes('vestu')) {
    Icon = ShoppingBag
    bgClass = 'bg-purple-50 text-purple-600'
  } else if (n.includes('cuidad') || n.includes('beleza') || n.includes('estet')) {
    Icon = Sparkles
    bgClass = 'bg-teal-50 text-teal-600'
  }

  const sizeClasses =
    size === 'sm'
      ? 'h-7 w-7 rounded-lg'
      : size === 'lg'
        ? 'h-12 w-12 rounded-xl'
        : 'h-9 w-9 rounded-lg'

  const iconSizes = size === 'sm' ? 'h-4 w-4' : size === 'lg' ? 'h-6 w-6' : 'h-5 w-5'

  return (
    <span className={`inline-flex shrink-0 items-center justify-center ${sizeClasses} ${bgClass}`}>
      <Icon className={iconSizes} />
    </span>
  )
}

