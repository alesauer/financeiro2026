import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, Flame, Settings2, Target } from 'lucide-react'

import { ConfigurarMetasModal } from '@/features/metas/components/ConfigurarMetasModal'
import { metasService } from '@/features/metas/services/metasService'
import type { ResumoMetasResponse } from '@/features/metas/services/metasService'
import { formatCurrency } from '@/shared/utils/date'

const MESES_NOMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

interface MetasMiniBannerProps {
  token: string | null
  mesIso: string
  refreshTrigger?: unknown
}

export function MetasMiniBanner({ token, mesIso, refreshTrigger }: MetasMiniBannerProps) {
  const navigate = useNavigate()
  const [dados, setDados] = useState<ResumoMetasResponse | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  const [ano, mes] = (() => {
    if (mesIso && /^\d{4}-\d{2}$/.test(mesIso)) {
      const [y, m] = mesIso.split('-').map(Number)
      return [y, m]
    }
    const now = new Date()
    return [now.getFullYear(), now.getMonth() + 1]
  })()

  const carregar = useCallback(async () => {
    if (!token) return
    try {
      const resp = await metasService.resumo(token, mes, ano)
      setDados(resp)
    } catch {
      // Silencioso no mini-banner para nao interferir na listagem
    }
  }, [token, mes, ano])

  useEffect(() => {
    carregar()
  }, [carregar, refreshTrigger])

  if (!dados) return null

  const mesNome = MESES_NOMES[mes - 1] ?? 'Mês'
  const totalAtivas = dados.sumario_alertas.total_metas_ativas
  const { estouradas, atencao, ok } = dados.sumario_alertas
  const globalDesp = dados.meta_global_despesa

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2.5 shadow-2xs">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 font-bold text-[var(--color-text)]">
            <Target className="h-4 w-4 text-teal-600" />
            <span>Orçamento de {mesNome}:</span>
          </div>

          {totalAtivas === 0 ? (
            <span className="text-[var(--color-muted)]">
              Nenhuma meta definida (Média 3m:{' '}
              <strong className="text-[var(--color-text)]">
                {formatCurrency(dados.catalogo.global_despesa.media_3m)}
              </strong>
              )
            </span>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              {estouradas > 0 ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 font-semibold text-rose-700">
                  <Flame className="h-3.5 w-3.5" />
                  {estouradas} {estouradas === 1 ? 'meta estourada' : 'metas estouradas'}
                </span>
              ) : null}

              {atencao > 0 ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 font-semibold text-amber-800">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {atencao} em atenção
                </span>
              ) : null}

              {ok > 0 ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 font-semibold text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {ok} dentro da meta
                </span>
              ) : null}

              {globalDesp ? (
                <span className="text-[var(--color-muted)]">
                  • Teto global:{' '}
                  <strong className="text-[var(--color-text)]">
                    {formatCurrency(globalDesp.valor_realizado)}
                  </strong>{' '}
                  / {formatCurrency(globalDesp.valor_limite)} ({globalDesp.percentual.toFixed(0)}%)
                </span>
              ) : null}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-border)] bg-slate-50 px-2.5 py-1 text-xs font-semibold text-[var(--color-text)] hover:bg-slate-100 cursor-pointer"
          >
            <Settings2 className="h-3.5 w-3.5 text-teal-600" />
            {totalAtivas === 0 ? 'Criar Metas' : 'Ajustar Metas'}
          </button>

          {totalAtivas > 0 ? (
            <button
              type="button"
              onClick={() => navigate('/?aba=metas')}
              className="text-xs font-semibold text-teal-700 hover:underline cursor-pointer"
            >
              Painel completo →
            </button>
          ) : null}
        </div>
      </div>

      <ConfigurarMetasModal
        open={modalOpen}
        token={token}
        dados={dados}
        mesNome={mesNome}
        onClose={() => setModalOpen(false)}
        onSuccess={carregar}
      />
    </>
  )
}
