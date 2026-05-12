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
    if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`
    return `$${n.toFixed(0)}`
  } catch {
    return '$0'
  }
}

interface TapeRowViewProps {
  row: TapeRow
  sourceName: string
}

function TapeRowView({ row, sourceName }: TapeRowViewProps) {
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

  const dirGlyph = row.netDirection === 'up' ? '▲' : row.netDirection === 'down' ? '▼' : '='
  const dirColor =
    row.netDirection === 'up' ? '#0071e3' : row.netDirection === 'down' ? '#ff3b30' : '#86868b'

  return (
    <motion.div
      initial={{ opacity: 0, y: -8, backgroundColor: `${dirColor}1f` }}
      animate={{ opacity: 1, y: 0, backgroundColor: 'rgba(255,255,255,0)' }}
      transition={{
        opacity: { duration: 0.18, ease: [0.25, 0.1, 0.3, 1] },
        y: { duration: 0.18, ease: [0.25, 0.1, 0.3, 1] },
        backgroundColor: { duration: 0.6, ease: [0.25, 0.1, 0.3, 1], delay: 0.05 },
      }}
      className="flex items-baseline gap-3 border-b border-black/[0.04] px-4 py-1.5"
    >
      <span className="w-[70px] shrink-0 tabular-nums font-mono text-[11px] text-[#86868b]">
        {formatTime(row.displayedAt)}
      </span>
      <span className="w-[90px] shrink-0 truncate text-[13px] tracking-[-0.01em] text-[#1d1d1f]">
        {sourceName}
      </span>
      <span
        className="w-[18px] shrink-0 text-center tabular-nums text-[13px] font-medium"
        style={{ color: dirColor }}
      >
        {dirGlyph}
      </span>
      <span className="flex-1 tabular-nums text-[13px] font-medium text-[#1d1d1f]">
        {totalStr}
      </span>
      <span className="shrink-0 tabular-nums text-[11px] text-[#86868b]">
        {row.marketCount} mkt
      </span>
    </motion.div>
  )
}

export function SettlementTape() {
  const rows = useFloorTape()
  const batches = useFloorBatches()
  const nameById = useMemo(() => {
    const m = new Map<string, string>()
    for (const b of batches) m.set(b.sourceId, b.sourceName)
    return m
  }, [batches])

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-baseline justify-between border-b border-black/[0.06] px-4 py-3">
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#86868b]">
          Settlement Tape
        </h2>
        <span className="tabular-nums text-[10px] text-[#86868b]">{rows.length}</span>
      </div>
      <div className="relative flex-1 overflow-hidden">
        <div className="absolute inset-0 overflow-y-auto">
          {rows.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-[12px] text-[#86868b]">
                <span className="floor-breathe inline-block align-middle">·</span>
                <span className="ml-2 align-middle">Listening for the next settlement.</span>
              </p>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {rows.map(r => (
                <TapeRowView
                  key={r.id}
                  row={r}
                  sourceName={nameById.get(r.sourceId) ?? r.sourceId}
                />
              ))}
            </AnimatePresence>
          )}
        </div>
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-16"
          style={{
            background:
              'linear-gradient(to top, rgba(245,245,247,1), rgba(245,245,247,0))',
          }}
        />
      </div>
    </div>
  )
}
