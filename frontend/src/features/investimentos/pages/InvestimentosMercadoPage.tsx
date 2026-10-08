import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@/app/providers/AuthProvider'
import { investimentosService } from '@/features/investimentos/services/investimentosService'
import type {
  MarketSearchResult,
  MarketSnapshotItem,
  MarketSnapshotResponse,
  SimulacaoRendaFixaResponse,
} from '@/shared/types/investimento'
import { getErrorMessage } from '@/shared/utils/error'
import {
  TrendingUp,
  Building2,
  Landmark,
  Calculator,
  Globe2,
  Coins,
  RefreshCw,
  Search,
  X,
  Copy,
  Check,
  Sparkles,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react'

type TabType = 'acoes' | 'fiis' | 'renda_fixa' | 'simulador' | 'bdrs_etfs' | 'cambio'

function formatCurrency(value: number | null) {
  if (value === null || Number.isNaN(value)) return '—'
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatNumber(value: number | null, decimals = 2) {
  if (value === null || Number.isNaN(value)) return '—'
  return value.toLocaleString('pt-BR', { maximumFractionDigits: decimals, minimumFractionDigits: decimals })
}

function formatMarketCap(value: number | null | undefined) {
  if (!value || Number.isNaN(value)) return null
  if (value >= 1_000_000_000_000) return `R$ ${(value / 1_000_000_000_000).toFixed(2)} Tri`
  if (value >= 1_000_000_000) return `R$ ${(value / 1_000_000_000).toFixed(2)} Bi`
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(2)} Mi`
  return `R$ ${value.toLocaleString('pt-BR')}`
}

function ChangeBadge({ value }: { value: number | null }) {
  if (value === null || Number.isNaN(value)) {
    return <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs text-slate-500">—</span>
  }
  const positive = value >= 0
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-bold ${
        positive
          ? 'bg-emerald-500/15 text-emerald-700 dark:bg-emerald-400/20 dark:text-emerald-300'
          : 'bg-rose-500/15 text-rose-700 dark:bg-rose-400/20 dark:text-rose-300'
      }`}
    >
      {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {positive ? '+' : ''}
      {value.toFixed(2).replace('.', ',')}%
    </span>
  )
}

function TickerCard({
  item,
  onSelect,
}: {
  item: MarketSnapshotItem
  onSelect?: (item: MarketSnapshotItem) => void
}) {
  const positive = (item.change_percent ?? 0) >= 0

  return (
    <article
      onClick={() => onSelect?.(item)}
      className={`group relative flex flex-col justify-between overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-xs transition hover:border-[var(--color-primary)] hover:shadow-md ${
        onSelect ? 'cursor-pointer' : ''
      }`}
    >
      <div>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            {item.logo ? (
              <img
                src={item.logo}
                alt={item.symbol}
                className="h-9 w-9 rounded-lg border border-[var(--color-border)] bg-white object-contain p-0.5 shadow-2xs"
                onError={(e) => {
                  ;(e.currentTarget as HTMLElement).style.display = 'none'
                }}
              />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-primary)]/10 font-bold text-xs text-[var(--color-primary)]">
                {item.symbol.slice(0, 4)}
              </div>
            )}
            <div>
              <h4 className="font-bold text-sm text-[var(--color-text)] group-hover:text-[var(--color-primary)] transition flex items-center gap-1.5">
                {item.symbol}
              </h4>
              <p className="max-w-[140px] truncate text-[11px] text-[var(--color-muted)]" title={item.name}>
                {item.name}
              </p>
            </div>
          </div>
          <ChangeBadge value={item.change_percent ?? null} />
        </div>

        {/* Preço Atual */}
        <div className="mt-3">
          <span className="text-xl font-extrabold tracking-tight text-[var(--color-text)]">
            {item.currency === 'USD' ? `$ ${formatNumber(item.price)}` : formatCurrency(item.price)}
          </span>
          {item.change !== null && (
            <span className={`ml-2 text-xs font-semibold ${positive ? 'text-emerald-600' : 'text-rose-600'}`}>
              {positive ? '+' : ''}
              {formatNumber(item.change)}
            </span>
          )}
        </div>

        {/* 52w Range bar se disponível */}
        {item.min_52w && item.max_52w && item.price && (
          <div className="mt-3">
            <div className="flex justify-between text-[10px] text-[var(--color-muted)]">
              <span>Mín 52s: {formatNumber(item.min_52w)}</span>
              <span>Máx 52s: {formatNumber(item.max_52w)}</span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-bg)]">
              <div
                className="h-full rounded-full bg-[var(--color-primary)]"
                style={{
                  width: `${Math.max(
                    5,
                    Math.min(
                      100,
                      ((item.price - item.min_52w) / (item.max_52w - item.min_52w)) * 100
                    )
                  )}%`,
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Footer Info (P/L e Volume) */}
      {(item.pl !== undefined && item.pl !== null) || item.volume ? (
        <div className="mt-3 flex items-center justify-between border-t border-[var(--color-border)]/60 pt-2 text-[10px] text-[var(--color-muted)]">
          {item.pl !== null && item.pl !== undefined ? (
            <span>
              P/L: <strong>{formatNumber(item.pl, 1)}</strong>
            </span>
          ) : (
            <span />
          )}
          {item.volume ? (
            <span>
              Vol: <strong>{(item.volume / 1000000).toFixed(1)}M</strong>
            </span>
          ) : null}
        </div>
      ) : null}
    </article>
  )
}

function SearchResultCard({
  item,
  onSelect,
}: {
  item: MarketSearchResult
  onSelect: (item: MarketSearchResult) => void
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(item.symbol)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const typeLabel = useMemo(() => {
    const t = (item.type || '').toLowerCase()
    if (t === 'stock') return 'Ação B3'
    if (t === 'fund') return 'FII / Fundo'
    if (t === 'bdr') return 'BDR'
    if (t === 'etf') return 'ETF'
    return 'Ativo B3'
  }, [item.type])

  return (
    <article
      onClick={() => onSelect(item)}
      className="group relative flex flex-col justify-between overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-xs transition hover:border-[var(--color-primary)] hover:shadow-md cursor-pointer"
    >
      <div>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            {item.logo ? (
              <img
                src={item.logo}
                alt={item.symbol}
                className="h-10 w-10 rounded-lg border border-[var(--color-border)] bg-white object-contain p-1 shadow-2xs"
                onError={(e) => {
                  ;(e.currentTarget as HTMLElement).style.display = 'none'
                }}
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-primary)]/10 font-bold text-xs text-[var(--color-primary)]">
                {item.symbol.slice(0, 4)}
              </div>
            )}
            <div>
              <div className="flex items-center gap-1.5">
                <h4 className="font-bold text-sm text-[var(--color-text)] group-hover:text-[var(--color-primary)] transition">
                  {item.symbol}
                </h4>
                <span className="rounded-full bg-[var(--color-bg)] border border-[var(--color-border)] px-1.5 py-0.2 text-[9px] font-semibold text-[var(--color-muted)]">
                  {typeLabel}
                </span>
              </div>
              <p className="max-w-[170px] truncate text-xs text-[var(--color-muted)] mt-0.5" title={item.name}>
                {item.name}
              </p>
            </div>
          </div>
          <ChangeBadge value={item.change_percent ?? null} />
        </div>

        {/* Preço e Setor */}
        <div className="mt-3.5 flex items-baseline justify-between">
          <div>
            <span className="text-xl font-extrabold tracking-tight text-[var(--color-text)]">
              {formatCurrency(item.price)}
            </span>
          </div>
          <button
            type="button"
            onClick={handleCopy}
            title="Copiar ticker"
            className="rounded p-1 text-[var(--color-muted)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)] transition"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        </div>

        {(item.sector || item.subsector) && (
          <div className="mt-2 flex flex-wrap gap-1">
            {item.sector && (
              <span className="rounded bg-[var(--color-bg)] px-1.5 py-0.5 text-[10px] text-[var(--color-muted)] font-medium truncate max-w-[140px]">
                {item.sector}
              </span>
            )}
            {item.subsector && (
              <span className="rounded bg-[var(--color-bg)] px-1.5 py-0.5 text-[10px] text-[var(--color-muted)] font-medium truncate max-w-[140px]">
                {item.subsector}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Footer com Volume / Cap */}
      <div className="mt-3.5 flex items-center justify-between border-t border-[var(--color-border)]/60 pt-2 text-[10px] text-[var(--color-muted)]">
        <span>
          {item.market_cap ? formatMarketCap(item.market_cap) : item.volume ? `Vol: ${(item.volume / 1000).toFixed(0)}k` : 'B3'}
        </span>
        <span className="font-semibold text-[var(--color-primary)] group-hover:underline flex items-center gap-0.5">
          Ver cotação <ArrowUpRight className="h-3 w-3" />
        </span>
      </div>
    </article>
  )
}


export function InvestimentosMercadoPage() {
  const { token } = useAuth()
  const [tab, setTab] = useState<TabType>('acoes')
  const [data, setData] = useState<MarketSnapshotResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Live Search State
  const [busca, setBusca] = useState('')
  const [searchResults, setSearchResults] = useState<MarketSearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchFilterType, setSearchFilterType] = useState<string>('all')
  const searchTimeoutRef = useRef<any>(null)

  // Modal de Detalhes da Cotação
  const [selectedAsset, setSelectedAsset] = useState<any | null>(null)
  const [loadingQuote, setLoadingQuote] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalCopied, setModalCopied] = useState(false)

  // Simulador de Renda Fixa State
  const [simValor, setSimValor] = useState<number>(10000)
  const [simPrazo, setSimPrazo] = useState<number>(24)
  const [simAporte, setSimAporte] = useState<number>(0)
  const [simResultado, setSimResultado] = useState<SimulacaoRendaFixaResponse | null>(null)
  const [simulando, setSimulando] = useState(false)

  const carregarSnapshot = async (silent = false) => {
    if (!token) return
    if (!silent) setLoading(true)
    setError(null)
    try {
      const res = await investimentosService.marketSnapshot(token)
      setData(res)
    } catch (err) {
      setError(getErrorMessage(err, 'Não foi possível carregar dados de mercado.'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const rodarSimulacao = async () => {
    if (!token) return
    setSimulando(true)
    try {
      const res = await investimentosService.simulateFixedIncome(token, {
        valor_inicial: simValor,
        prazo_meses: simPrazo,
        aporte_mensal: simAporte,
      })
      setSimResultado(res)
    } catch (err) {
      console.error(err)
    } finally {
      setSimulando(false)
    }
  }

  // Debounced Live Search na B3 via brapi.dev
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    const q = busca.trim()
    if (q.length < 2) {
      setSearchResults([])
      setIsSearching(false)
      return
    }

    setIsSearching(true)
    searchTimeoutRef.current = setTimeout(async () => {
      if (!token) return
      try {
        const results = await investimentosService.searchMarket(token, q)
        setSearchResults(results || [])
      } catch (err) {
        console.error('Erro na busca de mercado:', err)
        setSearchResults([])
      } finally {
        setIsSearching(false)
      }
    }, 300)

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [busca, token])

  const abrirDetalheAtivo = async (symbol: string, initialData?: any) => {
    setSelectedAsset(initialData || { symbol, name: symbol })
    setModalOpen(true)
    setLoadingQuote(true)
    if (!token) return

    try {
      const quote = await investimentosService.getQuote(token, symbol)
      if (quote) {
        setSelectedAsset((prev: any) => ({
          ...prev,
          ...quote,
          symbol: quote.codigo || symbol,
          name: quote.nome || prev?.name || symbol,
          price: quote.preco !== undefined ? quote.preco : prev?.price,
          change: quote.variacao !== undefined ? quote.variacao : prev?.change,
          change_percent: quote.variacao_percentual !== undefined ? quote.variacao_percentual : prev?.change_percent,
        }))
      }
    } catch (err) {
      console.error('Erro ao buscar detalhes da cotação:', err)
    } finally {
      setLoadingQuote(false)
    }
  }

  useEffect(() => {
    carregarSnapshot()
  }, [token])

  useEffect(() => {
    if (tab === 'simulador' && !simResultado) {
      rodarSimulacao()
    }
  }, [tab])

  const atualizacaoLabel = useMemo(() => {
    if (!data?.updated_at) return 'Atualizado recentemente'
    const dt = new Date(data.updated_at)
    if (Number.isNaN(dt.getTime())) return 'Atualizado recentemente'
    return `Atualizado às ${dt.toLocaleTimeString('pt-BR')}`
  }, [data?.updated_at])

  // Filtragem de search results por tipo
  const filteredSearchResults = useMemo(() => {
    if (searchFilterType === 'all') return searchResults
    return searchResults.filter((item) => (item.type || '').toLowerCase() === searchFilterType.toLowerCase())
  }, [searchResults, searchFilterType])

  const indicadoresBcb = data?.renda_fixa?.indicadores || {}
  const tesouroDireto = data?.renda_fixa?.tesouro_direto || []

  return (
    <section className="space-y-6 pb-12">
      {/* 1. Header Principal */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight text-[var(--color-text)]">
              Mercado & Renda Fixa
            </h2>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-0.5 text-xs font-semibold text-[var(--color-text)] shadow-2xs">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              {data?.source ?? 'brapi.dev + BCB'}
            </span>
          </div>
          <p className="text-xs text-[var(--color-muted)] mt-1">
            Cotações em tempo real B3 via brapi.dev, taxas oficiais do Banco Central (BCB) e simulador avançado de Renda Fixa.
          </p>
        </div>

        {/* Atualizar & Horário */}
        <div className="flex items-center gap-2.5">
          <span className="text-xs text-[var(--color-muted)]">{atualizacaoLabel}</span>
          <button
            type="button"
            onClick={() => {
              setRefreshing(true)
              carregarSnapshot(true)
              if (tab === 'simulador') rodarSimulacao()
            }}
            disabled={refreshing || loading}
            className="flex items-center gap-1.5 rounded-[var(--radius-sm)] bg-[var(--color-primary)] px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition hover:opacity-90 disabled:opacity-40"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Atualizando...' : 'Atualizar'}
          </button>
        </div>
      </header>

      {error && (
        <div className="rounded-[var(--radius-sm)] bg-rose-50 p-3 text-xs font-medium text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
          {error}
        </div>
      )}

      {/* 2. Barra de Busca Global na B3 (Tempo Real) */}
      <div className="relative rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3.5 shadow-xs">
        <div className="relative flex items-center">
          <Search className="absolute left-3.5 h-4 w-4 text-[var(--color-muted)]" />
          <input
            type="text"
            placeholder="Pesquisar qualquer ação, FII, ETF ou BDR na B3 (ex: PETR4, VALE3, MXRF11, WEGE3, IVVB11, ITUB4)..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] py-2.5 pl-10 pr-10 text-sm font-medium text-[var(--color-text)] placeholder:text-[var(--color-muted)] focus:border-[var(--color-primary)] focus:outline-hidden shadow-2xs"
          />
          {busca && (
            <button
              type="button"
              onClick={() => setBusca('')}
              className="absolute right-3 rounded-full p-1 text-[var(--color-muted)] hover:bg-[var(--color-border)]/40 hover:text-[var(--color-text)] transition"
              title="Limpar busca"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          {isSearching && (
            <div className="absolute right-10 flex items-center gap-1.5 text-xs font-medium text-[var(--color-primary)]">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          )}
        </div>
        {busca.trim().length > 0 && busca.trim().length < 2 && (
          <p className="mt-2 text-[11px] text-[var(--color-muted)] pl-1">
            Digite pelo menos 2 caracteres para pesquisar em toda a B3 via brapi.dev...
          </p>
        )}
      </div>

      {/* Se houver busca ativa (>= 2 chars), exibe os resultados da busca na B3 */}
      {busca.trim().length >= 2 ? (
        <section className="space-y-4 animate-in fade-in duration-150">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[var(--color-primary)]" />
              <h3 className="font-bold text-sm text-[var(--color-text)]">
                Resultados da busca na B3 para &ldquo;{busca}&rdquo;
              </h3>
              <span className="rounded-full bg-[var(--color-primary)]/10 px-2 py-0.5 text-xs font-bold text-[var(--color-primary)]">
                {searchResults.length} {searchResults.length === 1 ? 'ativo' : 'ativos'}
              </span>
            </div>

            {/* Filtros por tipo de ativo retornado */}
            {searchResults.length > 0 && (
              <div className="flex items-center gap-1 text-xs">
                <button
                  type="button"
                  onClick={() => setSearchFilterType('all')}
                  className={`rounded-full px-2.5 py-1 font-semibold transition ${
                    searchFilterType === 'all'
                      ? 'bg-[var(--color-primary)] text-white'
                      : 'bg-[var(--color-bg)] text-[var(--color-muted)] hover:text-[var(--color-text)]'
                  }`}
                >
                  Todos ({searchResults.length})
                </button>
                {searchResults.some((i) => i.type === 'stock') && (
                  <button
                    type="button"
                    onClick={() => setSearchFilterType('stock')}
                    className={`rounded-full px-2.5 py-1 font-semibold transition ${
                      searchFilterType === 'stock'
                        ? 'bg-[var(--color-primary)] text-white'
                        : 'bg-[var(--color-bg)] text-[var(--color-muted)] hover:text-[var(--color-text)]'
                    }`}
                  >
                    Ações ({searchResults.filter((i) => i.type === 'stock').length})
                  </button>
                )}
                {searchResults.some((i) => i.type === 'fund') && (
                  <button
                    type="button"
                    onClick={() => setSearchFilterType('fund')}
                    className={`rounded-full px-2.5 py-1 font-semibold transition ${
                      searchFilterType === 'fund'
                        ? 'bg-[var(--color-primary)] text-white'
                        : 'bg-[var(--color-bg)] text-[var(--color-muted)] hover:text-[var(--color-text)]'
                    }`}
                  >
                    FIIs ({searchResults.filter((i) => i.type === 'fund').length})
                  </button>
                )}
                {searchResults.some((i) => i.type === 'bdr') && (
                  <button
                    type="button"
                    onClick={() => setSearchFilterType('bdr')}
                    className={`rounded-full px-2.5 py-1 font-semibold transition ${
                      searchFilterType === 'bdr'
                        ? 'bg-[var(--color-primary)] text-white'
                        : 'bg-[var(--color-bg)] text-[var(--color-muted)] hover:text-[var(--color-text)]'
                    }`}
                  >
                    BDRs ({searchResults.filter((i) => i.type === 'bdr').length})
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Grid de Resultados */}
          {isSearching ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-[var(--color-primary)]" />
              <p className="mt-3 text-xs font-semibold text-[var(--color-text)]">
                Buscando cotações em tempo real na B3 via brapi.dev...
              </p>
            </div>
          ) : filteredSearchResults.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredSearchResults.map((item) => (
                <SearchResultCard
                  key={item.symbol}
                  item={item}
                  onSelect={(sel) => abrirDetalheAtivo(sel.symbol, sel)}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-12 text-center">
              <Search className="mx-auto h-8 w-8 text-[var(--color-muted)]" />
              <h4 className="mt-3 text-sm font-bold text-[var(--color-text)]">
                Nenhum ativo encontrado para &ldquo;{busca}&rdquo;
              </h4>
              <p className="mt-1 text-xs text-[var(--color-muted)] max-w-md mx-auto">
                Verifique se o código ou nome está correto (exemplo: PETR4, VALE3, MXRF11, ITUB4, WEGE3, BBDC4, IVVB11).
              </p>
              <button
                type="button"
                onClick={() => setBusca('')}
                className="mt-4 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-1.5 text-xs font-semibold text-[var(--color-text)] hover:bg-[var(--color-surface)]"
              >
                Voltar à visão geral
              </button>
            </div>
          )}
        </section>
      ) : (
        <>
          {/* 3. Ribbon de Principais Índices & Indicadores Macroeconômicos */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
            {/* Ibovespa */}
            {data?.indices?.find((i) => i.symbol === '^BVSP') && (
              <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                    Ibovespa
                  </span>
                  <ChangeBadge value={data.indices.find((i) => i.symbol === '^BVSP')?.change_percent ?? null} />
                </div>
                <p className="mt-1 text-base font-bold text-[var(--color-text)]">
                  {formatNumber(data.indices.find((i) => i.symbol === '^BVSP')?.price ?? null, 0)}{' '}
                  <span className="text-[10px] text-[var(--color-muted)]">pts</span>
                </p>
              </div>
            )}

            {/* Selic */}
            <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                  Selic Meta
                </span>
                <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.2 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                  BCB
                </span>
              </div>
              <p className="mt-1 text-base font-bold text-emerald-600 dark:text-emerald-400">
                {formatNumber(indicadoresBcb?.selic?.valor ?? 13.75)}%{' '}
                <span className="text-[10px] text-[var(--color-muted)]">a.a.</span>
              </p>
            </div>

            {/* CDI */}
            <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                  CDI (12m)
                </span>
                <span className="rounded-full bg-sky-500/15 px-1.5 py-0.2 text-[10px] font-bold text-sky-700 dark:text-sky-300">
                  B3
                </span>
              </div>
              <p className="mt-1 text-base font-bold text-sky-600 dark:text-sky-400">
                {formatNumber(indicadoresBcb?.cdi?.valor ?? 13.65)}%{' '}
                <span className="text-[10px] text-[var(--color-muted)]">a.a.</span>
              </p>
            </div>

            {/* IPCA */}
            <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                  IPCA (12m)
                </span>
                <span className="rounded-full bg-amber-500/15 px-1.5 py-0.2 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                  IBGE
                </span>
              </div>
              <p className="mt-1 text-base font-bold text-amber-600 dark:text-amber-400">
                {formatNumber(indicadoresBcb?.ipca?.valor ?? 4.22)}%{' '}
                <span className="text-[10px] text-[var(--color-muted)]">12m</span>
              </p>
            </div>

            {/* Dólar */}
            {data?.fx?.find((i) => i.symbol === 'USDBRL=X') && (
              <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                    Dólar
                  </span>
                  <ChangeBadge value={data.fx.find((i) => i.symbol === 'USDBRL=X')?.change_percent ?? null} />
                </div>
                <p className="mt-1 text-base font-bold text-[var(--color-text)]">
                  {formatCurrency(data.fx.find((i) => i.symbol === 'USDBRL=X')?.price ?? null)}
                </p>
              </div>
            )}

            {/* Bitcoin */}
            {data?.fx?.find((i) => i.symbol === 'BTC-USD') && (
              <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                    Bitcoin
                  </span>
                  <ChangeBadge value={data.fx.find((i) => i.symbol === 'BTC-USD')?.change_percent ?? null} />
                </div>
                <p className="mt-1 text-base font-bold text-[var(--color-text)]">
                  $ {formatNumber(data.fx.find((i) => i.symbol === 'BTC-USD')?.price ?? null, 0)}
                </p>
              </div>
            )}
          </div>

          {/* 4. Navegação por Abas Modernas */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] pb-1">
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                onClick={() => setTab('acoes')}
                className={`flex items-center gap-1.5 rounded-[var(--radius-sm)] px-3.5 py-2 text-xs font-semibold transition ${
                  tab === 'acoes'
                    ? 'bg-[var(--color-primary)] text-white shadow-xs'
                    : 'text-[var(--color-muted)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]'
                }`}
              >
                <TrendingUp className="h-4 w-4" />
                Ações B3 ({data?.acoes?.length || 0})
              </button>

              <button
                type="button"
                onClick={() => setTab('fiis')}
                className={`flex items-center gap-1.5 rounded-[var(--radius-sm)] px-3.5 py-2 text-xs font-semibold transition ${
                  tab === 'fiis'
                    ? 'bg-[var(--color-primary)] text-white shadow-xs'
                    : 'text-[var(--color-muted)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]'
                }`}
              >
                <Building2 className="h-4 w-4" />
                Fundos Imobiliários (FIIs) ({data?.fiis?.length || 0})
              </button>

              <button
                type="button"
                onClick={() => setTab('renda_fixa')}
                className={`flex items-center gap-1.5 rounded-[var(--radius-sm)] px-3.5 py-2 text-xs font-semibold transition ${
                  tab === 'renda_fixa'
                    ? 'bg-[var(--color-primary)] text-white shadow-xs'
                    : 'text-[var(--color-muted)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]'
                }`}
              >
                <Landmark className="h-4 w-4" />
                Renda Fixa & Tesouro
              </button>

              <button
                type="button"
                onClick={() => setTab('simulador')}
                className={`flex items-center gap-1.5 rounded-[var(--radius-sm)] px-3.5 py-2 text-xs font-semibold transition ${
                  tab === 'simulador'
                    ? 'bg-[var(--color-primary)] text-white shadow-xs'
                    : 'text-[var(--color-muted)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]'
                }`}
              >
                <Calculator className="h-4 w-4" />
                Simulador CDB vs LCI vs Tesouro
              </button>

              <button
                type="button"
                onClick={() => setTab('bdrs_etfs')}
                className={`flex items-center gap-1.5 rounded-[var(--radius-sm)] px-3.5 py-2 text-xs font-semibold transition ${
                  tab === 'bdrs_etfs'
                    ? 'bg-[var(--color-primary)] text-white shadow-xs'
                    : 'text-[var(--color-muted)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]'
                }`}
              >
                <Globe2 className="h-4 w-4" />
                BDRs & ETFs ({data?.bdrs_etfs?.length || 0})
              </button>

              <button
                type="button"
                onClick={() => setTab('cambio')}
                className={`flex items-center gap-1.5 rounded-[var(--radius-sm)] px-3.5 py-2 text-xs font-semibold transition ${
                  tab === 'cambio'
                    ? 'bg-[var(--color-primary)] text-white shadow-xs'
                    : 'text-[var(--color-muted)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]'
                }`}
              >
                <Coins className="h-4 w-4" />
                Câmbio & Criptos
              </button>
            </div>
          </div>

          {/* 5. Conteúdo das Abas */}

          {/* TAB 1: AÇÕES B3 */}
          {tab === 'acoes' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {(data?.acoes || []).map((item) => (
                  <TickerCard
                    key={item.symbol}
                    item={item}
                    onSelect={(sel) => abrirDetalheAtivo(sel.symbol, sel)}
                  />
                ))}
              </div>
              {(data?.acoes || []).length === 0 && !loading && (
                <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] p-8 text-center text-xs text-[var(--color-muted)]">
                  Nenhuma ação carregada no momento. Use o campo de busca acima para pesquisar qualquer ativo.
                </div>
              )}
            </div>
          )}

          {/* TAB 2: FUNDOS IMOBILIÁRIOS */}
          {tab === 'fiis' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {(data?.fiis || []).map((item) => (
                  <TickerCard
                    key={item.symbol}
                    item={item}
                    onSelect={(sel) => abrirDetalheAtivo(sel.symbol, sel)}
                  />
                ))}
              </div>
              {(data?.fiis || []).length === 0 && !loading && (
                <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] p-8 text-center text-xs text-[var(--color-muted)]">
                  Nenhum fundo imobiliário carregado no momento. Use o campo de busca acima para pesquisar.
                </div>
              )}
            </div>
          )}

          {/* TAB 3: RENDA FIXA & TESOURO DIRETO */}
          {tab === 'renda_fixa' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              {/* Indicadores Oficiais */}
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-3">
                  Indicadores Macroeconômicos Oficiais (Banco Central do Brasil)
                </h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
                  {Object.entries(indicadoresBcb).map(([key, ind]) => (
                    <div
                      key={key}
                      className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3.5 shadow-2xs"
                    >
                      <span className="text-[11px] font-semibold text-[var(--color-muted)] block">
                        {ind.nome}
                      </span>
                      <span className="mt-1 block text-xl font-extrabold text-[var(--color-text)]">
                        {formatNumber(ind.valor)}%
                      </span>
                      <span className="text-[10px] text-[var(--color-muted)] mt-0.5 block">
                        {ind.periodo} {ind.atualizado_em ? `· ${ind.atualizado_em}` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Títulos do Tesouro Direto */}
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-3">
                  Títulos do Tesouro Direto (Taxas e Preços de Resgate)
                </h3>

                <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xs">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-[var(--color-border)] text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                      <tr>
                        <th className="py-3 px-4">Título</th>
                        <th className="py-3 px-3">Indexador / Tipo</th>
                        <th className="py-3 px-3 text-right">Rentabilidade Anual</th>
                        <th className="py-3 px-3">Vencimento</th>
                        <th className="py-3 px-3 text-right">Investimento Mín.</th>
                        <th className="py-3 px-3 text-right">Preço Unitário (PU)</th>
                        <th className="py-3 px-4">Indicação / Risco</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-border)]/60">
                      {tesouroDireto.map((t) => (
                        <tr key={t.titulo} className="transition hover:bg-[var(--color-bg)]/40">
                          <td className="py-3 px-4 font-bold text-[var(--color-text)]">
                            {t.titulo}
                          </td>
                          <td className="py-3 px-3">
                            <span className="rounded-full bg-[var(--color-bg)] border border-[var(--color-border)] px-2 py-0.5 text-[10px] font-semibold">
                              {t.indexador} · {t.tipo}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                            {t.rentabilidade_anual}
                          </td>
                          <td className="py-3 px-3 font-medium text-[var(--color-text)]">
                            {t.vencimento}
                          </td>
                          <td className="py-3 px-3 text-right font-semibold text-[var(--color-text)]">
                            {formatCurrency(t.investimento_minimo)}
                          </td>
                          <td className="py-3 px-3 text-right text-[var(--color-muted)] font-medium">
                            {formatCurrency(t.preco_unitario)}
                          </td>
                          <td className="py-3 px-4 text-[11px] text-[var(--color-muted)]">
                            {t.indicacao}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: SIMULADOR E COMPARADOR DE RENDA FIXA */}
          {tab === 'simulador' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              {/* Controles de Simulação */}
              <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-xs">
                <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--color-text)] flex items-center gap-2">
                  <Calculator className="h-4 w-4 text-[var(--color-primary)]" />
                  Simulador & Comparador de Rentabilidade Real
                </h3>
                <p className="text-xs text-[var(--color-muted)] mt-1">
                  Compare rendimento bruto vs líquido de CDBs (com tabela regressiva de IR), LCIs/LCAs isentas, Tesouro Direto e Poupança.
                </p>

                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-1">
                      Valor Inicial (R$)
                    </label>
                    <input
                      type="number"
                      min={100}
                      step={500}
                      value={simValor}
                      onChange={(e) => setSimValor(parseFloat(e.target.value) || 0)}
                      className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm font-bold text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                        Prazo (Meses)
                      </label>
                      <div className="flex items-center gap-1">
                        {[6, 12, 24, 36, 60].map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setSimPrazo(m)}
                            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold transition ${
                              simPrazo === m
                                ? 'bg-[var(--color-primary)] text-white'
                                : 'bg-[var(--color-bg)] text-[var(--color-muted)]'
                            }`}
                          >
                            {m}m
                          </button>
                        ))}
                      </div>
                    </div>
                    <input
                      type="number"
                      min={1}
                      max={360}
                      value={simPrazo}
                      onChange={(e) => setSimPrazo(parseInt(e.target.value) || 1)}
                      className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm font-bold text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-1">
                      Aporte Mensal (R$) <span className="font-normal lowercase">(opcional)</span>
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={100}
                      value={simAporte}
                      onChange={(e) => setSimAporte(parseFloat(e.target.value) || 0)}
                      className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm font-bold text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-hidden"
                    />
                  </div>
                </div>

                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={rodarSimulacao}
                    disabled={simulando}
                    className="rounded-[var(--radius-sm)] bg-[var(--color-primary)] px-5 py-2 text-xs font-bold text-white shadow-xs transition hover:opacity-90 disabled:opacity-50"
                  >
                    {simulando ? 'Calculando...' : 'Recalcular Simulação'}
                  </button>
                </div>
              </div>

              {/* Tabela de Resultados Comparativos */}
              {simResultado && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-[var(--color-muted)]">
                      Total Investido: <strong>{formatCurrency(simResultado.parametros.total_investido)}</strong> · Alíquota IR aplicada: <strong>{simResultado.parametros.aliquota_ir_pct}%</strong>
                    </span>
                    <span className="text-[11px] text-[var(--color-muted)]">
                      Baseado em CDI anual de {simResultado.parametros.cdi_anual_pct}% e Selic de {simResultado.parametros.selic_anual_pct}%
                    </span>
                  </div>

                  <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xs">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-[var(--color-border)] text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                        <tr>
                          <th className="py-3 px-4">Produto / Título</th>
                          <th className="py-3 px-3">Taxa / Condição</th>
                          <th className="py-3 px-3 text-right">Saldo Bruto</th>
                          <th className="py-3 px-3 text-right">Imposto (IR)</th>
                          <th className="py-3 px-3 text-right font-bold text-[var(--color-primary)]">Saldo Líquido</th>
                          <th className="py-3 px-3 text-right">Lucro Líquido</th>
                          <th className="py-3 px-3 text-right">Rentab. Total</th>
                          <th className="py-3 px-4">Equivalência</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--color-border)]/60">
                        {simResultado.resultados.map((res, idx) => (
                          <tr
                            key={res.nome}
                            className={`transition ${idx === 0 ? 'bg-emerald-50/50 dark:bg-emerald-950/20 font-medium' : 'hover:bg-[var(--color-bg)]/40'}`}
                          >
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                {idx === 0 && (
                                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-white">
                                    1º
                                  </span>
                                )}
                                <span className="font-bold text-[var(--color-text)]">{res.nome}</span>
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              <span
                                className="rounded px-2 py-0.5 text-[10px] font-semibold"
                                style={{
                                  backgroundColor: `${res.cor}18`,
                                  color: res.cor,
                                }}
                              >
                                {res.taxa_desc}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right font-semibold text-[var(--color-text)]">
                              {formatCurrency(res.saldo_bruto)}
                            </td>
                            <td className="py-3 px-3 text-right">
                              {res.isento_ir ? (
                                <span className="rounded-full bg-emerald-100 dark:bg-emerald-950/40 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                                  Isento
                                </span>
                              ) : (
                                <span className="text-rose-600 dark:text-rose-400">
                                  -{formatCurrency(res.imposto_renda)}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-right text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
                              {formatCurrency(res.saldo_liquido)}
                            </td>
                            <td className="py-3 px-3 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                              +{formatCurrency(res.rendimento_liquido)}
                            </td>
                            <td className="py-3 px-3 text-right font-bold text-[var(--color-text)]">
                              +{res.rentabilidade_pct}%
                            </td>
                            <td className="py-3 px-4 text-[11px] text-[var(--color-muted)]">
                              {res.equivalente_cdb_pct_cdi ? (
                                <span className="font-semibold text-sky-600 dark:text-sky-400">
                                  ≈ CDB {res.equivalente_cdb_pct_cdi}% CDI
                                </span>
                              ) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: BDRS & ETFS */}
          {tab === 'bdrs_etfs' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {(data?.bdrs_etfs || []).map((item) => (
                  <TickerCard
                    key={item.symbol}
                    item={item}
                    onSelect={(sel) => abrirDetalheAtivo(sel.symbol, sel)}
                  />
                ))}
              </div>
              {(data?.bdrs_etfs || []).length === 0 && !loading && (
                <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] p-8 text-center text-xs text-[var(--color-muted)]">
                  Nenhum BDR ou ETF carregado.
                </div>
              )}
            </div>
          )}

          {/* TAB 6: CÂMBIO & COMMODITIES */}
          {tab === 'cambio' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {(data?.fx || []).map((item) => (
                  <TickerCard key={item.symbol} item={item} />
                ))}
              </div>
              {(data?.fx || []).length === 0 && !loading && (
                <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] p-8 text-center text-xs text-[var(--color-muted)]">
                  Nenhum par de moedas ou commodity encontrado.
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* MODAL DE DETALHES COMPLETOS DO ATIVO / COTAÇÃO */}
      {modalOpen && selectedAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="relative w-full max-w-lg overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl animate-in zoom-in-95 duration-150">
            {/* Header Modal */}
            <div className="flex items-start justify-between border-b border-[var(--color-border)] p-5">
              <div className="flex items-center gap-3">
                {selectedAsset.logo ? (
                  <img
                    src={selectedAsset.logo}
                    alt={selectedAsset.symbol}
                    className="h-12 w-12 rounded-xl border border-[var(--color-border)] bg-white object-contain p-1 shadow-xs"
                    onError={(e) => {
                      ;(e.currentTarget as HTMLElement).style.display = 'none'
                    }}
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-primary)]/10 font-bold text-base text-[var(--color-primary)]">
                    {selectedAsset.symbol?.slice(0, 4)}
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-extrabold text-[var(--color-text)]">
                      {selectedAsset.symbol}
                    </h3>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(selectedAsset.symbol)
                        setModalCopied(true)
                        setTimeout(() => setModalCopied(false), 2000)
                      }}
                      className="rounded p-1 text-[var(--color-muted)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)] transition"
                      title="Copiar ticker"
                    >
                      {modalCopied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                  <p className="text-xs text-[var(--color-muted)] max-w-[280px] truncate" title={selectedAsset.name}>
                    {selectedAsset.name}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-full p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)] transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Conteúdo do Modal */}
            <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              {loadingQuote && (
                <div className="flex items-center gap-2 rounded-md bg-[var(--color-bg)] p-2.5 text-xs text-[var(--color-muted)]">
                  <Loader2 className="h-4 w-4 animate-spin text-[var(--color-primary)]" />
                  Obtendo métricas financeiras atualizadas na B3...
                </div>
              )}

              {/* Preço & Variação */}
              <div className="flex items-baseline justify-between rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)]/50 p-4">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)] block">
                    Cotação Atual
                  </span>
                  <span className="text-2xl font-black text-[var(--color-text)]">
                    {formatCurrency(selectedAsset.price)}
                  </span>
                </div>
                <div className="text-right">
                  <ChangeBadge value={selectedAsset.change_percent ?? null} />
                  {selectedAsset.change !== undefined && selectedAsset.change !== null && (
                    <span className="block mt-1 text-xs font-semibold text-[var(--color-muted)]">
                      {selectedAsset.change >= 0 ? '+' : ''}{formatCurrency(selectedAsset.change)}
                    </span>
                  )}
                </div>
              </div>

              {/* 52w Range */}
              {selectedAsset.min_52w && selectedAsset.max_52w && selectedAsset.price && (
                <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] p-3.5">
                  <div className="flex justify-between text-xs font-semibold text-[var(--color-muted)]">
                    <span>Mínima 52s: {formatCurrency(selectedAsset.min_52w)}</span>
                    <span>Máxima 52s: {formatCurrency(selectedAsset.max_52w)}</span>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[var(--color-bg)]">
                    <div
                      className="h-full rounded-full bg-[var(--color-primary)]"
                      style={{
                        width: `${Math.max(
                          5,
                          Math.min(
                            100,
                            ((selectedAsset.price - selectedAsset.min_52w) /
                              (selectedAsset.max_52w - selectedAsset.min_52w)) *
                              100
                          )
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Grid de Indicadores Fundamentais */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {selectedAsset.pl !== undefined && selectedAsset.pl !== null && (
                  <div className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] p-2.5">
                    <span className="text-[10px] font-semibold uppercase text-[var(--color-muted)] block">
                      P/L (Preço/Lucro)
                    </span>
                    <span className="text-sm font-bold text-[var(--color-text)]">
                      {formatNumber(selectedAsset.pl, 2)}
                    </span>
                  </div>
                )}
                {selectedAsset.lpa !== undefined && selectedAsset.lpa !== null && (
                  <div className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] p-2.5">
                    <span className="text-[10px] font-semibold uppercase text-[var(--color-muted)] block">
                      LPA (Lucro por Ação)
                    </span>
                    <span className="text-sm font-bold text-[var(--color-text)]">
                      {formatCurrency(selectedAsset.lpa)}
                    </span>
                  </div>
                )}
                {selectedAsset.volume && (
                  <div className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] p-2.5">
                    <span className="text-[10px] font-semibold uppercase text-[var(--color-muted)] block">
                      Volume Diário
                    </span>
                    <span className="text-sm font-bold text-[var(--color-text)]">
                      {(selectedAsset.volume / 1000000).toFixed(2)}M
                    </span>
                  </div>
                )}
                {selectedAsset.market_cap && (
                  <div className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] p-2.5 col-span-2">
                    <span className="text-[10px] font-semibold uppercase text-[var(--color-muted)] block">
                      Valor de Mercado
                    </span>
                    <span className="text-sm font-bold text-[var(--color-text)]">
                      {formatMarketCap(selectedAsset.market_cap)}
                    </span>
                  </div>
                )}
              </div>

              {/* Setor e Detalhes */}
              {(selectedAsset.sector || selectedAsset.subsector) && (
                <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)]/30 p-3 text-xs">
                  <span className="font-semibold text-[var(--color-muted)] block mb-1">Segmento B3:</span>
                  <p className="text-[var(--color-text)] font-medium">
                    {selectedAsset.sector} {selectedAsset.subsector ? `· ${selectedAsset.subsector}` : ''}
                  </p>
                </div>
              )}
            </div>

            {/* Footer Modal */}
            <div className="flex items-center justify-end gap-2 border-t border-[var(--color-border)] bg-[var(--color-bg)]/30 p-4">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-xs font-semibold text-[var(--color-text)] hover:bg-[var(--color-bg)] transition"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

