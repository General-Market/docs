'use client'

import { useMemo, useRef, useEffect, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils/cn'
import { useFundBranding } from '@/hooks/vaults/useFundBranding'
import type { VaultInfo } from '@/hooks/vaults/useVaults'

const STRATEGY_COLORS: Record<string, string> = {
  momentum: 'bg-emerald-500/10 text-emerald-700',
  contrarian: 'bg-rose-500/10 text-rose-700',
  bullish: 'bg-sky-500/10 text-sky-700',
  bearish: 'bg-red-500/10 text-red-700',
  mean_reversion: 'bg-violet-500/10 text-violet-700',
  regime: 'bg-amber-500/10 text-amber-700',
  cluster: 'bg-cyan-500/10 text-cyan-700',
  momentum_threshold: 'bg-emerald-500/10 text-emerald-700',
  time_of_day: 'bg-orange-500/10 text-orange-700',
  volatility_fade: 'bg-zinc-500/10 text-zinc-700',
}

const POINTS = 30
const W = 200
const H = 48

function seedFromAddress(addr: string): number {
  let h = 0
  for (let i = 0; i < addr.length; i++) h = ((h << 5) - h + addr.charCodeAt(i)) | 0
  return Math.abs(h)
}

function generateSparklineData(seed: number, perf: number): number[] {
  let s = seed
  const rand = () => {
    s = (s * 16807 + 0) % 2147483647
    return (s & 0x7fffffff) / 0x7fffffff
  }

  const endNav = 1 + perf
  const values: number[] = []
  for (let i = 0; i < POINTS; i++) {
    const t = i / (POINTS - 1)
    const trend = 1 + perf * t
    const noise = (rand() - 0.5) * 0.03 + (rand() - 0.5) * 0.015
    values.push(trend + noise)
  }
  values[POINTS - 1] = endNav
  return values
}

function monotonePath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return ''
  if (pts.length === 2) return `M${pts[0].x},${pts[0].y}L${pts[1].x},${pts[1].y}`
  const n = pts.length
  const dx: number[] = []
  const dy: number[] = []
  const m: number[] = []
  for (let i = 0; i < n - 1; i++) {
    dx.push(pts[i + 1].x - pts[i].x)
    dy.push(pts[i + 1].y - pts[i].y)
    m.push(dy[i] / dx[i])
  }
  const tg: number[] = [m[0]]
  for (let i = 1; i < n - 1; i++)
    tg.push(m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2)
  tg.push(m[n - 2])
  for (let i = 0; i < n - 1; i++) {
    if (Math.abs(m[i]) < 1e-6) {
      tg[i] = 0
      tg[i + 1] = 0
      continue
    }
    const a = tg[i] / m[i]
    const b = tg[i + 1] / m[i]
    const s = a * a + b * b
    if (s > 9) {
      const t = 3 / Math.sqrt(s)
      tg[i] = t * a * m[i]
      tg[i + 1] = t * b * m[i]
    }
  }
  const parts = [`M${pts[0].x.toFixed(2)},${pts[0].y.toFixed(2)}`]
  for (let i = 0; i < n - 1; i++) {
    const d = dx[i] / 3
    parts.push(
      `C${(pts[i].x + d).toFixed(2)},${(pts[i].y + tg[i] * d).toFixed(2)} ${(pts[i + 1].x - d).toFixed(2)},${(pts[i + 1].y - tg[i + 1] * d).toFixed(2)} ${pts[i + 1].x.toFixed(2)},${pts[i + 1].y.toFixed(2)}`,
    )
  }
  return parts.join(' ')
}

function estimatePathLength(pts: { x: number; y: number }[]): number {
  let len = 0
  for (let i = 1; i < pts.length; i++) {
    const dxSeg = pts[i].x - pts[i - 1].x
    const dySeg = pts[i].y - pts[i - 1].y
    len += Math.sqrt(dxSeg * dxSeg + dySeg * dySeg)
  }
  return len * 1.12
}

interface SparklineData {
  linePath: string
  fillPath: string
  pathLength: number
  endPt: { x: number; y: number }
}

function computeSparkline(values: number[]): SparklineData {
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 0.01
  const pad = range * 0.15

  const pts = values.map((v, i) => ({
    x: (i / (POINTS - 1)) * W,
    y: H - ((v - (min - pad)) / (range + 2 * pad)) * H,
  }))

  const linePath = monotonePath(pts)
  const fillPath = `${linePath}L${W.toFixed(2)},${H.toFixed(2)}L${pts[0].x.toFixed(2)},${H.toFixed(2)}Z`
  const pathLength = estimatePathLength(pts)
  const endPt = pts[pts.length - 1]

  return { linePath, fillPath, pathLength, endPt }
}

const DRAW_MS = 700
const DOT_DELAY_MS = DRAW_MS
const DOT_MS = 300
const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)'
const BOUNCE = 'cubic-bezier(0.34, 1.56, 0.64, 1)'

interface VaultCardProps {
  vault: VaultInfo
  onClick: () => void
}

export function VaultCard({ vault, onClick }: VaultCardProps) {
  const branding = useFundBranding(vault.address)
  const reduced = useReducedMotion()
  const cardRef = useRef<HTMLDivElement>(null)
  const [entered, setEntered] = useState(false)

  const perfPercent = (vault.performanceSinceInception * 100).toFixed(2)
  const isPositive = vault.performanceSinceInception >= 0
  const color = isPositive ? 'var(--color-up)' : 'var(--color-down)'
  const gradientId = `spark-${vault.address.slice(2, 8)}`
  const clipId = `clip-${vault.address.slice(2, 8)}`

  const sparkline = useMemo(() => {
    const seed = seedFromAddress(vault.address)
    const values = generateSparklineData(seed, vault.performanceSinceInception)
    return computeSparkline(values)
  }, [vault.address, vault.performanceSinceInception])

  useEffect(() => {
    if (reduced) {
      setEntered(true)
      return
    }
    const el = cardRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setEntered(true)
          observer.unobserve(el)
        }
      },
      { threshold: 0.3 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [reduced])

  return (
    <div
      ref={cardRef}
      onClick={onClick}
      className="bg-card border border-border-light rounded-md cursor-pointer
                 hover:bg-card-hover hover:shadow-card-hover transition-all overflow-hidden
                 w-full"
    >
      <div
        className="h-[3px]"
        style={{ backgroundColor: branding?.color ?? 'var(--color-brand)' }}
      />

      <div className="p-3.5">
        <div className="flex items-center justify-between gap-1.5 mb-2">
          <span className="font-bold text-text-primary text-sm leading-tight truncate min-w-0">
            {branding?.name ?? vault.name}
          </span>
          {branding && (
            <span
              className={cn(
                'shrink-0 text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full whitespace-nowrap',
                STRATEGY_COLORS[branding.strategy] ??
                  'bg-black/5 text-text-secondary',
              )}
            >
              {branding.strategy}
            </span>
          )}
        </div>

        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full mb-2.5"
          style={{ height: H }}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.15} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
            <clipPath id={clipId}>
              <rect
                x={0}
                y={0}
                width={entered ? W : 0}
                height={H}
                style={{
                  transition: reduced
                    ? 'none'
                    : `width ${DRAW_MS}ms ${EASE}`,
                }}
              />
            </clipPath>
          </defs>

          <path
            d={sparkline.fillPath}
            fill={`url(#${gradientId})`}
            clipPath={`url(#${clipId})`}
            style={{
              opacity: entered ? 1 : 0,
              transition: reduced ? 'none' : 'opacity 400ms ease 200ms',
            }}
          />

          <path
            d={sparkline.linePath}
            fill="none"
            stroke={color}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={sparkline.pathLength}
            strokeDashoffset={entered ? 0 : sparkline.pathLength}
            style={{
              transition: reduced
                ? 'none'
                : `stroke-dashoffset ${DRAW_MS}ms ${EASE}`,
            }}
          />

          <circle
            cx={sparkline.endPt.x}
            cy={sparkline.endPt.y}
            r={entered ? 2.5 : 0}
            fill={color}
            style={{
              transition: reduced
                ? 'none'
                : `r ${DOT_MS}ms ${BOUNCE} ${DOT_DELAY_MS}ms`,
            }}
          />
        </svg>

        <div className="flex items-center justify-between text-[11px] font-mono tabular-nums">
          <div className="flex flex-col">
            <span className="text-[9px] font-semibold uppercase tracking-[0.06em] text-text-muted leading-tight">
              TVL
            </span>
            <span className="font-bold text-black">
              ${vault.tvlFormatted}
            </span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[9px] font-semibold uppercase tracking-[0.06em] text-text-muted leading-tight">
              Perf
            </span>
            <span
              className={cn(
                isPositive ? 'text-color-up' : 'text-color-down',
              )}
            >
              {isPositive ? '+' : ''}
              {perfPercent}%
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
