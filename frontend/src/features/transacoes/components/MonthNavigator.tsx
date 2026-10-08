import { useState, useRef, useEffect } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  CalendarRange,
  RotateCcw,
  ChevronDown,
} from 'lucide-react'
import {
  MESES_NOMES_PT,
  getCurrentMonthRange,
  getMonthRange,
  shiftMonth,
  formatMonthYearLabel,
} from '@/shared/utils/date'

interface MonthNavigatorProps {
  inicio: string
  fim: string
  mesFiltro: string
  onChangeRange: (inicio: string, fim: string, mes: string) => void
}

export function MonthNavigator({
  inicio,
  fim,
  mesFiltro,
  onChangeRange,
}: MonthNavigatorProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [customRangeOpen, setCustomRangeOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const currentRange = getCurrentMonthRange()
  const isCurrentMonth = mesFiltro === currentRange.isoMonth

  // Detectar se o range atual é diferente do mês inteiro (intervalo personalizado)
  const isCustomRange = (() => {
    if (!mesFiltro) return true
    const [ano, mes] = mesFiltro.split('-').map(Number)
    if (!ano || !mes) return true
    const expected = getMonthRange(ano, mes)
    return inicio !== expected.firstDay || fim !== expected.lastDay
  })()

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Navegar 1 mês para trás
  const handlePrevMonth = () => {
    const prev = shiftMonth(mesFiltro, -1)
    onChangeRange(prev.firstDay, prev.lastDay, prev.isoMonth)
    setCustomRangeOpen(false)
  }

  // Navegar 1 mês para frente
  const handleNextMonth = () => {
    const next = shiftMonth(mesFiltro, 1)
    onChangeRange(next.firstDay, next.lastDay, next.isoMonth)
    setCustomRangeOpen(false)
  }

  // Ir para o mês atual (Hoje)
  const handleCurrentMonth = () => {
    const curr = getCurrentMonthRange()
    onChangeRange(curr.firstDay, curr.lastDay, curr.isoMonth)
    setCustomRangeOpen(false)
    setDropdownOpen(false)
  }

  // Selecionar mês específico no dropdown
  const handleSelectMonth = (monthIndex: number, year: number) => {
    const range = getMonthRange(year, monthIndex + 1)
    onChangeRange(range.firstDay, range.lastDay, range.isoMonth)
    setCustomRangeOpen(false)
    setDropdownOpen(false)
  }

  // Selecionar ano no dropdown
  const currentYear = Number(mesFiltro.slice(0, 4)) || currentRange.year
  const currentMonthNum = Number(mesFiltro.slice(5, 7)) || currentRange.month

  const [selectedYear, setSelectedYear] = useState(currentYear)

  useEffect(() => {
    setSelectedYear(currentYear)
  }, [currentYear])

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Controles de Navegação Mensal com Setas estilo SaaS */}
      <div className="inline-flex items-center rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
        {/* Botão Mês Anterior (<) */}
        <button
          type="button"
          onClick={handlePrevMonth}
          title="Mês anterior"
          className="flex h-9 w-9 items-center justify-center rounded-l-[var(--radius-md)] text-[var(--color-muted)] transition hover:bg-[var(--color-bg)] hover:text-[var(--color-text)] active:scale-95"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {/* Pílula Central com Mês e Ano */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setDropdownOpen((prev) => !prev)}
            className="flex h-9 items-center gap-2 border-x border-[var(--color-border)] px-3 text-sm font-semibold text-[var(--color-text)] transition hover:bg-[var(--color-bg)]/80"
          >
            <Calendar className="h-4 w-4 text-[var(--color-primary)]" />
            <span>{formatMonthYearLabel(mesFiltro)}</span>
            <ChevronDown
              className={`h-3.5 w-3.5 text-[var(--color-muted)] transition-transform duration-150 ${
                dropdownOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {/* Dropdown Popover de Seleção Rápida de Mês e Ano */}
          {dropdownOpen ? (
            <div className="absolute left-1/2 top-full z-30 mt-1.5 w-64 -translate-x-1/2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-xl animate-in fade-in zoom-in-95 duration-150">
              {/* Seletor de Ano */}
              <div className="mb-2 flex items-center justify-between border-b border-[var(--color-border)] pb-2">
                <button
                  type="button"
                  onClick={() => setSelectedYear((y) => y - 1)}
                  className="rounded p-1 text-[var(--color-muted)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-sm font-bold text-[var(--color-text)]">{selectedYear}</span>
                <button
                  type="button"
                  onClick={() => setSelectedYear((y) => y + 1)}
                  className="rounded p-1 text-[var(--color-muted)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              {/* Grid de 12 Meses */}
              <div className="grid grid-cols-3 gap-1">
                {MESES_NOMES_PT.map((nomeMes, index) => {
                  const isSelected =
                    selectedYear === currentYear && index + 1 === currentMonthNum
                  const isThisMonth =
                    selectedYear === currentRange.year && index + 1 === currentRange.month

                  return (
                    <button
                      key={nomeMes}
                      type="button"
                      onClick={() => handleSelectMonth(index, selectedYear)}
                      className={`relative rounded-md py-1.5 text-xs font-medium transition ${
                        isSelected
                          ? 'bg-[var(--color-primary)] font-bold text-white shadow-sm'
                          : isThisMonth
                          ? 'border border-[var(--color-primary)]/40 bg-[var(--color-primary)]/10 text-[var(--color-primary)] hover:bg-[var(--color-primary)]/20'
                          : 'text-[var(--color-text)] hover:bg-[var(--color-bg)]'
                      }`}
                    >
                      {nomeMes.slice(0, 3)}
                      {isThisMonth && !isSelected ? (
                        <span className="absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-[var(--color-primary)]" />
                      ) : null}
                    </button>
                  )
                })}
              </div>

              {/* Botão Mês Atual no Rodapé do Popover */}
              <div className="mt-2.5 border-t border-[var(--color-border)] pt-2">
                <button
                  type="button"
                  onClick={handleCurrentMonth}
                  className="flex w-full items-center justify-center gap-1.5 rounded-md py-1 text-xs font-semibold text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>Voltar para Mês Atual</span>
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {/* Botão Próximo Mês (>) */}
        <button
          type="button"
          onClick={handleNextMonth}
          title="Próximo mês"
          className="flex h-9 w-9 items-center justify-center rounded-r-[var(--radius-md)] text-[var(--color-muted)] transition hover:bg-[var(--color-bg)] hover:text-[var(--color-text)] active:scale-95"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Botão Rápido 'Mês Atual' quando não estiver nele */}
      {!isCurrentMonth ? (
        <button
          type="button"
          onClick={handleCurrentMonth}
          title="Voltar para o mês corrente"
          className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 text-xs font-medium text-[var(--color-muted)] shadow-sm transition hover:border-[var(--color-primary)]/50 hover:bg-[var(--color-primary)]/5 hover:text-[var(--color-primary)]"
        >
          <RotateCcw className="h-3.5 w-3.5 text-[var(--color-primary)]" />
          <span className="hidden sm:inline">Mês Atual</span>
        </button>
      ) : null}

      {/* Botão Toggle para Intervalo Personalizado (Datas Específicas) */}
      <button
        type="button"
        onClick={() => setCustomRangeOpen((prev) => !prev)}
        title="Filtrar por período de datas personalizado"
        className={`inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-md)] border px-2.5 text-xs font-medium shadow-sm transition ${
          customRangeOpen || isCustomRange
            ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
            : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-muted)] hover:border-[var(--color-border)]/80 hover:text-[var(--color-text)]'
        }`}
      >
        <CalendarRange className="h-3.5 w-3.5" />
        <span className="hidden md:inline">
          {isCustomRange ? 'Período Personalizado' : 'Datas Exatas'}
        </span>
      </button>

      {/* Painel Expansível de Datas Personalizadas */}
      {customRangeOpen ? (
        <div className="flex flex-wrap items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-1.5 shadow-sm animate-in fade-in slide-in-from-left-2 duration-150">
          <input
            type="date"
            value={inicio}
            onChange={(e) => {
              const val = e.target.value
              onChangeRange(val, fim, val ? val.slice(0, 7) : mesFiltro)
            }}
            className="rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-xs outline-none focus:border-[var(--color-primary)]"
          />
          <span className="text-xs text-[var(--color-muted)]">até</span>
          <input
            type="date"
            value={fim}
            onChange={(e) => {
              const val = e.target.value
              onChangeRange(inicio, val, val ? val.slice(0, 7) : mesFiltro)
            }}
            className="rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-xs outline-none focus:border-[var(--color-primary)]"
          />
        </div>
      ) : null}
    </div>
  )
}
