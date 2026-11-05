import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Sparkles,
  Bot,
  TrendingUp,
  ShieldAlert,
  History,
  LayoutDashboard,
} from 'lucide-react'
import { useAuth } from '@/app/providers/AuthProvider'
import { IaVisaoGeralTab } from '../components/IaVisaoGeralTab'
import { IaAssistenteTab } from '../components/IaAssistenteTab'
import { IaPrevisaoTab } from '../components/IaPrevisaoTab'
import { IaAnomaliasTab } from '../components/IaAnomaliasTab'
import { IaHistoricoTab } from '../components/IaHistoricoTab'

type AbaIa = 'visao' | 'assistente' | 'previsao' | 'anomalias' | 'historico'

const ABAS: Array<{ id: AbaIa; label: string; icon: any }> = [
  { id: 'visao', label: 'Visão Geral', icon: LayoutDashboard },
  { id: 'assistente', label: 'Assistente com IA', icon: Bot },
  { id: 'previsao', label: 'Previsão de Gastos', icon: TrendingUp },
  { id: 'anomalias', label: 'Anomalias e Alertas', icon: ShieldAlert },
  { id: 'historico', label: 'Histórico & Consumo', icon: History },
]

export function IaPage() {
  const { token } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  const [abaAtiva, setAbaAtiva] = useState<AbaIa>(() => {
    const p = searchParams.get('aba') as AbaIa
    if (['visao', 'assistente', 'previsao', 'anomalias', 'historico'].includes(p)) {
      return p
    }
    return 'visao'
  })

  useEffect(() => {
    const p = searchParams.get('aba') as AbaIa
    if (['visao', 'assistente', 'previsao', 'anomalias', 'historico'].includes(p)) {
      setAbaAtiva(p)
    }
  }, [searchParams])

  const selecionarAba = (novaAba: AbaIa) => {
    setAbaAtiva(novaAba)
    const next = new URLSearchParams(searchParams)
    if (novaAba === 'visao') {
      next.delete('aba')
    } else {
      next.set('aba', novaAba)
    }
    setSearchParams(next, { replace: true })
  }

  return (
    <div className="space-y-6">
      {/* Header do Módulo */}
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight text-[var(--color-text)]">
              Inteligência Artificial
            </h2>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
              <Sparkles className="h-3 w-3" />
              <span>SaaS IA</span>
            </span>
          </div>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Assistente conversacional, previsões preditivas e detecção automatizada de anomalias
          </p>
        </div>
      </header>

      {/* Navegação de Abas */}
      <nav
        aria-label="Abas de Inteligência Artificial"
        className="flex gap-1 overflow-x-auto border-b border-[var(--color-border)]"
      >
        {ABAS.map((aba) => {
          const Icon = aba.icon
          const isAtiva = abaAtiva === aba.id
          return (
            <button
              key={aba.id}
              type="button"
              onClick={() => selecionarAba(aba.id)}
              className={`-mb-px flex shrink-0 items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition cursor-pointer ${
                isAtiva
                  ? 'border-emerald-600 font-semibold text-emerald-700'
                  : 'border-transparent text-[var(--color-muted)] hover:border-slate-300 hover:text-[var(--color-text)]'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{aba.label}</span>
            </button>
          )
        })}
      </nav>

      {/* Conteúdo da Aba Ativa */}
      <main>
        {abaAtiva === 'visao' && (
          <IaVisaoGeralTab token={token ?? undefined} onNavegarAba={(a) => selecionarAba(a as AbaIa)} />
        )}
        {abaAtiva === 'assistente' && <IaAssistenteTab token={token ?? undefined} />}
        {abaAtiva === 'previsao' && <IaPrevisaoTab token={token ?? undefined} />}
        {abaAtiva === 'anomalias' && <IaAnomaliasTab token={token ?? undefined} />}
        {abaAtiva === 'historico' && <IaHistoricoTab token={token ?? undefined} />}
      </main>
    </div>
  )
}
