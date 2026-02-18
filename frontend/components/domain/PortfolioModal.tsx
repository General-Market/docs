'use client'

import { useEffect, useCallback, useState, useMemo, useRef, ChangeEvent, memo } from 'react'
import {
  parseMarketId,
  getMarketUrl,
  getSourceBadge,
  formatPosition,
  parseWeatherMarketId,
  formatWeatherValue,
  type DataSource,
} from '@/lib/utils/marketId'

export interface PortfolioPosition {
  marketId: string
  marketTitle: string
  position: 'YES' | 'NO'
  currentPrice: number
  confidence?: number
  /** Entry price when bet was placed (0-1) */
  startingPrice?: number
  /** Resolution price set by keeper (0-1) */
  endingPrice?: number
  /** Whether the market has resolved/closed */
  isClosed?: boolean
}

/**
 * Calculate price change between starting and current price
 */
function calculatePositionChange(pos: PortfolioPosition): {
  change: number | null
  direction: 'up' | 'down' | 'neutral' | null
} {
  if (pos.startingPrice == null || pos.currentPrice == null) {
    return { change: null, direction: null }
  }
  const change = pos.currentPrice - pos.startingPrice

  let direction: 'up' | 'down' | 'neutral'
  if (Math.abs(change) < 0.001) {
    direction = 'neutral'
  } else if (pos.position === 'YES') {
    direction = change > 0 ? 'up' : 'down'
  } else {
    // NO position benefits from price going down
    direction = change < 0 ? 'up' : 'down'
  }

  return { change, direction }
}

interface PortfolioModalProps {
  isOpen: boolean
  onClose: () => void
  positions: PortfolioPosition[]
  portfolioSize: number
}

interface PositionRowProps {
  position: PortfolioPosition
}

/**
 * Individual position row - memoized to prevent unnecessary re-renders in virtualized list
 */
const PositionRow = memo(function PositionRow({ position }: PositionRowProps) {
  // Parse market ID to get data source and correct URL
  const parsedMarketId = parseMarketId(position.marketId)
  const marketUrl = getMarketUrl(parsedMarketId)
  const sourceBadge = getSourceBadge(parsedMarketId.dataSource)

  const priceChange = calculatePositionChange(position)
  const changeColor = priceChange.direction === 'up' ? 'text-green-400'
    : priceChange.direction === 'down' ? 'text-red-400'
    : 'text-white/40'

  // Parse weather info once if this is a weather market
  const weatherInfo = parsedMarketId.dataSource === 'openmeteo'
    ? parseWeatherMarketId(parsedMarketId.rawId)
    : null

  const formatPrice = (price: number | undefined | null, dataSource: DataSource): string => {
    if (price == null) return '—'
    // CoinGecko/Stocks prices are in USD, Polymarket prices are 0-1 probabilities
    if (dataSource === 'coingecko' || dataSource === 'stocks') {
      return `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    }
    // Weather values use metric-specific formatting
    if (dataSource === 'openmeteo' && weatherInfo) {
      return formatWeatherValue(price, weatherInfo.metric)
    }
    return `${(price * 100).toFixed(1)}%`
  }

  // Format display title for weather markets
  const displayTitle = weatherInfo
    ? `${weatherInfo.displayCity} - ${weatherInfo.displayMetric}`
    : position.marketTitle

  const formatChange = (change: number | null): string => {
    if (change == null) return '—'
    const sign = change >= 0 ? '+' : ''
    return `${sign}${(change * 100).toFixed(1)}%`
  }

  // Format position label based on data source
  const positionLabel = formatPosition(
    position.position === 'YES' ? 1 : 0,
    parsedMarketId.dataSource
  )

  return (
    <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 hover:bg-white/5 h-[60px]">
      <div className="flex-1 min-w-0 mr-4">
        <div className="flex items-center gap-2">
          <a
            href={marketUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-white hover:text-accent truncate block"
            title={displayTitle}
          >
            {displayTitle}
          </a>
          {/* Source badge */}
          <span
            className={`px-1.5 py-0.5 text-xs font-medium rounded ${sourceBadge.bgColor} ${sourceBadge.textColor}`}
            title={sourceBadge.label}
          >
            {sourceBadge.icon}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/60 font-mono truncate">{parsedMarketId.rawId}</span>
          {position.isClosed && (
            <span className="text-xs text-purple-400 font-mono">Resolved</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Position badge */}
        <span
          className={`
            px-2 py-1 text-xs font-bold font-mono
            ${position.position === 'YES'
              ? 'bg-white text-black'
              : 'bg-accent text-white'
            }
          `}
        >
          {positionLabel}
        </span>

        {/* Entry price */}
        <span className="text-sm font-mono text-white/60 w-14 text-right">
          {formatPrice(position.startingPrice, parsedMarketId.dataSource)}
        </span>

        {/* Current price */}
        <span className="text-sm font-mono text-white w-14 text-right">
          {formatPrice(position.currentPrice, parsedMarketId.dataSource)}
        </span>

        {/* Price change */}
        <span className={`text-sm font-mono w-14 text-right ${changeColor}`}>
          {formatChange(priceChange.change)}
        </span>

        {/* Confidence score if available */}
        {position.confidence !== undefined && (
          <span className="text-xs font-mono text-white/60 w-10 text-right">
            {(position.confidence * 100).toFixed(0)}%
          </span>
        )}
      </div>
    </div>
  )
})

/** Height of each position row in pixels - matches PositionRow component's h-[60px] */
const ROW_HEIGHT = 60
/** Number of rows visible in the viewport at once - provides ~420px viewport height */
const VISIBLE_ROWS = 7
/** Extra rows to render above/below viewport for smooth scrolling */
const BUFFER_ROWS = 3

/**
 * Custom virtualized list for 5K+ positions
 */
function VirtualizedList({ positions }: { positions: PortfolioPosition[] }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop)
  }, [])

  const { startIndex, visibleItems } = useMemo(() => {
    const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - BUFFER_ROWS)
    const end = Math.min(
      positions.length,
      Math.ceil((scrollTop + VISIBLE_ROWS * ROW_HEIGHT) / ROW_HEIGHT) + BUFFER_ROWS
    )
    return {
      startIndex: start,
      endIndex: end,
      visibleItems: positions.slice(start, end)
    }
  }, [scrollTop, positions])

  const totalHeight = positions.length * ROW_HEIGHT

  return (
    <div
      ref={containerRef}
      className="overflow-y-auto"
      style={{ height: VISIBLE_ROWS * ROW_HEIGHT }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ position: 'absolute', top: startIndex * ROW_HEIGHT, width: '100%' }}>
          {visibleItems.map((position, idx) => (
            <PositionRow
              key={`${position.marketId}-${startIndex + idx}`}
              position={position}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

/**
 * Export positions to CSV file
 */
function exportToCSV(positions: PortfolioPosition[], filename: string) {
  const headers = ['Market ID', 'Market Title', 'Position', 'Entry Price', 'Current Price', 'Change', 'Resolved', 'Confidence']

  const formatPrice = (price: number | undefined | null): string => {
    if (price == null) return ''
    return (price * 100).toFixed(2) + '%'
  }

  const rows = positions.map(p => {
    const change = p.startingPrice != null && p.currentPrice != null
      ? (p.currentPrice - p.startingPrice) * 100
      : null

    return [
      p.marketId,
      `"${p.marketTitle.replace(/"/g, '""')}"`,
      p.position,
      formatPrice(p.startingPrice),
      formatPrice(p.currentPrice),
      change != null ? (change >= 0 ? '+' : '') + change.toFixed(2) + '%' : '',
      p.isClosed ? 'Yes' : 'No',
      p.confidence ? (p.confidence * 100).toFixed(0) + '%' : ''
    ]
  })

  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  link.click()
  URL.revokeObjectURL(link.href)
}

/**
 * Position breakdown stats component
 */
function PositionBreakdown({ positions }: { positions: PortfolioPosition[] }) {
  const { yesCount, noCount, yesPercent, noPercent } = useMemo(() => {
    const yes = positions.filter(p => p.position === 'YES').length
    const no = positions.filter(p => p.position === 'NO').length
    const total = positions.length || 1
    return {
      yesCount: yes,
      noCount: no,
      yesPercent: ((yes / total) * 100).toFixed(1),
      noPercent: ((no / total) * 100).toFixed(1)
    }
  }, [positions])

  return (
    <div className="flex items-center gap-4 text-xs font-mono">
      <span className="text-white/60">Position Breakdown:</span>
      <span className="text-white">
        <span className="bg-white text-black px-1 mr-1">YES</span>
        {yesPercent}% ({yesCount.toLocaleString()})
      </span>
      <span className="text-white">
        <span className="bg-accent text-white px-1 mr-1">NO</span>
        {noPercent}% ({noCount.toLocaleString()})
      </span>
    </div>
  )
}

/**
 * Modal component for viewing full portfolio with virtualized list
 * Handles 5K+ positions efficiently with search, filter, and export
 */
/** Debounce delay for search input in milliseconds */
const SEARCH_DEBOUNCE_MS = 300

export function PortfolioModal({ isOpen, onClose, positions, portfolioSize }: PortfolioModalProps) {
  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Debounced search - waits 300ms after typing stops before filtering
  const handleSearchChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setSearchInput(value)

    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = setTimeout(() => {
      setSearchQuery(value)
    }, SEARCH_DEBOUNCE_MS)
  }, [])

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

  // Handle escape key to close
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    },
    [onClose]
  )

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, handleKeyDown])

  // Reset search when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSearchInput('')
      setSearchQuery('')
    }
  }, [isOpen])

  // Filter positions based on search query
  const filteredPositions = useMemo(() => {
    if (!searchQuery.trim()) {
      return positions
    }
    const query = searchQuery.toLowerCase()
    return positions.filter(
      p =>
        p.marketId.toLowerCase().includes(query) ||
        p.marketTitle.toLowerCase().includes(query)
    )
  }, [positions, searchQuery])

  // Handle export
  const handleExport = useCallback(() => {
    const timestamp = new Date().toISOString().split('T')[0]
    exportToCSV(filteredPositions, `portfolio-${timestamp}.csv`)
  }, [filteredPositions])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="portfolio-modal-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal content */}
      <div className="relative bg-black border border-white w-full max-w-3xl max-h-[80vh] mx-4 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/20">
          <div>
            <h2 id="portfolio-modal-title" className="text-xl font-bold text-white font-mono">
              Full Portfolio
            </h2>
            <p className="text-sm text-white/60 font-mono">
              {filteredPositions.length === positions.length
                ? `${portfolioSize.toLocaleString()} market positions`
                : `${filteredPositions.length.toLocaleString()} of ${portfolioSize.toLocaleString()} positions`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white transition-colors p-2"
            aria-label="Close modal"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Search and Actions Bar */}
        <div className="px-6 py-3 border-b border-white/20 space-y-3">
          {/* Search Input */}
          <div className="relative">
            <input
              type="text"
              value={searchInput}
              onChange={handleSearchChange}
              placeholder="Search by market ID or title..."
              className="w-full px-4 py-2 bg-black border border-white/30 text-white font-mono text-sm focus:outline-none focus:border-white placeholder-white/40"
            />
            {searchInput && (
              <button
                onClick={() => { setSearchInput(''); setSearchQuery('') }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>

          {/* Position Breakdown and Export */}
          <div className="flex items-center justify-between">
            <PositionBreakdown positions={filteredPositions} />
            <button
              onClick={handleExport}
              className="px-3 py-1 border border-white/30 text-white/60 text-xs font-mono hover:text-white hover:border-white transition-colors"
            >
              Export to CSV
            </button>
          </div>
        </div>

        {/* Column headers */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-white/20 text-xs text-white/60 font-mono">
          <span className="flex-1">Market</span>
          <div className="flex items-center gap-3">
            <span className="w-12">Position</span>
            <span className="w-14 text-right">Entry</span>
            <span className="w-14 text-right">Current</span>
            <span className="w-14 text-right">Change</span>
            <span className="w-10 text-right">Conf</span>
          </div>
        </div>

        {/* Virtualized list */}
        <div className="flex-1 overflow-hidden">
          {filteredPositions.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-white/40 font-mono">No positions match your search</p>
            </div>
          ) : (
            <VirtualizedList positions={filteredPositions} />
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/20">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-black border border-white text-white hover:bg-white hover:text-black transition-colors font-mono"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
