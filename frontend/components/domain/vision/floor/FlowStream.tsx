'use client'

import { useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { formatUnits } from 'viem'
import { useFloorFlow, useFloorBatches, type FlowRow } from '@/hooks/vision/useFloorStream'
import { getAddressUrl } from '@/lib/utils/explorer'
import { VISION_ADDRESS } from '@/lib/vision/constants'

const PROOF_URL = getAddressUrl(VISION_ADDRESS, 'l3')

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

function formatTime(ms: number): string {
  if (!ms) return '--:--'
  const d = new Date(ms)
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  const s = String(d.getSeconds()).padStart(2, '0')
  return `${h}:${m}:${s}`
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
  const dirGlyph = isUp ? '▲' : isDown ? '▼' : '·'

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
    <motion.a
      href={PROOF_URL}
      target="_blank"
      rel="noopener noreferrer"
      title="Verify on the L3 explorer"
      initial={{ opacity: 0, x: 6 }}
      animate={{ opacity: 1, x: 0 }}
      whileHover={{ backgroundColor: 'rgba(0,113,227,0.06)' }}
      transition={{ duration: 0.16, ease: [0.25, 0.1, 0.3, 1] }}
      className="grid cursor-pointer grid-cols-[10px_auto_1fr_56px] items-baseline gap-2 px-4 py-1.5 no-underline"
    >
      <span
        className="h-1.5 w-1.5 self-center justify-self-center rounded-full"
        style={{ background: sourceBrandBg }}
        aria-hidden
      />
      <span className="flex items-baseline gap-1 tabular-nums text-[13px] font-medium text-[#1d1d1f]">
        <span style={{ color: dirColor }} aria-hidden>
          {dirGlyph}
        </span>
        {totalStr}
      </span>
      <span className="truncate text-[12px] text-[#6e6e73]">
        {sourceName}
        {assetLabel && (
          <>
            <span className="mx-1 text-[#d2d2d7]">·</span>
            <span className="text-[#86868b]">{assetLabel}</span>
          </>
        )}
      </span>
      <span className="justify-self-end tabular-nums text-[10px] text-[#86868b]">
        {formatTime(row.displayedAt)}
      </span>
    </motion.a>
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
            <div className="flex h-full items-center justify-center px-4 text-center">
              <p className="text-[12px] tracking-[-0.014em] text-[#6e6e73]">
                <span className="floor-breathe align-middle">·</span>
                <span className="ml-2 align-middle">Stake flows here in real time.</span>
              </p>
            </div>
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
            background: 'linear-gradient(to top, var(--apple-panel-2), rgba(251,251,253,0))',
          }}
        />
      </div>
    </div>
  )
}
