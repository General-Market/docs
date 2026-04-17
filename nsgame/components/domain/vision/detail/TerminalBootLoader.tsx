'use client'

import { useState, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils/cn'

// ── Deterministic pseudo-random (LCG) ──

function lcg(seed: number): number {
  return ((seed * 1103515245 + 12345) >>> 0) % 2147483647
}

function randDigit(seed: number): string {
  return String(lcg(seed) % 10)
}

// ── Flickering generators ──

/** Price: left digits cycle slow, right digits cycle fast */
function flickerPrice(tick: number, row: number): string {
  const s = row * 97
  const d1 = randDigit(Math.floor(tick / 3) + s)      // slow
  const d2 = randDigit(Math.floor(tick / 2) + s + 1)   // medium
  const d3 = randDigit(tick + s + 2)                    // fast
  const d4 = randDigit(tick * 3 + s + 3)                // very fast
  return `$${d1}${d2}.${d3}${d4}`
}

/** Change %: flickers with slight upward bias */
function flickerChange(tick: number, row: number): { text: string; positive: boolean } {
  const s = row * 73
  const positive = lcg(Math.floor(tick / 4) + s) % 3 !== 0
  const d1 = randDigit(tick * 2 + s)
  const d2 = randDigit(tick * 5 + s + 1)
  return {
    text: `${positive ? '+' : '-'}${d1}.${d2}%`,
    positive,
  }
}

/** Name: prefix + cycling hex chars. Inner chars settle first. */
function flickerName(tick: number, row: number, prefix: string): string {
  const HEX = '0123456789ABCDEF'
  const pfx = prefix ? prefix.toUpperCase().slice(0, 8) + '_' : ''
  const remaining = Math.max(0, 12 - pfx.length)
  let out = pfx
  for (let i = 0; i < remaining; i++) {
    const rate = i < 2 ? 2 : i < 5 ? 4 : 7
    const idx = lcg(tick * rate + row * 31 + i * 13) % HEX.length
    out += HEX[idx]
  }
  return out
}

// ── Static data ──

const RES_LABELS = ['Up 0.3%', 'Dn 0.5%', 'Flat 0.3%', 'Up 1%', 'Dn 3%', 'Flat 1%']

const STATUS_MESSAGES = [
  'Connecting to data feed...',
  'Scanning market activity...',
  'Resolving price signals...',
  'Calibrating thresholds...',
  'Indexing positions...',
  'Reading oracle consensus...',
]

// ── Component ──

interface TerminalBootLoaderProps {
  rowCount?: number
  sourcePrefix?: string
  brandColor?: string
}

export function TerminalBootLoader({
  rowCount = 16,
  sourcePrefix = '',
  brandColor = '#000000',
}: TerminalBootLoaderProps) {
  const rows = Math.min(rowCount || 16, 30)
  const [tick, setTick] = useState(0)
  const [msgIdx, setMsgIdx] = useState(0)
  const [msgVisible, setMsgVisible] = useState(true)

  // Respect reduced motion
  const [reducedMotion, setReducedMotion] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mq.matches)
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // Main tick, 20fps is fast enough to look like a data feed
  useEffect(() => {
    if (reducedMotion) return
    const iv = setInterval(() => setTick(t => t + 1), 50)
    return () => clearInterval(iv)
  }, [reducedMotion])

  // Rotating status message
  useEffect(() => {
    const iv = setInterval(() => {
      setMsgVisible(false)
      setTimeout(() => {
        setMsgIdx(i => (i + 1) % STATUS_MESSAGES.length)
        setMsgVisible(true)
      }, 250)
    }, 3200)
    return () => clearInterval(iv)
  }, [])

  const isRowVisible = useCallback(
    (i: number) => reducedMotion || tick >= i * 2,
    [tick, reducedMotion],
  )

  // Safe brand color (gradients → fallback)
  const safeColor = brandColor.startsWith('linear') ? '#000000' : brandColor

  // ── Reduced motion: static skeleton ──
  if (reducedMotion) {
    return (
      <div className="max-h-[calc(100vh-280px)] overflow-y-auto">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="grid grid-cols-[1fr_100px] md:grid-cols-[1fr_80px_100px_80px_100px] items-center px-3 md:px-4 py-2.5 border-b border-border-light"
          >
            <div className="flex items-center gap-2">
              <div className="w-[22px] h-[22px] rounded-full skeleton shrink-0" />
              <div className="skeleton h-[13px] w-32 rounded" />
            </div>
            <div className="hidden md:flex justify-center">
              <div className="skeleton h-[16px] w-14 rounded" />
            </div>
            <div className="hidden md:block">
              <div className="skeleton h-[13px] w-16 rounded ml-auto" />
            </div>
            <div className="hidden md:block">
              <div className="skeleton h-[13px] w-14 rounded ml-auto" />
            </div>
            <div className="flex justify-center gap-1.5">
              <div className="skeleton h-[24px] w-[36px] rounded" />
              <div className="skeleton h-[24px] w-[36px] rounded" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  // ── Animated terminal boot ──

  const connectedRows = Math.min(rows, Math.floor(tick / 2))

  return (
    <div>
      <div className="max-h-[calc(100vh-280px)] overflow-y-auto">
        {Array.from({ length: rows }).map((_, i) => {
          const visible = isRowVisible(i)
          const price = flickerPrice(tick, i)
          const change = flickerChange(tick, i)
          const name = flickerName(tick, i, sourcePrefix)
          const resLabel = RES_LABELS[lcg(i * 41) % RES_LABELS.length]

          // Depth: rows further down are slightly more transparent
          const depthOpacity = visible ? Math.max(0.35, 0.7 - i * 0.015) : 0

          return (
            <div
              key={i}
              className="grid grid-cols-[1fr_100px] md:grid-cols-[1fr_80px_100px_80px_100px] items-center px-3 md:px-4 py-2.5 border-b border-border-light text-caption"
              style={{
                opacity: depthOpacity,
                transform: visible ? 'none' : 'translateY(6px)',
                transition: 'opacity 0.2s ease-out, transform 0.2s ease-out',
              }}
            >
              {/* Name */}
              <div className="min-w-0 flex items-center gap-2">
                <div
                  className="w-[22px] h-[22px] rounded-full shrink-0"
                  style={{ backgroundColor: safeColor + '15' }}
                />
                <div className="min-w-0 overflow-hidden">
                  <div className="font-mono text-[12px] tracking-[0.04em] text-black/40 truncate">
                    {name}
                  </div>
                  <div className="font-mono text-[10px] text-text-muted/25 mt-0.5">···</div>
                </div>
              </div>

              {/* Resolution type, desktop */}
              <div className="hidden md:flex justify-center">
                <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-[0.08em] border bg-gray-50/60 text-gray-300 border-gray-100/60">
                  {resLabel}
                </span>
              </div>

              {/* Value, desktop */}
              <div className="hidden md:block text-right font-mono tabular-nums text-black/40 font-semibold">
                {price}
              </div>

              {/* 1d change, desktop */}
              <div className={cn(
                'hidden md:block text-right font-mono tabular-nums font-semibold',
                change.positive ? 'text-green-600/30' : 'text-red-600/30',
              )}>
                {change.text}
              </div>

              {/* Bet buttons, dimmed */}
              <div className="flex items-center justify-center gap-1.5">
                <span className="px-2.5 py-1 rounded text-micro font-bold uppercase bg-green-50/30 text-green-300/60 border border-green-100/40">
                  UP
                </span>
                <span className="px-2.5 py-1 rounded text-micro font-bold uppercase bg-red-50/30 text-red-300/60 border border-red-100/40">
                  DN
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Status line */}
      <div className="px-4 py-3 flex items-center gap-2.5 border-t border-border-light">
        <span className="relative flex h-[6px] w-[6px] shrink-0">
          <span
            className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-50"
            style={{ backgroundColor: safeColor }}
          />
          <span
            className="relative inline-flex rounded-full h-[6px] w-[6px]"
            style={{ backgroundColor: safeColor }}
          />
        </span>
        <span
          className="font-mono text-[11px] text-text-muted transition-opacity duration-250"
          style={{ opacity: msgVisible ? 1 : 0 }}
        >
          {STATUS_MESSAGES[msgIdx]}
        </span>
        <span className="font-mono text-[11px] text-text-muted/35 ml-auto tabular-nums">
          {connectedRows}/{rows}
        </span>
      </div>
    </div>
  )
}
