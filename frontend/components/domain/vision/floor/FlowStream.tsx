'use client'

import { useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { formatUnits } from 'viem'
import { useFloorFlow, useFloorBatches, type FlowRow } from '@/hooks/vision/useFloorStream'

function stripPrefix(assetId: string): string {
  const idx = assetId.lastIndexOf(':')
  if (idx >= 0) return assetId.slice(idx + 1)
  return assetId.replace(/_/g, ' ')
}

function formatStake(weiStr: string): string {
  try {
    const n = Number(formatUnits(BigInt(weiStr || '0'), 18))
    if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`
    if (n >= 1) return `$${n.toFixed(0)}`
    if (n > 0) return `$${n.toFixed(2)}`
    return '$0'
  } catch {
    return '$0'
  }
}

interface FlowRowViewProps {
  row: FlowRow
  sourceShort: string
}

function FlowRowView({ row, sourceShort }: FlowRowViewProps) {
  const isUp = row.outcome === 'Up' || row.outcome === 'AllSameSide'
  const isDown = row.outcome === 'Down'
  const dir = isUp ? 'Y' : isDown ? 'N' : '·'
  const color = isUp ? '#0071e3' : isDown ? '#ff3b30' : '#86868b'

  let totalStr = '$0'
  try {
    const up = BigInt(row.upStakeStr || '0')
    const down = BigInt(row.downStakeStr || '0')
    totalStr = formatStake((up + down).toString())
  } catch {
    // ignore
  }

  const pct = (row.pctChangeBps / 100).toFixed(2)

  return (
    <motion.div
      initial={{ opacity: 0, x: 6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.14, ease: [0.25, 0.1, 0.3, 1] }}
      className="flex items-baseline gap-2 px-3 py-1"
    >
      <span
        className="w-[12px] shrink-0 text-center text-[12px] font-semibold"
        style={{ color }}
      >
        {dir}
      </span>
      <span className="tabular-nums text-[12px] font-medium text-[#1d1d1f]">{totalStr}</span>
      <span className="truncate text-[11px] text-[#1d1d1f]/80">{stripPrefix(row.assetId)}</span>
      <span className="ml-auto shrink-0 truncate text-[10px] uppercase tracking-[0.04em] text-[#86868b]">
        {sourceShort}
      </span>
      {Math.abs(row.pctChangeBps) > 0 && (
        <span
          className="shrink-0 tabular-nums text-[10px]"
          style={{ color: row.pctChangeBps > 0 ? '#0071e3' : '#ff3b30' }}
        >
          {row.pctChangeBps > 0 ? '+' : ''}
          {pct}%
        </span>
      )}
    </motion.div>
  )
}

export function FlowStream() {
  const rows = useFloorFlow()
  const batches = useFloorBatches()
  const nameById = useMemo(() => {
    const m = new Map<string, string>()
    for (const b of batches) m.set(b.sourceId, b.sourceName)
    return m
  }, [batches])

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-baseline justify-between border-b border-black/[0.06] px-3 py-3">
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#86868b]">
          Flow
        </h2>
        <span className="tabular-nums text-[10px] text-[#86868b]">{rows.length}</span>
      </div>
      <div className="relative flex-1 overflow-hidden">
        <div className="absolute inset-0 overflow-y-auto">
          {rows.length === 0 ? (
            <div className="flex h-full items-center justify-center px-4 text-center">
              <p className="text-[12px] text-[#86868b]">
                <span className="floor-breathe inline-block align-middle">·</span>
                <span className="ml-2 align-middle">Markets resolve here as batches settle.</span>
              </p>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {rows.map(r => (
                <FlowRowView
                  key={r.id}
                  row={r}
                  sourceShort={(nameById.get(r.sourceId) ?? r.sourceId).slice(0, 8)}
                />
              ))}
            </AnimatePresence>
          )}
        </div>
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-12"
          style={{
            background:
              'linear-gradient(to top, rgba(245,245,247,1), rgba(245,245,247,0))',
          }}
        />
      </div>
    </div>
  )
}
