'use client'

import { useState, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils/cn'

/**
 * Loading messages — reverse absurdity.
 * The conventional world is the weird one. Not us.
 */
const MESSAGES: Record<string, string[]> = {
  markets: [
    'Loading 50,000 things Wall Street forgot to price...',
    'Somewhere, a BestBuy shelf is moving your portfolio.',
    'Assembling markets Bloomberg hasn\'t discovered yet...',
    'Normal people trade two asset types. You chose fourteen.',
    'Your alpha just departed Gate B4.',
    'Preparing assets too interesting for the NYSE.',
  ],
  sources: [
    'Checking if Deutsche Bahn is on time. (It isn\'t.)',
    'Polling flight data. Your edge has a boarding pass.',
    'Connecting to markets your broker has never heard of.',
    'Asking BestBuy what a PS5 costs right now...',
    'Monitoring things your financial advisor cannot explain.',
    '14 categories of things nobody else trades. Loading...',
  ],
  leaderboard: [
    'Ranking people who bet on grocery prices for a living.',
    'Sorting degens by train delay conviction.',
    'The scoreboard of people your parents warned you about.',
    'Who profited most from a Lufthansa delay? Loading...',
    'Tallying wins from markets that shouldn\'t exist. But do.',
    'First place predicted DB delays. Second place went to MIT.',
  ],
  index: [
    'Valuing your basket of 47 tokens nobody else combined.',
    'Your index is one of a kind. Literally. Loading...',
    'Calculating NAV on assets your bank doesn\'t recognize.',
    'Your custom crypto ETF loads. BlackRock did not ask for this.',
    'Finding the price of your bespoke financial experiment.',
    'Traditional funds hold 30 stocks. Yours holds 200 tokens.',
  ],
  default: [
    'Loading markets too interesting for TradFi...',
    'Preparing your advantage over people who trade normally.',
    'Your portfolio of beautiful absurdities is almost ready.',
    'The only protocol that prices train delays. One moment.',
    'Fetching data from 14 categories of financial rebellion.',
    'Almost there. Normal exchanges only needed two asset types.',
  ],
}

/** Bullish mini-chart path — loading screens should be optimistic */
const CHART_PATH = 'M0,22 L10,20 L18,24 L26,16 L34,18 L42,12 L50,14 L58,8 L66,11 L74,6 L82,9 L90,4 L98,7 L106,3 L114,5'

interface VisionLoaderProps {
  /** Context selects the message pool */
  context?: string
  className?: string
  /** Compact mode for inline sections (leaderboard rows, tables) */
  compact?: boolean
}

export function VisionLoader({ context = 'default', className, compact = false }: VisionLoaderProps) {
  const pool = MESSAGES[context] || MESSAGES.default
  const [idx, setIdx] = useState(() => Math.floor(Math.random() * pool.length))
  const [visible, setVisible] = useState(true)
  const reducedMotion = useRef(false)

  useEffect(() => {
    reducedMotion.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }, [])

  // Cycle messages every 3.5s with a fade transition
  useEffect(() => {
    const iv = setInterval(() => {
      setVisible(false)
      setTimeout(() => {
        setIdx(prev => (prev + 1) % pool.length)
        setVisible(true)
      }, 280)
    }, 3500)
    return () => clearInterval(iv)
  }, [pool.length])

  if (compact) {
    return (
      <div className={cn('flex items-center justify-center py-6', className)}>
        <div className="flex items-center gap-3">
          <svg
            width="48"
            height="12"
            viewBox="0 0 120 28"
            className="vision-loader-chart"
            aria-hidden="true"
          >
            <path
              d={CHART_PATH}
              fill="none"
              stroke="var(--brand)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span
            className={cn(
              'font-mono text-[12px] text-text-muted transition-opacity duration-300',
              visible ? 'opacity-100' : 'opacity-0'
            )}
          >
            {pool[idx]}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('flex items-center justify-center py-20', className)}>
      <div className="flex flex-col items-center gap-5">
        {/* Animated mini-chart line */}
        <div className="relative">
          <svg
            width="120"
            height="28"
            viewBox="0 0 120 28"
            className="vision-loader-chart"
            aria-hidden="true"
          >
            {/* Glow layer */}
            <path
              d={CHART_PATH}
              fill="none"
              stroke="var(--brand)"
              strokeWidth="6"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="vision-loader-glow"
            />
            {/* Main line */}
            <path
              d={CHART_PATH}
              fill="none"
              stroke="var(--brand)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        {/* Cycling message */}
        <p
          className={cn(
            'font-mono text-[13px] text-text-muted text-center max-w-[360px] h-[20px] transition-opacity duration-300',
            visible ? 'opacity-100' : 'opacity-0'
          )}
        >
          {pool[idx]}
        </p>
      </div>
    </div>
  )
}
