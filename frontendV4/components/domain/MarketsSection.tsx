'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'

const API_URL = process.env.NEXT_PUBLIC_API_URL || ''
const STORAGE_KEY = 'agiarena-markets-collapsed'

/**
 * Market type configuration with display info
 * Organized by TYPE (not source) as per user request
 */
const MARKET_TYPES: Record<string, {
  name: string
  emoji: string
  description: string
  sources: string[]
  updateFreq: string
}> = {
  crypto: {
    name: 'Cryptocurrency',
    emoji: '₿',
    description: 'BTC, ETH, SOL and 100+ tokens',
    sources: ['coingecko'],
    updateFreq: '5 min',
  },
  stocks: {
    name: 'US Stocks',
    emoji: '📈',
    description: 'S&P 500, NASDAQ, major indices',
    sources: ['finnhub'],
    updateFreq: '15 min (market hours)',
  },
  weather: {
    name: 'Weather',
    emoji: '🌡️',
    description: 'Temperature, precipitation, wind',
    sources: ['openmeteo'],
    updateFreq: '30 min',
  },
  economic: {
    name: 'Economic Indicators',
    emoji: '📊',
    description: 'Fed rates, CPI, unemployment',
    sources: ['fred', 'bls'],
    updateFreq: 'Daily/Monthly',
  },
  fx: {
    name: 'Foreign Exchange',
    emoji: '💱',
    description: 'EUR/USD, major currency pairs',
    sources: ['ecb'],
    updateFreq: 'Daily',
  },
  treasury: {
    name: 'Treasury Rates',
    emoji: '🏛️',
    description: 'US Treasury yields',
    sources: ['treasury'],
    updateFreq: 'Daily',
  },
  defi: {
    name: 'DeFi TVL',
    emoji: '🔗',
    description: 'Protocol TVL rankings',
    sources: ['defillama'],
    updateFreq: '1 hour',
  },
}

interface CategoryInfo {
  id: string
  name: string
  emoji: string
  sources: string[]
  snapshotFreq: string
  rankingBy: string
  isActive: boolean
}

interface MarketStats {
  source: string
  totalAssets: number
  activeAssets: number
  lastSyncAt: string | null
  oldestPrice: string | null
  newestPrice: string | null
}

interface MarketPrice {
  source: string
  assetId: string
  symbol: string
  name: string
  value: string
  changePct: string | null
  fetchedAt: string
}

/**
 * MarketsSection component
 * Shows tracked market categories with live data from backend
 */
export function MarketsSection() {
  const [isCollapsed, setIsCollapsed] = useState(true)
  const [isHydrated, setIsHydrated] = useState(false)
  const [expandedType, setExpandedType] = useState<string | null>(null)

  // Load collapsed state from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored !== null) {
      setIsCollapsed(stored === 'true')
    }
    setIsHydrated(true)
  }, [])

  const toggleCollapsed = () => {
    const newValue = !isCollapsed
    setIsCollapsed(newValue)
    localStorage.setItem(STORAGE_KEY, String(newValue))
  }

  // Fetch categories from backend
  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/categories`)
      if (!res.ok) throw new Error('Failed to fetch categories')
      return res.json() as Promise<{ categories: CategoryInfo[]; total: number }>
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  // Fetch sample prices for expanded type
  const { data: pricesData } = useQuery({
    queryKey: ['market-prices', expandedType],
    queryFn: async () => {
      if (!expandedType) return null
      const typeConfig = MARKET_TYPES[expandedType]
      if (!typeConfig) return null

      const source = typeConfig.sources[0]
      const res = await fetch(`${API_URL}/api/market-prices?source=${source}&limit=100`)
      if (!res.ok) throw new Error('Failed to fetch prices')
      return res.json() as Promise<{ prices: MarketPrice[] }>
    },
    enabled: !!expandedType,
    staleTime: 60 * 1000, // 1 minute
  })

  // SSR placeholder
  if (!isHydrated) {
    return (
      <section id="markets" className="border border-white/20 bg-terminal" aria-labelledby="markets-heading">
        <button className="w-full flex justify-between items-center p-4 text-left font-mono" disabled>
          <h2 id="markets-heading" className="text-lg font-bold text-white">
            TRACKED MARKETS
          </h2>
          <span className="text-white/40">▾</span>
        </button>
      </section>
    )
  }

  const activeCategories = categoriesData?.categories?.filter(c => c.isActive) || []

  // Map categories to market types
  const activeTypes = Object.entries(MARKET_TYPES).filter(([_, config]) => {
    return config.sources.some(source =>
      activeCategories.some(cat => cat.sources.includes(source))
    )
  })

  return (
    <section id="markets" className="border border-white/20 bg-terminal" aria-labelledby="markets-heading">
      {/* Header - toggle */}
      <button
        type="button"
        className="w-full flex justify-between items-center p-4 text-left font-mono hover:bg-white/5 transition-colors"
        onClick={toggleCollapsed}
        aria-expanded={!isCollapsed}
        aria-controls="markets-content"
      >
        <h2 id="markets-heading" className="text-lg font-bold text-white">
          TRACKED MARKETS
        </h2>
        <div className="flex items-center gap-3">
          <span className="text-white/40 text-sm">
            {activeTypes.length} types • {activeCategories.length} categories
          </span>
          <span className="text-white/40 text-xl" aria-hidden="true">
            {isCollapsed ? '▸' : '▾'}
          </span>
        </div>
      </button>

      {/* Content */}
      {!isCollapsed && (
        <div id="markets-content" className="border-t border-white/10">
          {/* Market type grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-white/10">
            {activeTypes.map(([typeId, config]) => {
              const isExpanded = expandedType === typeId
              const relatedCategories = activeCategories.filter(cat =>
                config.sources.some(s => cat.sources.includes(s))
              )

              return (
                <div
                  key={typeId}
                  className="bg-terminal p-4"
                >
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => setExpandedType(isExpanded ? null : typeId)}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-2xl">{config.emoji}</span>
                      <div className="flex-1">
                        <h3 className="text-white font-mono font-bold">{config.name}</h3>
                        <p className="text-white/40 text-xs font-mono">{config.description}</p>
                      </div>
                      <span className="text-white/30 text-sm" aria-hidden="true">
                        {isExpanded ? '▾' : '▸'}
                      </span>
                    </div>

                    {/* Update frequency badge */}
                    <div className="flex items-center gap-2 text-xs font-mono">
                      <span className="text-white/60">Updates:</span>
                      <span className="text-accent">{config.updateFreq}</span>
                    </div>
                  </button>

                  {/* Expanded view with sample prices */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-white/10">
                      {/* Categories in this type */}
                      <div className="mb-3">
                        <p className="text-white/40 text-xs font-mono mb-1">Categories:</p>
                        <div className="flex flex-wrap gap-1">
                          {relatedCategories.map(cat => (
                            <span
                              key={cat.id}
                              className="px-2 py-0.5 bg-white/5 text-white/60 text-xs font-mono rounded"
                            >
                              {cat.emoji} {cat.name}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Sample prices */}
                      {pricesData?.prices && pricesData.prices.length > 0 ? (
                        <div>
                          <p className="text-white/40 text-xs font-mono mb-1">Sample assets:</p>
                          <div className="space-y-1">
                            {pricesData.prices.slice(0, 3).map(price => (
                              <div
                                key={price.assetId}
                                className="flex justify-between items-center text-xs font-mono"
                              >
                                <span className="text-white/80">{price.symbol}</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-white">
                                    ${parseFloat(price.value).toLocaleString(undefined, {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}
                                  </span>
                                  {price.changePct && (
                                    <span className={parseFloat(price.changePct) >= 0 ? 'text-green-400' : 'text-red-400'}>
                                      {parseFloat(price.changePct) >= 0 ? '+' : ''}{parseFloat(price.changePct).toFixed(2)}%
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="text-white/30 text-xs font-mono">Loading prices...</p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Footer with data freshness */}
          <div className="p-4 border-t border-white/10 text-center">
            <p className="text-white/40 text-xs font-mono">
              Data sourced from CoinGecko, Finnhub, Open-Meteo, FRED, ECB, Treasury, DefiLlama
            </p>
            <p className="text-white/30 text-xs font-mono mt-1">
              All bets resolved using on-chain keeper consensus
            </p>
          </div>
        </div>
      )}
    </section>
  )
}
