'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { formatUnits } from 'viem'
import {
  useFloorFlow,
  useFloorBatches,
  type FlowRow,
  type FloorBatch,
} from '@/hooks/vision/useFloorStream'

function formatUSD(weiStr: string): string {
  try {
    const n = Number(formatUnits(BigInt(weiStr || '0'), 18))
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
    if (n >= 10_000) return `$${(n / 1_000).toFixed(0)}k`
    if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`
    if (n >= 100) return `$${n.toFixed(0)}`
    if (n >= 1) return `$${n.toFixed(1)}`
    if (n > 0) return `$${n.toFixed(2)}`
    return '$0'
  } catch {
    return '$0'
  }
}

function formatBig(weiStr: string): string {
  try {
    const n = Number(formatUnits(BigInt(weiStr || '0'), 18))
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
    if (n >= 10_000) return `$${(n / 1_000).toFixed(1)}k`
    if (n >= 1_000) return `$${(n / 1_000).toFixed(2)}k`
    return `$${Math.round(n).toLocaleString()}`
  } catch {
    return '$0'
  }
}

function safeBigInt(s: string): bigint {
  try {
    return BigInt(s || '0')
  } catch {
    return 0n
  }
}

interface HotRowProps {
  row: FlowRow
  sourceName: string
  sourceBrandBg: string
}

function HotRow({ row, sourceName, sourceBrandBg }: HotRowProps) {
  const total = safeBigInt(row.upStakeStr) + safeBigInt(row.downStakeStr)
  const isUp = row.outcome === 'Up' || row.outcome === 'AllSameSide'
  const dirColor = isUp ? '#0071e3' : '#ff3b30'
  const dirGlyph = isUp ? '▲' : '▼'

  return (
    <motion.div
      initial={{ opacity: 0, y: -12, backgroundColor: `${dirColor}1f` }}
      animate={{ opacity: 1, y: 0, backgroundColor: 'rgba(255,255,255,0)' }}
      transition={{
        opacity: { duration: 0.22, ease: [0.25, 0.1, 0.3, 1] },
        y: { duration: 0.22, ease: [0.25, 0.1, 0.3, 1] },
        backgroundColor: { duration: 0.8, ease: [0.25, 0.1, 0.3, 1], delay: 0.05 },
      }}
      className="flex items-baseline gap-4 px-8 py-3"
      style={{ borderBottom: '1px solid var(--apple-border)' }}
    >
      <span
        className="inline-flex h-2.5 w-2.5 shrink-0 self-center rounded-full"
        style={{ background: sourceBrandBg }}
        aria-hidden
      />
      <span
        className="flex-1 truncate text-[16px] tracking-[-0.016em] text-[#1d1d1f]"
        style={{ fontFamily: 'var(--apple-font-text)' }}
      >
        {sourceName}
      </span>
      <span
        className="tabular-nums text-[16px] font-semibold text-[#1d1d1f]"
        style={{ fontFamily: 'var(--apple-font-display)' }}
      >
        {formatUSD(total.toString())}
      </span>
      <span
        className="w-[16px] shrink-0 text-center text-[14px] font-medium tabular-nums"
        style={{ color: dirColor }}
      >
        {dirGlyph}
      </span>
    </motion.div>
  )
}

interface PoolBarProps {
  batch: FloorBatch
  maxTvl: bigint
  activeAt: number
}

function PoolBar({ batch, maxTvl, activeAt }: PoolBarProps) {
  const tvl = safeBigInt(batch.tvlStr)
  const widthPct = maxTvl > 0n ? Number((tvl * 1000n) / maxTvl) / 10 : 0
  const tvlStr = formatUSD(batch.tvlStr)
  const sinceActive = activeAt > 0 ? Date.now() - activeAt : Infinity
  const glowing = sinceActive < 1500

  return (
    <div className="relative">
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span
          className="flex min-w-0 items-center gap-2 text-[13px] tracking-[-0.014em] text-[#1d1d1f]"
          style={{ fontFamily: 'var(--apple-font-text)' }}
        >
          <span
            className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ background: batch.sourceBrandBg }}
            aria-hidden
          />
          <span className="truncate">{batch.sourceName}</span>
        </span>
        <span className="shrink-0 tabular-nums text-[13px] font-medium text-[#1d1d1f]">
          {tvlStr}
        </span>
      </div>
      <div className="relative h-[6px] overflow-hidden rounded-full bg-black/[0.04]">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            background: batch.sourceBrandBg,
            opacity: 0.85,
            boxShadow: glowing ? `0 0 0 2px ${batch.sourceBrandBg}33` : 'none',
          }}
          animate={{ width: `${widthPct}%` }}
          transition={{ duration: 0.9, ease: [0.25, 0.1, 0.3, 1] }}
        />
      </div>
    </div>
  )
}

export function PulseFeed() {
  const flow = useFloorFlow()
  const batches = useFloorBatches()
  const [tick, setTick] = useState(0)

  // Drive a 1Hz tick so the "in last minute" rolling window stays accurate
  useEffect(() => {
    const i = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(i)
  }, [])

  const now = Date.now()

  const sourceInfo = useMemo(() => {
    const m = new Map<string, { name: string; brand: string }>()
    for (const b of batches) m.set(b.sourceId, { name: b.sourceName, brand: b.sourceBrandBg })
    return m
  }, [batches])

  // ── Hero metrics ──
  const recent60s = useMemo(() => {
    return flow.filter(r => now - r.displayedAt < 60_000)
  }, [flow, tick])

  const stakeLast60s = useMemo(() => {
    let total = 0n
    for (const r of recent60s) {
      total += safeBigInt(r.upStakeStr) + safeBigInt(r.downStakeStr)
    }
    return total
  }, [recent60s])

  const totalPool = useMemo(() => {
    let total = 0n
    for (const b of batches) total += safeBigInt(b.tvlStr)
    return total
  }, [batches])

  // ── Hot stream — last 5 flow rows, big rows ──
  const hot = flow.slice(0, 6)

  // ── Top pools — bars ──
  const lastActivityAt = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of flow.slice(0, 60)) {
      const cur = map.get(r.sourceId) ?? 0
      if (r.displayedAt > cur) map.set(r.sourceId, r.displayedAt)
    }
    return map
  }, [flow])

  const top = useMemo(() => {
    return batches
      .slice()
      .sort((a, b) => {
        const at = safeBigInt(a.tvlStr)
        const bt = safeBigInt(b.tvlStr)
        return at > bt ? -1 : at < bt ? 1 : 0
      })
      .slice(0, 10)
  }, [batches])

  const maxTopTvl = top.length > 0 ? safeBigInt(top[0].tvlStr) : 0n

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div
        className="flex items-baseline justify-between px-8 py-4"
        style={{ borderBottom: '1px solid var(--apple-border)' }}
      >
        <h2 className="floor-pane-header">Pulse</h2>
        <span className="tabular-nums text-[11px] text-[#86868b]">
          {recent60s.length} bets · 60s
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* ── Hero ── */}
        <section className="px-8 py-7">
          <p className="floor-pane-header">In the last minute</p>
          <div className="mt-3 flex items-baseline gap-4">
            <span
              className="text-[48px] font-semibold leading-none tracking-[-0.022em] tabular-nums text-[#1d1d1f]"
              style={{ fontFamily: 'var(--apple-font-display)' }}
            >
              {formatBig(stakeLast60s.toString())}
            </span>
            <span className="text-[15px] text-[#6e6e73]">placed</span>
          </div>
          <div className="mt-3 flex flex-wrap items-baseline gap-x-5 gap-y-1 text-[13px] text-[#6e6e73]">
            <span>
              <span className="tabular-nums text-[#1d1d1f]">{batches.length}</span> live markets
            </span>
            <span className="text-[#d2d2d7]">·</span>
            <span>
              <span className="tabular-nums text-[#1d1d1f]">
                {formatBig(totalPool.toString())}
              </span>{' '}
              total pool
            </span>
            <span className="text-[#d2d2d7]">·</span>
            <span>
              <span className="tabular-nums text-[#1d1d1f]">{flow.length}</span> bets shown
            </span>
          </div>
        </section>

        {/* ── Hot stream ── */}
        <section style={{ borderTop: '1px solid var(--apple-border)' }}>
          <div
            className="flex items-baseline justify-between px-8 py-3"
            style={{ borderBottom: '1px solid var(--apple-border)' }}
          >
            <h3 className="floor-pane-header">Hottest right now</h3>
            <span className="tabular-nums text-[11px] text-[#86868b]">live</span>
          </div>
          <div>
            <AnimatePresence initial={false}>
              {hot.length === 0 ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="px-8 py-6 text-[14px] text-[#86868b]"
                >
                  <span className="floor-breathe align-middle">·</span>
                  <span className="ml-2 align-middle">Waiting for the first bet.</span>
                </motion.div>
              ) : (
                hot.map(r => {
                  const info = sourceInfo.get(r.sourceId)
                  return (
                    <HotRow
                      key={r.id}
                      row={r}
                      sourceName={info?.name ?? r.sourceId}
                      sourceBrandBg={info?.brand ?? '#1d1d1f'}
                    />
                  )
                })
              )}
            </AnimatePresence>
          </div>
        </section>

        {/* ── Top pools ── */}
        <section style={{ borderTop: '1px solid var(--apple-border)' }}>
          <div className="flex items-baseline justify-between px-8 pt-5 pb-3">
            <h3 className="floor-pane-header">Top pools</h3>
            <span className="tabular-nums text-[11px] text-[#86868b]">{top.length}</span>
          </div>
          <div className="space-y-2.5 px-8 pb-8">
            {top.map(b => (
              <PoolBar
                key={`${b.sourceId}-${b.batchId}`}
                batch={b}
                maxTvl={maxTopTvl}
                activeAt={lastActivityAt.get(b.sourceId) ?? 0}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
