'use client'

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { springs } from '@/components/ui/spring'
import { useMarketSearch, type SearchMarket } from '@/hooks/vision/useMarketSearch'
import { useMarketSnapshotMeta } from '@/hooks/vision/useMarketSnapshot'

const SUGGESTIONS = [
  {
    icon: '📈',
    title: 'Trending markets',
    subtitle: 'See what\'s moving',
    query: 'bitcoin',
    filter: 'trending',
  },
  {
    icon: '⚡',
    title: 'Expiring soon',
    subtitle: 'Closing within 24h',
    query: 'eth',
    filter: 'expiring',
  },
  {
    icon: '🎯',
    title: 'Highest volume',
    subtitle: 'Most traded today',
    query: 'sol',
    filter: 'volume',
  },
  {
    icon: '🌍',
    title: 'New sources',
    subtitle: 'Recently added',
    query: 'weather',
    filter: 'new',
  },
] as const

function formatValue(v: string | null): string {
  if (!v) return '—'
  const n = parseFloat(v)
  if (isNaN(n)) return v
  if (n >= 1_000_000_000) return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1_000_000) return `$${(n / 1e6).toFixed(2)}M`
  if (n >= 1_000) return `$${(n / 1e3).toFixed(1)}K`
  if (n >= 1) return `$${n.toFixed(2)}`
  if (n >= 0.01) return `$${n.toFixed(4)}`
  return `$${n.toFixed(6)}`
}

function formatChange(pct: string | null): { text: string; color: string } {
  if (!pct) return { text: '—', color: 'text-zinc-400' }
  const n = parseFloat(pct)
  if (isNaN(n)) return { text: pct, color: 'text-zinc-400' }
  const sign = n >= 0 ? '+' : ''
  return {
    text: `${sign}${n.toFixed(2)}%`,
    color: n > 0 ? 'text-emerald-500' : n < 0 ? 'text-red-500' : 'text-zinc-400',
  }
}

function MarketIcon({ market }: { market: SearchMarket }) {
  const [imgErr, setImgErr] = useState(false)
  const letter = (market.symbol || market.name || '?')[0].toUpperCase()

  if (market.imageUrl && !imgErr) {
    return (
      <img
        src={market.imageUrl}
        alt=""
        className="w-7 h-7 rounded-full shrink-0 object-cover bg-zinc-100"
        loading="lazy"
        onError={() => setImgErr(true)}
      />
    )
  }

  return (
    <div className="w-7 h-7 rounded-full bg-zinc-200 shrink-0 flex items-center justify-center text-[10px] font-bold text-zinc-500">
      {letter}
    </div>
  )
}

function ResultRow({ market, onClick }: { market: SearchMarket; onClick: () => void }) {
  const change = formatChange(market.changePct)
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-zinc-50 transition-colors text-left"
    >
      <MarketIcon market={market} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold text-black truncate">{market.symbol}</span>
          <span className="text-[11px] text-zinc-400 truncate">{market.name}</span>
        </div>
        <span className="text-[11px] text-zinc-400">{market.source}</span>
      </div>
      <div className="text-right shrink-0">
        <div className="text-[13px] font-mono font-medium text-black tabular-nums">
          {formatValue(market.value)}
        </div>
        <div className={`text-[11px] font-mono tabular-nums ${change.color}`}>
          {change.text}
        </div>
      </div>
    </button>
  )
}

export function WelcomeHero() {
  const [query, setQuery] = useState('')
  const [showResults, setShowResults] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const heroRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [isSticky, setIsSticky] = useState(false)

  const { results, loading, total } = useMarketSearch(query)
  const { data: meta } = useMarketSnapshotMeta()
  const reduced = useReducedMotion()

  const assetCount = meta?.totalAssets ?? 0
  const placeholder = assetCount > 0
    ? `Search through ${assetCount.toLocaleString()} liquid prediction markets...`
    : 'Search through 300,000+ liquid prediction markets...'

  // Track when hero scrolls out of view
  useEffect(() => {
    const hero = heroRef.current
    if (!hero) return
    const observer = new IntersectionObserver(
      ([entry]) => setIsSticky(!entry.isIntersecting),
      { threshold: 0, rootMargin: '-80px 0px 0px 0px' }
    )
    observer.observe(hero)
    return () => observer.disconnect()
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowResults(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Focus search on / key
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const tag = (e.target as HTMLElement)?.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [])

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value)
    setShowResults(true)
  }, [])

  const handleSuggestion = useCallback((suggestion: typeof SUGGESTIONS[number]) => {
    setQuery(suggestion.query)
    setShowResults(true)
    inputRef.current?.focus()
  }, [])

  const handleSelectMarket = useCallback((market: SearchMarket) => {
    // Navigate to source detail page for this market
    window.location.href = `/source/${market.source}`
    setShowResults(false)
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (results.length > 0) {
      handleSelectMarket(results[0])
    }
  }

  const hasResults = query.trim().length > 0 && (results.length > 0 || loading)

  return (
    <>
      {/* Hero section */}
      <div ref={heroRef} className="flex flex-col items-center justify-center px-6 pt-20 pb-10 sm:pt-28 sm:pb-14">
        <motion.h1
          initial={reduced ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={springs.page}
          className="text-[clamp(2.5rem,6vw,4rem)] font-black tracking-[-0.04em] text-black leading-[1.05] text-center"
        >
          Welcome back
        </motion.h1>

        <motion.p
          initial={reduced ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springs.page, delay: 0.06 }}
          className="mt-3 text-[17px] text-zinc-500 text-center"
        >
          What would you like to trade?
        </motion.p>

        {/* Suggestion cards — staggered spring entrance, spring hover + press */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-10 w-full max-w-[720px]">
          {SUGGESTIONS.map((s, i) => (
            <motion.button
              key={s.filter}
              initial={reduced ? false : { opacity: 0, y: 18, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ ...springs.entrance, delay: 0.1 + i * 0.06 }}
              whileHover={reduced ? undefined : {
                y: -3,
                boxShadow: '0 8px 24px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.04)',
              }}
              whileTap={reduced ? undefined : { scale: 0.97 }}
              onClick={() => handleSuggestion(s)}
              className="group text-left p-4 rounded-xl border border-zinc-200 bg-white hover:border-zinc-400 transition-colors"
            >
              <div className="text-base mb-1.5">{s.icon}</div>
              <div className="text-[13px] font-semibold text-black leading-snug">
                {s.title}
              </div>
              <div className="text-[12px] text-zinc-400 mt-0.5 leading-snug">
                {s.subtitle}
              </div>
            </motion.button>
          ))}
        </div>

        {/* Search bar with autocomplete */}
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springs.entrance, delay: 0.36 }}
          className="mt-10 w-full max-w-[720px] relative"
          ref={dropdownRef}
        >
          <form onSubmit={handleSubmit}>
            <div className="relative">
              <svg className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={handleInputChange}
                onFocus={() => query.trim() && setShowResults(true)}
                placeholder={placeholder}
                className="w-full h-[52px] pl-11 pr-12 rounded-xl border border-zinc-200 bg-white text-[15px] text-black placeholder:text-zinc-400 focus:outline-none focus:border-zinc-400 focus:shadow-[0_0_0_3px_rgba(0,0,0,0.04)] transition-all duration-200"
              />
              {loading && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  <div className="w-4 h-4 border-2 border-zinc-300 border-t-zinc-600 rounded-full animate-spin" />
                </div>
              )}
            </div>
          </form>

          {/* Autocomplete dropdown */}
          <AnimatePresence>
            {showResults && hasResults && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.97 }}
                transition={springs.entrance}
                className="absolute top-full mt-1.5 left-0 right-0 bg-white rounded-xl border border-zinc-200 shadow-lg overflow-hidden z-50"
              >
                <div className="max-h-[360px] overflow-y-auto py-1">
                  {results.map((market) => (
                    <ResultRow
                      key={market.assetId}
                      market={market}
                      onClick={() => handleSelectMarket(market)}
                    />
                  ))}
                </div>
                {!loading && total > results.length && (
                  <div className="px-4 py-2 border-t border-zinc-100 text-[11px] text-zinc-400">
                    {total.toLocaleString()} markets found
                  </div>
                )}
                {loading && results.length === 0 && (
                  <div className="px-4 py-6 text-center">
                    <div className="w-5 h-5 border-2 border-zinc-300 border-t-zinc-600 rounded-full animate-spin mx-auto" />
                    <p className="text-[12px] text-zinc-400 mt-2">Searching markets...</p>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* No results state */}
          <AnimatePresence>
            {showResults && query.trim().length > 0 && !loading && results.length === 0 && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.97 }}
                transition={springs.entrance}
                className="absolute top-full mt-1.5 left-0 right-0 bg-white rounded-xl border border-zinc-200 shadow-lg px-4 py-5 text-center z-50"
              >
                <p className="text-[13px] text-zinc-500">No markets found for &ldquo;{query}&rdquo;</p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* How it works link */}
        <motion.div
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ ...springs.page, delay: 0.5 }}
          className="mt-5"
        >
          <a
            href="https://docs.generalmarket.io"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-zinc-400 underline underline-offset-2 hover:text-zinc-600 transition-colors"
          >
            How it works
          </a>
        </motion.div>
      </div>

      {/* Sticky search bar — appears when hero scrolls away */}
      <div
        className={`fixed top-[60px] sm:top-[64px] left-0 right-0 z-40 transition-all duration-300 ${
          isSticky
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 -translate-y-2 pointer-events-none'
        }`}
      >
        <div className="bg-white/80 backdrop-blur-xl border-b border-zinc-200/60">
          <div className="max-w-[720px] mx-auto px-4 py-2.5 relative">
            <form onSubmit={handleSubmit}>
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  value={query}
                  onChange={handleInputChange}
                  onFocus={() => query.trim() && setShowResults(true)}
                  placeholder="Search markets, sources, predictions..."
                  className="w-full h-[40px] pl-9 pr-10 rounded-lg border border-zinc-200 bg-white/90 text-[14px] text-black placeholder:text-zinc-400 focus:outline-none focus:border-zinc-400 transition-all duration-200"
                />
                {loading && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="w-3.5 h-3.5 border-2 border-zinc-300 border-t-zinc-600 rounded-full animate-spin" />
                  </div>
                )}
              </div>
            </form>

            {/* Sticky autocomplete dropdown */}
            <AnimatePresence>
              {isSticky && showResults && hasResults && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.97 }}
                  transition={springs.entrance}
                  className="absolute top-full left-4 right-4 mt-1 bg-white rounded-xl border border-zinc-200 shadow-lg overflow-hidden z-50"
                >
                  <div className="max-h-[320px] overflow-y-auto py-1">
                    {results.map((market) => (
                      <ResultRow
                        key={market.assetId}
                        market={market}
                        onClick={() => handleSelectMarket(market)}
                      />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </>
  )
}
