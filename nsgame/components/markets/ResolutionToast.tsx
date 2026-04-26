'use client'

/**
 * ResolutionToast — a single line that appears when the user returns to
 * the app and finds something has resolved in their absence. One toast
 * per visit, dismissed by tap or by an eight-second timer.
 *
 * The copy is terse on purpose. The platform reports an outcome; it does
 * not console the user. The site notices, then moves on.
 */

import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useResolvedPositions } from '@/hooks/useResolvedPositions'
import { getCatalogEntryByPairIndex } from '@/lib/markets/catalog'
import type { UserPosition } from '@/lib/markets/positions'
import { MyPositionsModal } from './MyPositionsModal'

const AUTO_DISMISS_MS = 8000
const USDC_DECIMALS = 6

function formatUsdcAmount(units: bigint): string {
  if (units === 0n) return '0'
  const negative = units < 0n
  const abs = negative ? -units : units
  const base = 10n ** BigInt(USDC_DECIMALS)
  const whole = abs / base
  const frac = abs % base
  if (frac === 0n) return `${negative ? '-' : ''}${whole.toString()}`
  // Two decimals is enough — the toast does not host a balance sheet.
  const fracStr = frac
    .toString()
    .padStart(USDC_DECIMALS, '0')
    .slice(0, 2)
    .replace(/0+$/, '')
  return `${negative ? '-' : ''}${whole.toString()}${fracStr ? `.${fracStr}` : ''}`
}

function isWonState(state: UserPosition['state']): boolean {
  return state === 'resolved-won' || state === 'claimed-won'
}

function isRefundState(state: UserPosition['state']): boolean {
  return state === 'stranded-refund'
}

function competitorLabel(position: UserPosition): string {
  // Map pair index → display name of the side the user took. The catalog
  // is the source of truth for vs-pair display strings.
  const entry = getCatalogEntryByPairIndex(position.thresholdBps)
  if (!entry) return position.side === 'yes' ? 'A' : 'B'
  return position.side === 'yes' ? entry.displayA : entry.displayB
}

function metricLabel(position: UserPosition): string {
  // The catalog format hint tells us which axis the bet was on. Fall
  // back to the side label if the catalog has rotated past this pair.
  const entry = getCatalogEntryByPairIndex(position.thresholdBps)
  if (!entry) return 'closed'
  if (entry.format === 'f1-gain-race') return 'gain'
  // f2 markets are the cam-room totals.
  return 'totals'
}

function buildCopy(positions: UserPosition[]): string {
  if (positions.length === 0) return ''

  if (positions.length === 1) {
    const p = positions[0]
    if (isWonState(p.state)) {
      const net = p.claimNet
      const amount = net !== null && net > 0n ? formatUsdcAmount(net) : null
      const tail = amount ? ` +$${amount}.` : '.'
      return `It worked. ${competitorLabel(p)} / ${metricLabel(p)} closed YES${tail}`
    }
    if (isRefundState(p.state)) {
      return `Refunded. ${competitorLabel(p)} / ${metricLabel(p)} did not settle.`
    }
    return `It did not. ${competitorLabel(p)} / ${metricLabel(p)} closed NO.`
  }

  // Several at once. Count the wins. Don't dress it up.
  const wins = positions.filter(p => isWonState(p.state)).length
  const total = positions.length
  if (wins === 0) return `${total} resolutions. None yours.`
  if (wins === total) return `${total} resolutions. All yours.`
  return `${total} resolutions. ${wins} yours.`
}

export function ResolutionToast() {
  const { resolvedSinceLastSeen, unviewedCount, markAllSeen } = useResolvedPositions()
  const [visible, setVisible] = useState(false)
  const [shown, setShown] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)

  // Render at most one toast per page mount. The watermark advance fires
  // when the toast is shown; subsequent tabs/navigation within the SPA
  // will already see `unviewedCount === 0`.
  useEffect(() => {
    if (shown) return
    if (unviewedCount === 0) return
    setVisible(true)
    setShown(true)
    markAllSeen()
  }, [shown, unviewedCount, markAllSeen])

  useEffect(() => {
    if (!visible) return
    const id = window.setTimeout(() => setVisible(false), AUTO_DISMISS_MS)
    return () => window.clearTimeout(id)
  }, [visible])

  const message = useMemo(() => buildCopy(resolvedSinceLastSeen), [resolvedSinceLastSeen])
  const wonCount = useMemo(
    () => resolvedSinceLastSeen.filter(p => isWonState(p.state)).length,
    [resolvedSinceLastSeen],
  )
  const accent = wonCount > 0 ? 'border-emerald-500/40' : 'border-zinc-700'

  const handleClick = () => {
    setVisible(false)
    setModalOpen(true)
  }

  return (
    <>
      <AnimatePresence>
        {visible && message ? (
          <motion.div
            key="resolution-toast"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="pointer-events-none fixed bottom-[calc(env(safe-area-inset-bottom,0)+72px)] right-3 z-40 max-w-[calc(100vw-1.5rem)] sm:right-4 lg:bottom-6"
          >
            <button
              type="button"
              onClick={handleClick}
              aria-label="Open positions"
              className={[
                'pointer-events-auto flex items-center gap-3 rounded-md border bg-zinc-950/95 px-3 py-2.5 text-left shadow-[0_8px_24px_-8px_rgb(0_0_0/0.6)] backdrop-blur transition-colors hover:bg-zinc-900',
                accent,
              ].join(' ')}
            >
              <span
                aria-hidden
                className={[
                  'h-1.5 w-1.5 rounded-full',
                  wonCount > 0 ? 'bg-emerald-400' : 'bg-zinc-500',
                ].join(' ')}
              />
              <span className="font-mono text-[11px] tracking-tight text-zinc-100">
                {message}
              </span>
              <span
                aria-hidden
                className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500"
              >
                view
              </span>
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <MyPositionsModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  )
}
