'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRounds, type RoundInfo } from '@/hooks/vision/useRounds'

const CARD =
  'border border-[var(--apple-border,rgba(0,0,0,0.08))] bg-[var(--surface,#fff)] p-5 rounded-[var(--apple-r-md,12px)]'
const HEADER =
  'text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--apple-text-tertiary,#86868b)] mb-3'

interface LiveRoundsCardProps {
  sourceId: string
}

interface Phase {
  label: string
  dot: string
  badge: string
  badgeFg: string
}

const PHASE: Record<RoundInfo['status'], Phase> = {
  betting: {
    label: 'Live',
    dot: '#34c759',
    badge: 'rgba(52,199,89,0.12)',
    badgeFg: '#1f8a40',
  },
  locked: {
    label: 'Closed',
    dot: '#ff9500',
    badge: 'rgba(255,149,0,0.12)',
    badgeFg: '#a25700',
  },
  settling: {
    label: 'Settling',
    dot: '#0071e3',
    badge: 'rgba(0,113,227,0.12)',
    badgeFg: '#0066cc',
  },
  settled: {
    label: 'Done',
    dot: '#86868b',
    badge: 'rgba(134,134,139,0.12)',
    badgeFg: '#6e6e73',
  },
}

function useTick(intervalMs = 1000) {
  const [t, setT] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setT(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return t
}

function formatRemaining(ms: number): string {
  if (!isFinite(ms) || ms <= 0) return '0s'
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const r = s % 60
  if (m < 60) return r ? `${m}m ${r}s` : `${m}m`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m`
}

function formatUsdc18(raw: string): string {
  try {
    const big = BigInt(raw)
    const whole = big / 1000000000000000000n
    return `$${whole.toLocaleString()}`
  } catch {
    return '$0'
  }
}

interface PhaseStats {
  phaseLabel: string
  /** 0..1 — share of the current phase that has elapsed */
  progress: number
  /** Milliseconds remaining in the current phase */
  remainingMs: number
  /** Whether this round is still inside its expected window */
  inWindow: boolean
}

function computePhaseStats(round: RoundInfo, nowMs: number): PhaseStats {
  const bettingEndMs = round.bettingEnd ? new Date(round.bettingEnd).getTime() : NaN
  const windowMs = round.timeframeSecs * 1000

  if (round.status === 'betting') {
    if (!isFinite(bettingEndMs) || !windowMs) {
      return { phaseLabel: 'Betting', progress: 0, remainingMs: 0, inWindow: false }
    }
    const startMs = bettingEndMs - windowMs
    const elapsed = nowMs - startMs
    const remainingMs = Math.max(0, bettingEndMs - nowMs)
    const progress = Math.max(0, Math.min(1, elapsed / windowMs))
    return { phaseLabel: 'Closes in', progress, remainingMs, inWindow: remainingMs > 0 }
  }

  // locked / settling — settlement window equals timeframeSecs after bettingEnd
  if (!isFinite(bettingEndMs) || !windowMs) {
    return { phaseLabel: 'Settling', progress: 0, remainingMs: 0, inWindow: false }
  }
  const settleEndMs = bettingEndMs + windowMs
  const elapsed = nowMs - bettingEndMs
  const remainingMs = Math.max(0, settleEndMs - nowMs)
  const progress = Math.max(0, Math.min(1, elapsed / windowMs))
  return {
    phaseLabel: round.status === 'locked' ? 'Settles in' : 'Settling',
    progress,
    remainingMs,
    inWindow: remainingMs > 0,
  }
}

export function LiveRoundsCard({ sourceId }: LiveRoundsCardProps) {
  const { data: rounds = [], isLoading } = useRounds(sourceId)
  const now = useTick(1000)

  const active = useMemo(() => {
    return [...rounds]
      .filter(r => r.status !== 'settled')
      .sort((a, b) => {
        const order: Record<string, number> = { betting: 0, locked: 1, settling: 2, settled: 3 }
        const oa = order[a.status] ?? 9
        const ob = order[b.status] ?? 9
        if (oa !== ob) return oa - ob
        return a.batchId - b.batchId
      })
  }, [rounds])

  return (
    <section className={CARD}>
      <header className="flex items-center justify-between mb-3">
        <h2 className={HEADER + ' mb-0'}>Live Rounds</h2>
        <span
          className="text-[11px] font-mono tabular-nums"
          style={{ color: 'var(--apple-text-secondary)' }}
        >
          {active.length} active
        </span>
      </header>

      {isLoading && !active.length ? (
        <div className="space-y-3">
          {[0, 1].map(i => (
            <div
              key={i}
              className="h-[68px] rounded-[8px] animate-pulse"
              style={{ background: 'var(--apple-divider,#e8e8ed)' }}
            />
          ))}
        </div>
      ) : !active.length ? (
        <p className="py-6 text-center text-[13px]" style={{ color: 'var(--apple-text-secondary)' }}>
          Between rounds. The next one opens shortly.
        </p>
      ) : (
        <ul className="space-y-3 m-0 p-0 list-none">
          {active.map(round => {
            const stats = computePhaseStats(round, now)
            const phase = PHASE[round.status] ?? PHASE.settled
            const remaining = stats.inWindow
              ? formatRemaining(stats.remainingMs)
              : 'overdue'
            const accent =
              round.status === 'betting'
                ? '#34c759'
                : round.status === 'locked'
                  ? '#ff9500'
                  : '#0071e3'

            return (
              <li
                key={round.batchId}
                className="rounded-[10px] p-3"
                style={{
                  border: '1px solid var(--apple-border)',
                  background: 'var(--apple-panel-2,#fbfbfd)',
                }}
              >
                <div className="flex items-center justify-between mb-2 gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="inline-flex items-center gap-1.5 px-2 py-[3px] rounded-[6px] text-[10px] font-semibold uppercase tracking-[0.08em]"
                      style={{ background: phase.badge, color: phase.badgeFg }}
                    >
                      <span
                        className="w-[6px] h-[6px] rounded-full"
                        style={{
                          background: phase.dot,
                          boxShadow:
                            round.status === 'betting'
                              ? `0 0 0 3px ${phase.badge}`
                              : 'none',
                        }}
                      />
                      {phase.label}
                    </span>
                    <span
                      className="font-mono text-[12px] font-bold tracking-tight truncate"
                      style={{ color: 'var(--apple-text)' }}
                    >
                      Round #{round.batchId}
                    </span>
                  </div>
                  <div
                    className="flex items-center gap-3 text-[12px] font-mono tabular-nums shrink-0"
                    style={{ color: 'var(--apple-text-secondary)' }}
                  >
                    <span>
                      <span className="font-bold" style={{ color: 'var(--apple-text)' }}>
                        {round.playerCount}
                      </span>{' '}
                      players
                    </span>
                    <span style={{ color: 'var(--apple-divider)' }}>·</span>
                    <span className="font-bold" style={{ color: 'var(--apple-text)' }}>
                      {formatUsdc18(round.tvl)}
                    </span>
                  </div>
                </div>

                <div
                  className="relative h-[6px] rounded-[3px] overflow-hidden"
                  style={{ background: 'rgba(0,0,0,0.06)' }}
                >
                  <div
                    className="absolute inset-y-0 left-0 right-0 origin-left will-change-transform"
                    style={{
                      transform: `scaleX(${Math.max(0, Math.min(1, stats.progress)).toFixed(4)})`,
                      background: accent,
                      transition: 'transform 1000ms cubic-bezier(0.4, 0, 0.6, 1)',
                    }}
                  />
                </div>

                <div className="flex items-center justify-between mt-2 text-[11px]">
                  <span
                    className="uppercase tracking-[0.08em] font-semibold"
                    style={{ color: 'var(--apple-text-secondary)' }}
                  >
                    {stats.phaseLabel}
                  </span>
                  <span
                    className="font-mono tabular-nums"
                    style={{ color: 'var(--apple-text)' }}
                  >
                    {remaining}
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
