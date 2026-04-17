'use client'

import { useState, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils/cn'

/**
 * Loading messages, reverse absurdity.
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

/** Rotating message line */
function LoaderCaption({ context = 'default', className }: { context?: string; className?: string }) {
  const pool = MESSAGES[context] || MESSAGES.default
  const [idx, setIdx] = useState(0)
  const [visible, setVisible] = useState(true)

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

  return (
    <p className={cn(
      'font-mono text-[12px] text-text-muted transition-opacity duration-300 h-[18px]',
      visible ? 'opacity-100' : 'opacity-0',
      className
    )}>
      {pool[idx]}
    </p>
  )
}

/** Shimmer bar, the basic building block */
export function Shimmer({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={cn('skeleton rounded', className)} style={style} aria-hidden="true" />
}

/* ═══════════════════════════════════════════════════════════════════
 * VARIANT: Batch cards grid, mimics BatchCard layout
 * ═══════════════════════════════════════════════════════════════════ */
export function BatchCardsSkeleton() {
  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="bg-card border border-border-light rounded-card p-4"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            {/* Thumbnail area */}
            <Shimmer className="w-full h-28 mb-3 !rounded" />
            {/* Title */}
            <Shimmer className="h-[14px] w-3/5 mb-2" />
            {/* Creator address */}
            <Shimmer className="h-[11px] w-2/5 mb-3" />
            {/* Stats row */}
            <div className="flex gap-3">
              <Shimmer className="h-[11px] w-16" />
              <Shimmer className="h-[11px] w-12" />
              <Shimmer className="h-[11px] w-14" />
              <Shimmer className="h-[11px] w-16" />
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-center mt-8">
        <LoaderCaption context="markets" />
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════
 * VARIANT: Source cards grid, mimics SourceCard layout
 * ═══════════════════════════════════════════════════════════════════ */
export function SourceCardsSkeleton() {
  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 border border-border-light">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="bg-white border-r border-b border-border-light overflow-hidden"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            {/* Brand area, aspect-video */}
            <Shimmer className="aspect-video w-full !rounded-none" />
            {/* Content */}
            <div className="px-5 pt-4 pb-0">
              <div className="flex justify-between items-start mb-1">
                <div className="flex-1 mr-2">
                  <Shimmer className="h-[16px] w-3/4 mb-2" />
                  <Shimmer className="h-[11px] w-full mb-1" />
                  <Shimmer className="h-[11px] w-2/3" />
                </div>
                <Shimmer className="h-[14px] w-12 shrink-0" />
              </div>
              {/* Metrics row */}
              <div className="grid grid-cols-3 border-t border-b border-border-light -mx-5 px-5 mt-3">
                {[0, 1, 2].map(j => (
                  <div key={j} className={cn('py-2.5', j > 0 && 'pl-3 border-l border-border-light')}>
                    <Shimmer className="h-[10px] w-14 mb-1.5" />
                    <Shimmer className="h-[14px] w-10" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-center mt-6">
        <LoaderCaption context="sources" />
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════
 * VARIANT: ITP fund table, mimics ItpListing table rows
 * ═══════════════════════════════════════════════════════════════════ */
export function ItpTableSkeleton() {
  return (
    <div>
      {/* Table header skeleton */}
      <div className="border-b-[3px] border-black flex items-center py-3 px-4 gap-4">
        <Shimmer className="h-[11px] w-14" />
        <Shimmer className="h-[11px] w-32 flex-1" />
        <Shimmer className="h-[11px] w-16" />
        <Shimmer className="h-[11px] w-20" />
        <Shimmer className="h-[11px] w-24" />
        <Shimmer className="h-[11px] w-16" />
      </div>
      {/* Rows */}
      {Array.from({ length: 10 }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'flex items-center py-3 px-4 gap-4 border-b border-[#eee]',
            i % 2 === 1 ? 'bg-[#fafafa]' : 'bg-white'
          )}
          style={{ animationDelay: `${i * 50}ms` }}
        >
          {/* Ticker */}
          <Shimmer className="h-[13px] w-12" />
          {/* Name */}
          <div className="flex-1">
            <Shimmer className="h-[13px] w-44 mb-1" />
            <Shimmer className="h-[11px] w-20" style={{ opacity: i % 3 === 0 ? 1 : 0 }} />
          </div>
          {/* Chart icon */}
          <Shimmer className="h-[16px] w-[16px] !rounded-sm" />
          {/* NAV */}
          <Shimmer className="h-[13px] w-16" />
          {/* Net Assets */}
          <Shimmer className="h-[13px] w-20" />
          {/* Shares */}
          <Shimmer className="h-[13px] w-24" />
          {/* Trade buttons */}
          <div className="flex items-center gap-2">
            <Shimmer className="h-[11px] w-8" />
            <Shimmer className="h-[11px] w-8" />
          </div>
        </div>
      ))}
      <div className="flex justify-center mt-8">
        <LoaderCaption context="index" />
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════
 * VARIANT: Leaderboard table, mimics VisionLeaderboard rows
 * ═══════════════════════════════════════════════════════════════════ */
export function LeaderboardSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="py-6">
      {/* Header */}
      <div className="flex items-center gap-4 pb-3 border-b border-border-medium">
        <Shimmer className="h-[10px] w-6" />
        <Shimmer className="h-[10px] w-24" />
        <div className="flex-1" />
        <Shimmer className="h-[10px] w-16" />
        <Shimmer className="h-[10px] w-12" />
        <Shimmer className="h-[10px] w-14" />
        <Shimmer className="h-[10px] w-14" />
        <Shimmer className="h-[10px] w-14" />
        <Shimmer className="h-[10px] w-16" />
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 py-3 border-b border-border-light"
          style={{ animationDelay: `${i * 60}ms` }}
        >
          <Shimmer className="h-[12px] w-6" />
          <Shimmer className="h-[12px] w-28" />
          <div className="flex-1" />
          <Shimmer className="h-[12px] w-16" />
          <Shimmer className="h-[12px] w-12" />
          <Shimmer className="h-[12px] w-10" />
          <Shimmer className="h-[12px] w-12" />
          <Shimmer className="h-[12px] w-12" />
          <Shimmer className="h-[12px] w-16" />
        </div>
      ))}
      <div className="flex justify-center mt-4">
        <LoaderCaption context="leaderboard" />
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════
 * VARIANT: Top Players compact, mimics TopPlayers grid layout
 * ═══════════════════════════════════════════════════════════════════ */
export function TopPlayersSkeleton() {
  return (
    <div className="bg-white border border-t-0 border-border-light overflow-hidden">
      {/* Header row */}
      <div className="grid grid-cols-[36px_1fr_60px_70px_80px_90px] items-center px-4 py-2 border-b border-border-light">
        <Shimmer className="h-[10px] w-5" />
        <Shimmer className="h-[10px] w-16" />
        <Shimmer className="h-[10px] w-12 ml-auto" />
        <Shimmer className="h-[10px] w-12 ml-auto" />
        <Shimmer className="h-[10px] w-16 ml-auto" />
        <Shimmer className="h-[10px] w-14 ml-auto" />
      </div>
      {/* 5 rows */}
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'grid grid-cols-[36px_1fr_60px_70px_80px_90px] items-center px-4 py-2.5 border-b border-border-light',
            i % 2 === 1 ? 'bg-surface/40' : ''
          )}
          style={{ animationDelay: `${i * 70}ms` }}
        >
          <Shimmer className="h-[13px] w-4" />
          <Shimmer className="h-[12px] w-24" />
          <Shimmer className="h-[12px] w-8 ml-auto" />
          <Shimmer className="h-[12px] w-12 ml-auto" />
          <Shimmer className="h-[12px] w-10 ml-auto" />
          <Shimmer className="h-[12px] w-14 ml-auto" />
        </div>
      ))}
      <div className="flex justify-center py-3">
        <LoaderCaption context="leaderboard" className="text-[11px]" />
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════
 * VARIANT: Source detail, hero + stats bar + split content
 * ═══════════════════════════════════════════════════════════════════ */
export function SourceDetailSkeleton() {
  return (
    <div className="px-6 lg:px-12 py-6">
      <div className="max-w-site mx-auto">
        {/* Hero, mimics SourceHero */}
        <div className="border border-border-light overflow-hidden bg-white flex">
          <div className="flex-1 px-5 py-4">
            <div className="flex items-center gap-2 mb-2">
              <Shimmer className="h-[16px] w-20 !rounded" />
              <Shimmer className="h-[16px] w-14 !rounded" />
            </div>
            <Shimmer className="h-[22px] w-48 mb-2" />
            <Shimmer className="h-[12px] w-full mb-1" />
            <Shimmer className="h-[12px] w-3/4" />
          </div>
          <Shimmer className="w-1/2 min-h-[100px] !rounded-none" />
        </div>

        {/* Stats bar */}
        <div className="mt-4 bg-[var(--surface)] border border-border-light px-5 py-3 flex items-center gap-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i}>
              <Shimmer className="h-[10px] w-14 mb-1.5" />
              <Shimmer className="h-[16px] w-12" />
            </div>
          ))}
          <div className="flex-1" />
          <div>
            <Shimmer className="h-[10px] w-8 mb-1.5" />
            <Shimmer className="h-[16px] w-16" />
          </div>
        </div>

        {/* Content split */}
        <div className="flex flex-col lg:flex-row gap-6 mt-6">
          {/* Left: table area */}
          <div className="flex-1 min-w-0">
            <div className="section-bar">
              <Shimmer className="h-[14px] w-32" style={{ background: 'rgba(255,255,255,0.1)' }} />
            </div>
            <div className="border border-t-0 border-border-light bg-white">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center px-4 py-3 border-b border-border-light gap-4" style={{ animationDelay: `${i * 50}ms` }}>
                  <Shimmer className="h-[13px] w-6" />
                  <Shimmer className="h-[13px] w-40 flex-1" />
                  <Shimmer className="h-[13px] w-16" />
                  <Shimmer className="h-[13px] w-12" />
                </div>
              ))}
            </div>
          </div>
          {/* Right: entry panel placeholder */}
          <div className="w-full lg:w-[300px] shrink-0">
            <div className="border border-border-light bg-white p-4">
              <Shimmer className="h-[16px] w-32 mb-4" />
              <Shimmer className="h-[40px] w-full mb-3 !rounded" />
              <Shimmer className="h-[40px] w-full mb-3 !rounded" />
              <Shimmer className="h-[36px] w-full !rounded" />
            </div>
          </div>
        </div>

        <div className="flex justify-center mt-8">
          <LoaderCaption context="sources" />
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════
 * VARIANT: Markets grid, large data load, centered with message
 * ═══════════════════════════════════════════════════════════════════ */

/** Bullish mini-chart path */
const CHART_PATH = 'M0,22 L10,20 L18,24 L26,16 L34,18 L42,12 L50,14 L58,8 L66,11 L74,6 L82,9 L90,4 L98,7 L106,3 L114,5'

export function MarketsGridSkeleton() {
  return (
    <div className="flex flex-col items-center justify-center h-full py-16">
      <div className="flex flex-col items-center gap-5">
        <svg
          width="120"
          height="28"
          viewBox="0 0 120 28"
          className="vision-loader-chart"
          aria-hidden="true"
        >
          <path
            d={CHART_PATH}
            fill="none"
            stroke="var(--brand)"
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="vision-loader-glow"
          />
          <path
            d={CHART_PATH}
            fill="none"
            stroke="var(--brand)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <LoaderCaption context="markets" />
      </div>
    </div>
  )
}
