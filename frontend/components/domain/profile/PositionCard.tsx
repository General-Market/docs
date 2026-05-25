'use client'

import { useCallback } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { springs } from '@/components/ui/spring'
import { Link, useRouter } from '@/i18n/routing'
import type { ProfileBatch } from '@/hooks/usePlayerProfile'
import { formatPnL } from '@/lib/utils/formatters'

interface SourceInfo {
  sourceId: string
  name: string
  logo: string
  brandBg: string
}

interface PositionCardProps {
  batch: ProfileBatch
  source: SourceInfo | null
  index: number
}

function compactROI(value: number): string {
  const sign = value >= 0 ? '+' : ''
  const abs = Math.abs(value)
  if (abs >= 10_000) return `${sign}${(value / 1000).toFixed(0)}K%`
  if (abs >= 1_000) return `${sign}${value.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}%`
  return `${sign}${value.toFixed(1)}%`
}

function accentColor(brandBg: string): string {
  if (brandBg.startsWith('linear')) return '#6366f1'
  const hex = brandBg.replace('#', '')
  if (hex.length !== 6) return '#6366f1'
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  const lum = r * 0.299 + g * 0.587 + b * 0.114
  return lum > 200 ? '#6366f1' : brandBg
}

export function PositionCard({ batch, source, index }: PositionCardProps) {
  const router = useRouter()
  const reduced = useReducedMotion()
  const pnl = batch.balance - batch.deposited
  const pnlColor = pnl >= 0 ? 'text-color-up' : 'text-color-down'
  const accent = source ? accentColor(source.brandBg) : '#6366f1'
  // "exited" with no settled ticks = the round's deadline passed but it never
  // actually resolved. The position is still open, awaiting settlement.
  const isAwaitingSettlement = batch.status === 'exited' && batch.tickCount === 0
  const isActive = batch.status === 'active'

  const handleViewTransition = useCallback((e: React.MouseEvent) => {
    const d = document as any
    if (!d.startViewTransition) return
    e.preventDefault()
    d.startViewTransition(() => {
      router.push(`/source/${batch.sourceId}`)
    })
  }, [router, batch.sourceId])

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...springs.page, delay: index * 0.04 }}
    >
      <Link
        href={`/source/${batch.sourceId}`}
        onClick={handleViewTransition}
        className="group block"
      >
        <motion.div
          className="relative bg-white border border-border-light rounded-lg overflow-hidden"
          whileHover={reduced ? undefined : {
            y: -2,
            boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
          }}
          whileTap={reduced ? undefined : { y: 0 }}
          transition={springs.hover}
        >
          {/* Left accent stripe */}
          <div
            className="absolute left-0 top-0 bottom-0 w-[3px]"
            style={{ backgroundColor: accent }}
          />

          <div className="flex items-center gap-4 px-4 pl-5 py-3">
            {/* Source icon */}
            {source && (
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                style={
                  source.brandBg.startsWith('linear')
                    ? { background: source.brandBg }
                    : { backgroundColor: source.brandBg }
                }
              >
                <img
                  src={source.logo}
                  alt=""
                  className="w-5 h-5 object-contain"
                />
              </div>
            )}

            {/* Source + round info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-caption font-semibold text-black truncate">
                  {source?.name ?? batch.sourceId}
                </span>
                <span className="text-micro text-text-muted">
                  Round #{batch.batchId}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                {isActive && (
                  <span className="flex items-center gap-1">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-50" style={{ backgroundColor: accent }} />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ backgroundColor: accent }} />
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: accent }}>
                      Live
                    </span>
                  </span>
                )}
                {isAwaitingSettlement && (
                  <span className="flex items-center gap-1">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-50" style={{ backgroundColor: '#f59e0b' }} />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ backgroundColor: '#f59e0b' }} />
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#b45309' }}>
                      Settling
                    </span>
                  </span>
                )}
                {!isActive && !isAwaitingSettlement && (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-surface text-text-muted">
                    Exited
                  </span>
                )}
                <span className="text-micro text-text-muted">
                  {batch.tickCount} ticks
                </span>
              </div>
            </div>

            {/* Deposited */}
            <div className="shrink-0 text-right">
              <div className="text-[15px] font-black font-mono tabular-nums text-black">
                ${batch.deposited.toFixed(2)}
              </div>
              <div className="text-micro text-text-muted">deposited</div>
            </div>

            {/* Value + P&L */}
            <div className="shrink-0 text-right w-[100px]">
              <div className="text-[15px] font-black font-mono tabular-nums text-black">
                ${batch.balance.toFixed(2)}
              </div>
              {isAwaitingSettlement ? (
                <div className="text-micro font-mono font-bold text-text-muted">
                  Awaiting result
                </div>
              ) : (
                <div className={`text-micro font-mono font-bold ${pnlColor}`}>
                  {formatPnL(pnl)} ({compactROI(batch.roi)})
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </Link>
    </motion.div>
  )
}
