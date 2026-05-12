'use client'

import { useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { formatUnits } from 'viem'
import { useFloorTape, useFloorBatches, type TapeRow } from '@/hooks/vision/useFloorStream'

function formatTime(ms: number): string {
  if (!ms) return '--:--:--'
  const d = new Date(ms)
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  const s = String(d.getSeconds()).padStart(2, '0')
  return `${h}:${m}:${s}`
}

function formatStake(weiStr: string): string {
  try {
    const n = Number(formatUnits(BigInt(weiStr || '0'), 18))
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
    if (n >= 10_000) return `$${(n / 1_000).toFixed(0)}k`
    if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`
    return `$${n.toFixed(0)}`
  } catch {
    return '$0'
  }
}

interface TapeRowViewProps {
  row: TapeRow
  sourceName: string
  sourceBrandBg: string
}

function TapeRowView({ row, sourceName, sourceBrandBg }: TapeRowViewProps) {
  const totalUp = (() => {
    try {
      return BigInt(row.totalUpStakeStr || '0')
    } catch {
      return 0n
    }
  })()
  const totalDown = (() => {
    try {
      return BigInt(row.totalDownStakeStr || '0')
    } catch {
      return 0n
    }
  })()
  const total = totalUp + totalDown
  const totalStr = formatStake(total.toString())

  const upPct = total > 0n ? Number((totalUp * 1000n) / total) / 10 : 50
  const dirGlyph = row.netDirection === 'up' ? '▲' : row.netDirection === 'down' ? '▼' : '·'
  const dirColor =
    row.netDirection === 'up'
      ? '#0071e3'
      : row.netDirection === 'down'
        ? '#ff3b30'
        : '#86868b'

  return (
    <motion.div
      initial={{ opacity: 0, y: -8, backgroundColor: `${dirColor}1f` }}
      animate={{ opacity: 1, y: 0, backgroundColor: 'rgba(255,255,255,0)' }}
      transition={{
        opacity: { duration: 0.2, ease: [0.25, 0.1, 0.3, 1] },
        y: { duration: 0.2, ease: [0.25, 0.1, 0.3, 1] },
        backgroundColor: { duration: 0.7, ease: [0.25, 0.1, 0.3, 1], delay: 0.05 },
      }}
      className="flex items-baseline gap-3 px-6 py-2.5"
      style={{ borderBottom: '1px solid var(--apple-border)' }}
    >
      <span
        className="w-[68px] shrink-0 tabular-nums text-[11px] text-[#86868b]"
        style={{ fontFamily: 'var(--apple-font-text)' }}
      >
        {formatTime(row.displayedAt)}
      </span>
      <span
        className="inline-flex h-2 w-2 shrink-0 self-center rounded-full"
        style={{ background: sourceBrandBg }}
        aria-hidden
      />
      <span
        className="w-[120px] shrink-0 truncate text-[14px] tracking-[-0.014em] text-[#1d1d1f]"
        style={{ fontFamily: 'var(--apple-font-text)' }}
      >
        {sourceName}
      </span>
      <span
        className="w-[20px] shrink-0 text-center text-[13px] font-medium tabular-nums"
        style={{ color: dirColor }}
      >
        {dirGlyph}
      </span>
      <span className="tabular-nums text-[14px] font-medium text-[#1d1d1f]">{totalStr}</span>
      <div className="ml-auto flex items-baseline gap-3">
        <span className="tabular-nums text-[11px] text-[#86868b]">
          <span style={{ color: '#0071e3' }}>{upPct.toFixed(0)}%</span>
          <span className="mx-1 text-[#d2d2d7]">/</span>
          <span style={{ color: '#ff3b30' }}>{(100 - upPct).toFixed(0)}%</span>
        </span>
        <span className="w-[42px] shrink-0 text-right tabular-nums text-[11px] text-[#86868b]">
          {row.marketCount} mkt
        </span>
      </div>
    </motion.div>
  )
}

function GhostRow({ delay }: { delay: number }) {
  return (
    <div
      className="floor-empty-shimmer flex items-baseline gap-3 px-6 py-2.5"
      style={{
        borderBottom: '1px solid var(--apple-border)',
        animationDelay: `${delay}s`,
      }}
    >
      <span className="h-2 w-[60px] shrink-0 rounded-[2px] bg-black/[0.04]" />
      <span className="h-2 w-2 shrink-0 rounded-full bg-black/[0.04]" />
      <span className="h-2 w-[120px] shrink-0 rounded-[2px] bg-black/[0.04]" />
      <span className="h-2 w-4 shrink-0 rounded-[2px] bg-black/[0.04]" />
      <span className="h-2 w-12 shrink-0 rounded-[2px] bg-black/[0.04]" />
      <span className="ml-auto h-2 w-[80px] rounded-[2px] bg-black/[0.04]" />
    </div>
  )
}

export function SettlementTape() {
  const rows = useFloorTape()
  const batches = useFloorBatches()
  const sourceInfo = useMemo(() => {
    const m = new Map<string, { name: string; brand: string }>()
    for (const b of batches) m.set(b.sourceId, { name: b.sourceName, brand: b.sourceBrandBg })
    return m
  }, [batches])

  return (
    <div className="flex h-full flex-col">
      <div
        className="flex items-baseline justify-between px-6 py-4"
        style={{ borderBottom: '1px solid var(--apple-border)' }}
      >
        <h2 className="floor-pane-header">Settlement Tape</h2>
        <span className="tabular-nums text-[11px] text-[#86868b]">{rows.length}</span>
      </div>
      <div className="relative flex-1 overflow-hidden">
        <div className="absolute inset-0 overflow-y-auto">
          {rows.length === 0 ? (
            <>
              <GhostRow delay={0} />
              <GhostRow delay={1.5} />
              <GhostRow delay={3} />
              <GhostRow delay={4.5} />
              <GhostRow delay={6} />
              <div className="px-6 pt-10 text-center">
                <p
                  className="text-[15px] tracking-[-0.016em] text-[#6e6e73]"
                  style={{ fontFamily: 'var(--apple-font-display)' }}
                >
                  <span className="floor-breathe align-middle">·</span>
                  <span className="ml-2 align-middle">Listening for the next settlement.</span>
                </p>
                <p className="mt-2 text-[12px] text-[#86868b]">
                  Every batch on this chain ends here.
                </p>
              </div>
            </>
          ) : (
            <AnimatePresence initial={false}>
              {rows.map(r => {
                const info = sourceInfo.get(r.sourceId)
                return (
                  <TapeRowView
                    key={r.id}
                    row={r}
                    sourceName={info?.name ?? r.sourceId}
                    sourceBrandBg={info?.brand ?? '#1d1d1f'}
                  />
                )
              })}
            </AnimatePresence>
          )}
        </div>
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-20"
          style={{
            background:
              'linear-gradient(to top, var(--apple-page-bg), rgba(245,245,247,0))',
          }}
        />
      </div>
    </div>
  )
}
