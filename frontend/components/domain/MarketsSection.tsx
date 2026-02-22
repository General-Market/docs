'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'

const API_URL = process.env.NEXT_PUBLIC_API_URL || ''
const STORAGE_KEY = 'gm-markets-collapsed'

/**
 * Market type configuration — sources & emoji are static,
 * name/description/updateFreq come from translation files.
 */
const MARKET_TYPE_CONFIG: Record<string, {
  emoji: string
  sources: string[]
}> = {
  crypto: { emoji: '₿', sources: ['coingecko'] },
  stocks: { emoji: '📈', sources: ['finnhub'] },
  weather: { emoji: '🌡️', sources: ['openmeteo'] },
  economic: { emoji: '📊', sources: ['fred', 'bls'] },
  fx: { emoji: '💱', sources: ['ecb'] },
  treasury: { emoji: '🏛️', sources: ['treasury'] },
  defi: { emoji: '🔗', sources: ['defillama'] },
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
  const t = useTranslations('markets')
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
      const typeConfig = MARKET_TYPE_CONFIG[expandedType]
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
      <section id="markets" className="border border-border-light bg-card rounded-xl shadow-card" aria-labelledby="markets-heading">
        <button className="w-full flex justify-between items-center p-4 text-left" disabled>
          <h2 id="markets-heading" className="text-lg font-bold text-text-primary">
            {t('heading')}
          </h2>
          <span className="text-text-muted">▾</span>
        </button>
      </section>
    )
  }

  const activeCategories = categoriesData?.categories?.filter(c => c.isActive) || []

  // Map categories to market types
  const activeTypes = Object.entries(MARKET_TYPE_CONFIG).filter(([_, config]) => {
    return config.sources.some(source =>
      activeCategories.some(cat => cat.sources.includes(source))
    )
  })

  return (
    <section id="markets" className="border border-border-light bg-card rounded-xl shadow-card" aria-labelledby="markets-heading">
      {/* Header - toggle */}
      <button
        type="button"
        className="w-full flex justify-between items-center p-4 text-left hover:bg-card-hover transition-colors rounded-t-xl"
        onClick={toggleCollapsed}
        aria-expanded={!isCollapsed}
        aria-controls="markets-content"
      >
        <h2 id="markets-heading" className="text-lg font-bold text-text-primary">
          {t('heading')}
        </h2>
        <div className="flex items-center gap-3">
          <span className="text-text-muted text-sm">
            {t('summary.types_count', { count: activeTypes.length })} • {t('summary.categories_count', { count: activeCategories.length })}
          </span>
          <span className="text-text-muted text-xl" aria-hidden="true">
            {isCollapsed ? '▸' : '▾'}
          </span>
        </div>
      </button>

      {/* Content */}
      {!isCollapsed && (
        <div id="markets-content" className="border-t border-border-light">
          {/* Market type grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-border-light">
            {activeTypes.map(([typeId, config]) => {
              const isExpanded = expandedType === typeId
              const relatedCategories = activeCategories.filter(cat =>
                config.sources.some(s => cat.sources.includes(s))
              )

              return (
                <div
                  key={typeId}
                  className="bg-card p-4"
                >
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => setExpandedType(isExpanded ? null : typeId)}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-2xl">{config.emoji}</span>
                      <div className="flex-1">
                        <h3 className="text-text-primary font-bold">{t(`types.${typeId}.name`)}</h3>
                        <p className="text-text-muted text-xs">{t(`types.${typeId}.description`)}</p>
                      </div>
                      <span className="text-text-muted text-sm" aria-hidden="true">
                        {isExpanded ? '▾' : '▸'}
                      </span>
                    </div>

                    {/* Update frequency badge */}
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-text-muted">{t('labels.updates')}</span>
                      <span className="text-zinc-900">{t(`types.${typeId}.update_freq`)}</span>
                    </div>
                  </button>

                  {/* Expanded view with sample prices */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-border-light">
                      {/* Categories in this type */}
                      <div className="mb-3">
                        <p className="text-text-muted text-xs mb-1">{t('labels.categories')}</p>
                        <div className="flex flex-wrap gap-1">
                          {relatedCategories.map(cat => (
                            <span
                              key={cat.id}
                              className="px-2 py-0.5 bg-muted text-text-muted text-xs rounded"
                            >
                              {cat.emoji} {cat.name}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Sample prices */}
                      {pricesData?.prices && pricesData.prices.length > 0 ? (
                        <div>
                          <p className="text-text-muted text-xs mb-1">{t('labels.sample_assets')}</p>
                          <div className="space-y-1">
                            {pricesData.prices.slice(0, 3).map(price => (
                              <div
                                key={price.assetId}
                                className="flex justify-between items-center text-xs font-mono"
                              >
                                <span className="text-text-secondary">{price.symbol}</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-text-primary">
                                    ${parseFloat(price.value).toLocaleString(undefined, {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}
                                  </span>
                                  {price.changePct && (
                                    <span className={parseFloat(price.changePct) >= 0 ? 'text-color-up' : 'text-color-down'}>
                                      {parseFloat(price.changePct) >= 0 ? '+' : ''}{parseFloat(price.changePct).toFixed(2)}%
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="text-text-muted text-xs">{t('labels.loading_prices')}</p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Footer with data freshness */}
          <div className="p-4 border-t border-border-light text-center">
            <p className="text-text-muted text-xs">
              {t('footer.data_sources')}
            </p>
            <p className="text-text-muted text-xs mt-1">
              {t('footer.resolution_note')}
            </p>
          </div>
        </div>
      )}
    </section>
  )
}
