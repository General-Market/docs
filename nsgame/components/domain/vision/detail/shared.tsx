'use client'

import { useMemo } from 'react'
import { useSharedCountdown } from '@/hooks/useSharedCountdown'
import { useAccount } from '@/lib/wallet-shim'
import { useVisionLeaderboard } from '@/hooks/vision/useVisionLeaderboard'

// ── Format helpers ──

function fmt(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function formatTvl(tvl: string): string {
  const raw = parseFloat(tvl)
  if (isNaN(raw) || raw === 0) return '$0'
  const num = raw / 1e18
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(2)}M`
  if (num >= 1_000) return `$${(num / 1_000).toFixed(1)}K`
  return `$${num.toFixed(2)}`
}

// ── Wallet stats bar ──

export function WalletSourceStats({ sourceId }: { sourceId: string }) {
  const { address } = useAccount()
  const { leaderboard } = useVisionLeaderboard(undefined, sourceId)
  const entry = useMemo(() => {
    if (!address || !leaderboard?.length) return null
    return leaderboard.find(p => p.walletAddress.toLowerCase() === address.toLowerCase()) ?? null
  }, [address, leaderboard])

  if (!address || !entry) return null

  const pnlColor = entry.pnl > 0 ? 'text-green-600' : entry.pnl < 0 ? 'text-red-600' : 'text-text-muted'
  const pnlSign = entry.pnl > 0 ? '+' : ''

  return (
    <div className="bg-black text-white px-5 py-3 flex items-center gap-8">
      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-white/50">Your Stats</div>
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-white/50">Rounds</div>
        <div className="text-[15px] font-bold font-mono">{entry.roundsPlayed}</div>
      </div>
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-white/50">ROI</div>
        <div className={`text-[15px] font-bold font-mono ${entry.roi >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {entry.roi >= 0 ? '+' : ''}{entry.roi.toFixed(1)}%
        </div>
      </div>
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-white/50">Volume</div>
        <div className="text-[15px] font-bold font-mono">${entry.totalVolume.toFixed(2)}</div>
      </div>
      <div className="flex-1" />
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-white/50">P&L</div>
        <div className={`text-[18px] font-black font-mono ${pnlColor}`}>
          {pnlSign}${Math.abs(entry.pnl).toFixed(2)}
        </div>
      </div>
    </div>
  )
}

// ── Triple timer, prev settle | close | settle ──

export interface TripleTimerProps {
  bettingEnd: string | null
  tickDuration: number
  prevBettingEnd: string | null
  prevTickDuration: number
}

export function TripleTimer({ bettingEnd, tickDuration, prevBettingEnd, prevTickDuration }: TripleTimerProps) {
  const closeRemaining = useSharedCountdown(bettingEnd)

  const now = Date.now()

  // Current round settle
  const curEnd = bettingEnd ? new Date(bettingEnd).getTime() : 0
  const curSettleRemaining = bettingEnd ? Math.max(0, Math.floor((curEnd + tickDuration * 1000 - now) / 1000)) : 0

  // Previous round settle
  const prevEnd = prevBettingEnd ? new Date(prevBettingEnd).getTime() : 0
  const prevSettleRemaining = prevBettingEnd ? Math.max(0, Math.floor((prevEnd + prevTickDuration * 1000 - now) / 1000)) : 0

  if (!bettingEnd) {
    return (
      <div className="flex items-center gap-2">
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-text-muted/40 opacity-40" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-text-muted/25" />
        </span>
        <span className="text-[12px] text-text-muted font-medium">Awaiting round</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3">
      {/* Prev settle, only if a previous round is resolving */}
      {prevBettingEnd && prevSettleRemaining > 0 && (
        <>
          <div className="text-right">
            <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-color-warning">Prior Round</div>
            <div className="text-[14px] font-bold font-mono tabular-nums leading-none text-color-warning">
              {fmt(prevSettleRemaining)}
            </div>
          </div>
          <div className="w-px h-8 bg-border-light" />
        </>
      )}
      {/* Close */}
      <div className="text-right">
        <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted">Bets Close</div>
        <div className={`text-[20px] font-black font-mono tabular-nums leading-none ${closeRemaining <= 0 ? 'text-text-muted line-through text-[14px]' : closeRemaining < 60 ? 'text-color-down' : 'text-black'}`}>
          {fmt(Math.max(0, closeRemaining))}
        </div>
      </div>
      <div className="w-px h-8 bg-border-light" />
      {/* Settle */}
      <div className="text-right">
        <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted">Results</div>
        <div className={`font-mono tabular-nums leading-none ${closeRemaining <= 0 ? 'text-[20px] font-black text-color-warning' : 'text-[14px] font-bold text-text-secondary'}`}>
          {fmt(curSettleRemaining)}
        </div>
      </div>
    </div>
  )
}
