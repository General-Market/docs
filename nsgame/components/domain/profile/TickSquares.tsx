'use client'

import { useMemo, useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { ProfileTick } from '@/hooks/usePlayerProfile'

const WIN_COLORS = ['#bbf7d0', '#4ade80', '#22c55e', '#15803d']
const LOSS_COLORS = ['#fecaca', '#f87171', '#ef4444', '#b91c1c']
const NEUTRAL_COLOR = '#e5e7eb'

function getQuartiles(values: number[]): number[] {
  if (values.length === 0) return [0, 0, 0]
  const sorted = [...values].sort((a, b) => a - b)
  return [
    sorted[Math.floor(sorted.length * 0.25)] ?? 0,
    sorted[Math.floor(sorted.length * 0.5)] ?? 0,
    sorted[Math.floor(sorted.length * 0.75)] ?? 0,
  ]
}

function getColor(tick: ProfileTick, quartiles: number[]): string {
  if (tick.pnl === 0) return NEUTRAL_COLOR
  const abs = Math.abs(tick.pnl)
  const idx = abs <= quartiles[0] ? 0 : abs <= quartiles[1] ? 1 : abs <= quartiles[2] ? 2 : 3
  return tick.pnl > 0 ? WIN_COLORS[idx] : LOSS_COLORS[idx]
}

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function Tooltip({ tick, anchorRef }: { tick: ProfileTick; anchorRef: React.RefObject<HTMLDivElement | null> }) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  useEffect(() => {
    if (!anchorRef.current) return
    const rect = anchorRef.current.getBoundingClientRect()
    setPos({ top: rect.top - 4, left: rect.left + rect.width / 2 })
  }, [anchorRef])

  if (!pos) return null

  const sign = tick.pnl > 0 ? '+' : ''
  const label = tick.pnl === 0 ? 'DRAW' : tick.pnl > 0 ? 'WIN' : 'LOSS'
  const labelColor = tick.pnl > 0 ? 'text-green-400' : tick.pnl < 0 ? 'text-red-400' : 'text-white/60'

  return createPortal(
    <div
      className="fixed pointer-events-none"
      style={{ top: pos.top, left: pos.left, transform: 'translate(-50%, -100%)', zIndex: 9999 }}
    >
      <div className="bg-black text-white text-[10px] font-mono px-2.5 py-1.5 rounded shadow-lg whitespace-nowrap space-y-0.5">
        <div className={`font-bold ${labelColor}`}>
          {sign}${Math.abs(tick.pnl).toFixed(2)} {label}
        </div>
        <div className="text-white/40">{formatDate(tick.tickId)}</div>
      </div>
    </div>,
    document.body,
  )
}

const MAX_SQUARES = 60

interface TickSquaresProps {
  ticks: ProfileTick[]
}

export function TickSquares({ ticks }: TickSquaresProps) {
  // Show most recent ticks, left-aligned (newest last)
  const recent = ticks.slice(-MAX_SQUARES)
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const squareRefs = useRef<Map<number, HTMLDivElement>>(new Map())

  const quartiles = useMemo(() => {
    const nonZero = recent.filter(t => t.pnl !== 0).map(t => Math.abs(t.pnl))
    return getQuartiles(nonZero)
  }, [recent])

  return (
    <div className="flex-1 flex gap-[2px] items-center overflow-hidden">
      {recent.map((tick, i) => {
        const color = getColor(tick, quartiles)
        return (
          <div
            key={`${tick.tickId}-${i}`}
            ref={(el) => { if (el) squareRefs.current.set(i, el); else squareRefs.current.delete(i) }}
            className="shrink-0 cursor-pointer"
            style={{ width: 11, height: 11, borderRadius: 2, backgroundColor: color }}
            onMouseEnter={() => setHoverIdx(i)}
            onMouseLeave={() => setHoverIdx(null)}
          />
        )
      })}
      {hoverIdx !== null && squareRefs.current.has(hoverIdx) && (
        <Tooltip
          tick={recent[hoverIdx]}
          anchorRef={{ current: squareRefs.current.get(hoverIdx) ?? null }}
        />
      )}
    </div>
  )
}

export function TickSquaresLegend() {
  return (
    <div className="flex items-center gap-1 text-micro text-text-muted">
      <span>Loss</span>
      {[...LOSS_COLORS].reverse().map((c, i) => (
        <div key={`l${i}`} style={{ width: 9, height: 9, borderRadius: 2, backgroundColor: c }} />
      ))}
      <div style={{ width: 9, height: 9, borderRadius: 2, backgroundColor: NEUTRAL_COLOR }} />
      {WIN_COLORS.map((c, i) => (
        <div key={`w${i}`} style={{ width: 9, height: 9, borderRadius: 2, backgroundColor: c }} />
      ))}
      <span>Win</span>
    </div>
  )
}
