import type { SituacaoMeta } from '@/features/metas/types/metas'
import { getEstiloSituacao } from '@/features/metas/utils/calculosMetas'

interface MetaStatusBadgeProps {
  situacao: SituacaoMeta
  customLabel?: string
}

export function MetaStatusBadge({ situacao, customLabel }: MetaStatusBadgeProps) {
  const estilo = getEstiloSituacao(situacao)
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${estilo.badgeBg}`}
    >
      {customLabel ?? estilo.label}
    </span>
  )
}

