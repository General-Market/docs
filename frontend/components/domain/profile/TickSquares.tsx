'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import type { ProfileTick } from '@/hooks/usePlayerProfile'

const WIN_COLORS = ['#dcfce7', '#86efac', '#22c55e', '#15803d']
const LOSS_COLORS = ['#fecaca', '#f87171', '#ef4444', '#dc2626']

function computeQuartileIndex(absPnl: number, quartiles: number[]): number {
  if (absPnl <= quartiles[0]) return 0
  if (absPnl <= quartiles[1]) return 1
  if (absPnl <= quartiles[2]) return 2
  return 3
}

function getQuartiles(values: number[]): number[] {
  if (values.length === 0) return [0, 0, 0]
  const sorted = [...values].sort((a, b) => a - b)
  const q1 = sorted[Math.floor(sorted.length * 0.25)] ?? 0
  const q2 = sorted[Math.floor(sorted.length * 0.5)] ?? 0
  const q3 = sorted[Math.floor(sorted.length * 0.75)] ?? 0
  return [q1, q2, q3]
}

interface TickSquaresProps {
  ticks: ProfileTick[]
}

export function TickSquares({ ticks }: TickSquaresProps) {
  const t = useTranslations('common')
  const recent = ticks.slice(-60)

  const quartiles = useMemo(() => {
    const absPnls = recent.map((t) => Math.abs(t.pnl))
    return getQuartiles(absPnls)
  }, [recent])

  return (
    <div className="flex-1 flex gap-[2px] items-center overflow-x-auto">
      {recent.map((tick) => {
        const intensity = computeQuartileIndex(Math.abs(tick.pnl), quartiles)
        const color = tick.won ? WIN_COLORS[intensity] : LOSS_COLORS[intensity]
        const sign = tick.pnl >= 0 ? '+' : ''
        return (
          <div
            key={tick.tickId}
            className="shrink-0"
            style={{
              width: 11,
              height: 11,
              borderRadius: 2,
              backgroundColor: color,
            }}
            title={t('profile.tick_title', { tickId: tick.tickId, sign, pnl: tick.pnl.toFixed(2) })}
          />
        )
      })}
    </div>
  )
}

export function TickSquaresLegend() {
  const t = useTranslations('common')

  return (
    <div className="flex items-center gap-1 text-micro text-text-muted">
      <span>{t('profile.loss')}</span>
      {[...LOSS_COLORS].reverse().map((c, i) => (
        <div
          key={`loss-${i}`}
          style={{ width: 9, height: 9, borderRadius: 2, backgroundColor: c }}
        />
      ))}
      <div className="w-1" />
      {WIN_COLORS.map((c, i) => (
        <div
          key={`win-${i}`}
          style={{ width: 9, height: 9, borderRadius: 2, backgroundColor: c }}
        />
      ))}
      <span>{t('profile.win')}</span>
    </div>
  )
}
