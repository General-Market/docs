'use client'

import { useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { formatUnits } from 'viem'
import { useFloorFlow, useFloorBatches, type FlowRow } from '@/hooks/vision/useFloorStream'

function stripPrefix(assetId: string): string {
  if (!assetId || assetId === '·') return ''
  const idx = assetId.lastIndexOf(':')
  if (idx >= 0) return assetId.slice(idx + 1)
  return assetId.replace(/_/g, ' ')
}

function formatStake(weiStr: string): string {
  try {
    const n = Number(formatUnits(BigInt(weiStr || '0'), 18))
    if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`
    if (n >= 100) return `$${n.toFixed(0)}`
    if (n >= 1) return `$${n.toFixed(1)}`
    if (n > 0) return `$${n.toFixed(2)}`
    return '$0'
  } catch {
    return '$0'
  }
}

interface FlowRowViewProps {
  row: FlowRow
  sourceName: string
  sourceBrandBg: string
}

function FlowRowView({ row, sourceName, sourceBrandBg }: FlowRowViewProps) {
  const isUp = row.outcome === 'Up' || row.outcome === 'AllSameSide'
  const isDown = row.outcome === 'Down'
  const dirColor = isUp ? '#0071e3' : isDown ? '#ff3b30' : '#86868b'

  let totalStr = '$0'
  try {
    const up = BigInt(row.upStakeStr || '0')
    const down = BigInt(row.downStakeStr || '0')
    totalStr = formatStake((up + down).toString())
  } catch {
    // ignore
  }

  const assetLabel = stripPrefix(row.assetId)

  return (
    <motion.div
      initial={{ opacity: 0, x: 6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.16, ease: [0.25, 0.1, 0.3, 1] }}
      className="flex items-baseline gap-2 px-4 py-1.5"
    >
      <span
        className="h-1.5 w-1.5 shrink-0 self-center rounded-full"
        style={{ background: dirColor }}
        aria-hidden
      />
      <span className="tabular-nums text-[13px] font-medium text-[#1d1d1f]">{totalStr}</span>
      <span
        className="inline-flex h-1.5 w-1.5 shrink-0 self-center rounded-full"
        style={{ background: sourceBrandBg, opacity: 0.7 }}
        aria-hidden
      />
      <span className="truncate text-[12px] text-[#6e6e73]">
        {sourceName}
        {assetLabel && (
          <>
            <span className="mx-1 text-[#d2d2d7]">·</span>
            <span className="text-[#86868b]">{assetLabel}</span>
          </>
        )}
      </span>
    </motion.div>
  )
}

function GhostFlowRow({ delay }: { delay: number }) {
  return (
    <div
      className="floor-empty-shimmer flex items-baseline gap-2 px-4 py-1.5"
      style={{ animationDelay: `${delay}s` }}
    >
      <span className="h-1.5 w-1.5 shrink-0 self-center rounded-full bg-black/[0.05]" />
      <span className="h-2 w-10 shrink-0 rounded-[2px] bg-black/[0.04]" />
      <span className="h-1.5 w-1.5 shrink-0 self-center rounded-full bg-black/[0.05]" />
      <span className="h-2 w-[110px] shrink-0 rounded-[2px] bg-black/[0.04]" />
    </div>
  )
}

export function FlowStream() {
  const rows = useFloorFlow()
  const batches = useFloorBatches()
  const sourceInfo = useMemo(() => {
    const m = new Map<string, { name: string; brand: string }>()
    for (const b of batches) m.set(b.sourceId, { name: b.sourceName, brand: b.sourceBrandBg })
    return m
  }, [batches])

  return (
    <div className="flex h-full flex-col">
      <div
        className="flex items-baseline justify-between px-5 py-4"
        style={{ borderBottom: '1px solid var(--apple-border)' }}
      >
        <h2 className="floor-pane-header">Flow</h2>
        <span className="tabular-nums text-[11px] text-[#86868b]">{rows.length}</span>
      </div>
      <div className="relative flex-1 overflow-hidden">
        <div className="absolute inset-0 overflow-y-auto py-2">
          {rows.length === 0 ? (
            <>
              <GhostFlowRow delay={0} />
              <GhostFlowRow delay={0.4} />
              <GhostFlowRow delay={0.9} />
              <GhostFlowRow delay={1.6} />
              <GhostFlowRow delay={2.1} />
              <GhostFlowRow delay={2.8} />
              <GhostFlowRow delay={3.5} />
              <div className="px-5 pt-8 text-center">
                <p
                  className="text-[13px] tracking-[-0.014em] text-[#6e6e73]"
                  style={{ fontFamily: 'var(--apple-font-text)' }}
                >
                  <span className="floor-breathe align-middle">·</span>
                  <span className="ml-2 align-middle">Stake flows here in real time.</span>
                </p>
              </div>
            </>
          ) : (
            <AnimatePresence initial={false}>
              {rows.map(r => {
                const info = sourceInfo.get(r.sourceId)
                return (
                  <FlowRowView
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
          className="pointer-events-none absolute inset-x-0 bottom-0 h-16"
          style={{
            background:
              'linear-gradient(to top, var(--apple-panel-2), rgba(251,251,253,0))',
          }}
        />
      </div>
    </div>
  )
}
