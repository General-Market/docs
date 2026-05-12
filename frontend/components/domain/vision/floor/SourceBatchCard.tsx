'use client'

import { useEffect, useState } from 'react'
import { formatUnits } from 'viem'
import type { FloorBatch } from '@/hooks/vision/useFloorStream'

interface Props {
  batch: FloorBatch
}

const RING_RADIUS = 17
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

export function SourceBatchCard({ batch }: Props) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000))
  useEffect(() => {
    const i = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000)
    return () => clearInterval(i)
  }, [])

  const remaining = batch.bettingEnd ? Math.max(0, batch.bettingEnd - now) : 0
  const total = batch.tickDuration || 1
  const progress = total > 0 ? Math.min(1, Math.max(0, 1 - remaining / total)) : 0
  const dashOffset = RING_CIRCUMFERENCE * (1 - progress)

  const min = Math.floor(remaining / 60)
  const sec = remaining % 60
  const countdownText = batch.bettingEnd ? `${min}:${String(sec).padStart(2, '0')}` : '—:—'

  const tvlNum = (() => {
    try {
      return Number(formatUnits(BigInt(batch.tvlStr || '0'), 18))
    } catch {
      return 0
    }
  })()
  const tvlText =
    tvlNum >= 1_000_000
      ? `$${(tvlNum / 1_000_000).toFixed(1)}M`
      : tvlNum >= 1_000
        ? `$${(tvlNum / 1_000).toFixed(1)}k`
        : `$${tvlNum.toFixed(0)}`

  const pulsing = remaining > 0 && remaining <= 10
  const pulseDuration = remaining <= 1 ? '0.5s' : remaining <= 5 ? '0.8s' : '1.2s'

  const isSettling = batch.status === 'settling' || batch.status === 'locked'

  return (
    <div
      className="relative flex items-center gap-3 rounded-2xl border border-black/[0.06] bg-white px-3 py-2.5 transition-shadow"
      style={{
        animation: pulsing ? `floorCardPulse ${pulseDuration} ease-in-out infinite` : undefined,
        boxShadow: isSettling
          ? '0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,113,227,0.12)'
          : '0 1px 2px rgba(0,0,0,0.04)',
      }}
    >
      <div className="relative h-10 w-10 shrink-0">
        <svg className="absolute inset-0" viewBox="0 0 40 40" aria-hidden>
          <circle
            cx="20"
            cy="20"
            r={RING_RADIUS}
            fill="none"
            stroke="rgba(0,0,0,0.06)"
            strokeWidth="2"
          />
          <circle
            cx="20"
            cy="20"
            r={RING_RADIUS}
            fill="none"
            stroke={batch.sourceBrandBg || '#1d1d1f'}
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray={RING_CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
            transform="rotate(-90 20 20)"
            style={{ transition: 'stroke-dashoffset 1s linear' }}
          />
        </svg>
        {batch.sourceLogo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={batch.sourceLogo}
            alt=""
            className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full object-cover"
          />
        ) : (
          <div
            className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ background: batch.sourceBrandBg || '#1d1d1f' }}
          />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-[13px] font-medium tracking-[-0.01em] text-[#1d1d1f]">
            {batch.sourceName}
          </span>
          <span className="shrink-0 tabular-nums text-[11px] text-[#86868b]">{countdownText}</span>
        </div>
        <div className="mt-0.5 flex items-baseline justify-between gap-2">
          <span className="tabular-nums text-[12px] font-medium text-[#1d1d1f]">{tvlText}</span>
          <span className="shrink-0 text-[10px] uppercase tracking-[0.06em] text-[#86868b]">
            {batch.status === 'unknown' ? '·' : batch.status}
          </span>
        </div>
      </div>
    </div>
  )
}
