'use client'

import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { useReducedMotion } from 'framer-motion'
import { formatUnits, parseUnits } from 'viem'
import { useAccount, useReadContract } from 'wagmi'
import { cn } from '@/lib/utils/cn'
import { VISION_VAULT_ABI } from '@/lib/contracts/vault-abi'
import { indexL3 } from '@/lib/wagmi'
import { useVaultDeposit } from '@/hooks/vaults/useVaultDeposit'
import { useVaultRedeem } from '@/hooks/vaults/useVaultRedeem'
import { useFundBranding } from '@/hooks/vaults/useFundBranding'
import { useVaultHistory } from '@/hooks/vaults/useVaultHistory'
import { WalletActionButton } from '@/components/ui/WalletActionButton'
import { SpringBackdrop, SpringModal, glass, ModalClose } from '@/components/ui/spring'
import type { VaultInfo } from '@/hooks/vaults/useVaults'

// ── Strategy pill colors ───────────────────────────────────

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

// ── Deterministic PRNG ─────────────────────────────────────

function hashAddress(addr: string): number {
  let h = 0
  for (let i = 0; i < addr.length; i++) h = ((h << 5) - h + addr.charCodeAt(i)) | 0
  return Math.abs(h)
}

function seededRng(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807 + 0) % 2147483647
    return (s & 0x7fffffff) / 0x7fffffff
  }
}

function generateNavHistory(currentNav: number, vaultAddr: string, points = 30): number[] {
  const start = 1.0
  const end = currentNav
  const rand = seededRng(hashAddress(vaultAddr))
  const data: number[] = []
  for (let i = 0; i < points; i++) {
    const t = i / (points - 1)
    const base = start + (end - start) * (t * t * (3 - 2 * t))
    const noiseMag = 0.012 * Math.sin(Math.PI * t)
    const noise = noiseMag * (rand() - 0.5) * 2
    data.push(base + noise)
  }
  data[data.length - 1] = end
  return data
}

// ── Monotone cubic spline (Fritsch-Carlson) ────────────────

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
  for (let i = 1; i < n - 1; i++) {
    tg.push(m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2)
  }
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
    const cp1x = (pts[i].x + d).toFixed(2)
    const cp1y = (pts[i].y + tg[i] * d).toFixed(2)
    const cp2x = (pts[i + 1].x - d).toFixed(2)
    const cp2y = (pts[i + 1].y - tg[i + 1] * d).toFixed(2)
    const ex = pts[i + 1].x.toFixed(2)
    const ey = pts[i + 1].y.toFixed(2)
    parts.push(`C${cp1x},${cp1y} ${cp2x},${cp2y} ${ex},${ey}`)
  }
  return parts.join(' ')
}

function estimatePathLength(pts: { x: number; y: number }[]): number {
  let len = 0
  for (let i = 1; i < pts.length; i++) {
    const ddx = pts[i].x - pts[i - 1].x
    const ddy = pts[i].y - pts[i - 1].y
    len += Math.sqrt(ddx * ddx + ddy * ddy)
  }
  return len * 1.12
}

// Unique ID per chart instance to prevent gradient/clip collisions
let navChartIdCounter = 0
function useChartId() {
  const ref = useRef<string>('')
  if (!ref.current) ref.current = `nav-${++navChartIdCounter}`
  return ref.current
}

// ── Interactive NAV Chart ──────────────────────────────────

const CHART_W = 400
const CHART_H = 160
const CHART_PAD_T = 16
const CHART_PAD_B = 28
const CHART_PAD_L = 40
const CHART_PAD_R = 8
const CHART_PLOT_W = CHART_W - CHART_PAD_L - CHART_PAD_R
const CHART_PLOT_H = CHART_H - CHART_PAD_T - CHART_PAD_B
const DRAW_DURATION = 900
const MONO_FONT = 'ui-monospace, SFMono-Regular, Menlo, monospace'

function NavChart({ data, vaultAddr, timestamps }: { data: number[]; vaultAddr: string; timestamps?: number[] }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const hoverGroupRef = useRef<SVGGElement>(null)
  const endpointRef = useRef<SVGGElement>(null)
  const chartId = useChartId()
  const reduced = useReducedMotion()
  const [entered, setEntered] = useState(false)

  useEffect(() => {
    if (reduced) {
      setEntered(true)
      return
    }
    const t = setTimeout(() => setEntered(true), 80)
    return () => clearTimeout(t)
  }, [reduced])

  const chart = useMemo(() => {
    const min = Math.min(...data)
    const max = Math.max(...data)
    const range = max - min || 0.001
    const isPositive = data[data.length - 1] >= data[0]
    const strokeColor = isPositive ? '#22c55e' : '#ef4444'

    const pts = data.map((v, i) => ({
      x: CHART_PAD_L + (i / (data.length - 1)) * CHART_PLOT_W,
      y: CHART_PAD_T + (1 - (v - min) / range) * CHART_PLOT_H,
    }))

    const linePath = monotonePath(pts)
    const lastPt = pts[pts.length - 1]
    const firstPt = pts[0]
    const bottomY = (CHART_PAD_T + CHART_PLOT_H).toFixed(2)
    const fillPath = `${linePath}L${lastPt.x.toFixed(2)},${bottomY}L${firstPt.x.toFixed(2)},${bottomY}Z`
    const pathLength = estimatePathLength(pts)
    const endPt = lastPt

    const gridYs = [0.25, 0.5, 0.75].map(
      (frac) => CHART_PAD_T + CHART_PLOT_H * (1 - frac),
    )

    // X-axis time labels — real timestamps if available, synthetic otherwise
    const xLabels = [0, 1, 2, 3].map(i => {
      let d: Date
      if (timestamps && timestamps.length > 0) {
        const idx = Math.round((i / 3) * (timestamps.length - 1))
        d = new Date(timestamps[idx])
      } else {
        d = new Date(Date.now() - (3 - i) * 2 * 24 * 60 * 60 * 1000)
      }
      return {
        label: d.toLocaleDateString('en', { weekday: 'short', day: 'numeric' }),
        x: CHART_PAD_L + (CHART_PLOT_W / 3) * i,
      }
    })

    return {
      min, max, range, isPositive, strokeColor,
      pts, linePath, fillPath, pathLength, endPt,
      gridYs, xLabels, POINTS: data.length,
    }
  }, [data])

  const updateHover = useCallback(
    (svgX: number | null) => {
      const hoverG = hoverGroupRef.current
      const endG = endpointRef.current
      if (!hoverG) return

      if (svgX === null) {
        hoverG.style.display = 'none'
        if (endG) endG.style.display = ''
        return
      }

      const frac = (svgX - CHART_PAD_L) / CHART_PLOT_W
      const idx = Math.max(0, Math.min(chart.POINTS - 1, Math.round(frac * (chart.POINTS - 1))))
      const pt = chart.pts[idx]
      const val = data[idx]

      const line = hoverG.children[0] as SVGLineElement
      if (line) {
        line.setAttribute('x1', String(pt.x))
        line.setAttribute('x2', String(pt.x))
      }

      const glow = hoverG.children[1] as SVGCircleElement
      const dot = hoverG.children[2] as SVGCircleElement
      if (glow) {
        glow.setAttribute('cx', String(pt.x))
        glow.setAttribute('cy', String(pt.y))
      }
      if (dot) {
        dot.setAttribute('cx', String(pt.x))
        dot.setAttribute('cy', String(pt.y))
      }

      const label = hoverG.children[3] as SVGTextElement
      if (label) {
        label.setAttribute('x', String(pt.x))
        label.setAttribute('y', String(CHART_PAD_T - 4))
        label.textContent = `$${val.toFixed(4)}`
      }

      hoverG.style.display = ''
      if (endG) endG.style.display = 'none'
    },
    [chart, data],
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const svg = svgRef.current
      if (!svg) return
      const rect = svg.getBoundingClientRect()
      const svgX = ((e.clientX - rect.left) / rect.width) * CHART_W
      if (svgX < CHART_PAD_L || svgX > CHART_W - CHART_PAD_R) {
        updateHover(null)
        return
      }
      updateHover(svgX)
    },
    [updateHover],
  )

  const handleMouseLeave = useCallback(() => updateHover(null), [updateHover])

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${CHART_W} ${CHART_H}`}
      className="w-full"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="NAV performance chart"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <defs>
        <linearGradient id={`${chartId}-fill`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={chart.strokeColor} stopOpacity={0.15} />
          <stop offset="70%" stopColor={chart.strokeColor} stopOpacity={0.04} />
          <stop offset="100%" stopColor={chart.strokeColor} stopOpacity={0} />
        </linearGradient>
        <clipPath id={`${chartId}-clip`}>
          <rect
            x={CHART_PAD_L}
            y={CHART_PAD_T}
            width={entered ? CHART_PLOT_W : 0}
            height={CHART_PLOT_H}
            style={{
              transition: reduced
                ? 'none'
                : `width ${DRAW_DURATION}ms cubic-bezier(0.16, 1, 0.3, 1)`,
            }}
          />
        </clipPath>
      </defs>

      {/* Grid lines */}
      {chart.gridYs.map((y, i) => (
        <line
          key={i}
          x1={CHART_PAD_L}
          y1={y}
          x2={CHART_W - CHART_PAD_R}
          y2={y}
          stroke="#E5E7EB"
          strokeWidth={0.5}
          strokeDasharray="2,4"
          shapeRendering="crispEdges"
          style={{
            opacity: entered ? 1 : 0,
            transition: reduced
              ? 'none'
              : `opacity 400ms ease ${200 + i * 60}ms`,
          }}
        />
      ))}

      {/* Area fill */}
      <path
        d={chart.fillPath}
        fill={`url(#${chartId}-fill)`}
        clipPath={`url(#${chartId}-clip)`}
        style={{
          opacity: entered ? 1 : 0,
          transition: reduced ? 'none' : 'opacity 600ms ease 300ms',
        }}
      />

      {/* Line stroke with dashoffset animation */}
      <path
        d={chart.linePath}
        fill="none"
        stroke={chart.strokeColor}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={chart.pathLength}
        strokeDashoffset={entered ? 0 : chart.pathLength}
        style={{
          transition: reduced
            ? 'none'
            : `stroke-dashoffset ${DRAW_DURATION}ms cubic-bezier(0.16, 1, 0.3, 1)`,
        }}
      />

      {/* Endpoint dot */}
      <g ref={endpointRef}>
        <circle
          cx={chart.endPt.x}
          cy={chart.endPt.y}
          r={entered ? 3.5 : 0}
          fill={chart.strokeColor}
          style={{
            transition: reduced
              ? 'none'
              : `r 300ms cubic-bezier(0.16, 1, 0.3, 1) ${DRAW_DURATION}ms`,
          }}
        />
      </g>

      {/* Hover group — direct DOM manipulation, hidden by default */}
      <g ref={hoverGroupRef} style={{ display: 'none' }}>
        <line
          x1={0}
          y1={CHART_PAD_T}
          x2={0}
          y2={CHART_PAD_T + CHART_PLOT_H}
          stroke="#9CA3AF"
          strokeWidth={0.75}
          strokeDasharray="2,2"
        />
        <circle cx={0} cy={0} r={7} fill={chart.strokeColor} fillOpacity={0.12} />
        <circle cx={0} cy={0} r={3.5} fill="white" stroke={chart.strokeColor} strokeWidth={2} />
        <text
          x={0}
          y={0}
          textAnchor="middle"
          fill={chart.strokeColor}
          fontSize={10}
          fontWeight={700}
          fontFamily={MONO_FONT}
        />
      </g>

      {/* Y-axis labels */}
      <text
        x={CHART_PAD_L - 4}
        y={CHART_PAD_T + 3}
        textAnchor="end"
        fill="#9CA3AF"
        fontSize={9}
        fontFamily={MONO_FONT}
        style={{
          opacity: entered ? 1 : 0,
          transition: reduced ? 'none' : 'opacity 400ms ease 300ms',
        }}
      >
        {chart.max.toFixed(4)}
      </text>
      <text
        x={CHART_PAD_L - 4}
        y={CHART_PAD_T + CHART_PLOT_H + 3}
        textAnchor="end"
        fill="#9CA3AF"
        fontSize={9}
        fontFamily={MONO_FONT}
        style={{
          opacity: entered ? 1 : 0,
          transition: reduced ? 'none' : 'opacity 400ms ease 360ms',
        }}
      >
        {chart.min.toFixed(4)}
      </text>

      {/* X-axis time labels */}
      {chart.xLabels.map((xl, i) => (
        <text
          key={i}
          x={xl.x}
          y={CHART_H - 4}
          textAnchor={i === 0 ? 'start' : i === chart.xLabels.length - 1 ? 'end' : 'middle'}
          fill="#9CA3AF"
          fontSize={9}
          fontFamily={MONO_FONT}
          style={{
            opacity: entered ? 1 : 0,
            transition: reduced ? 'none' : `opacity 400ms ease ${400 + i * 60}ms`,
          }}
        >
          {xl.label}
        </text>
      ))}
    </svg>
  )
}

// ── Vault Detail Modal ─────────────────────────────────────

interface VaultActionsProps {
  vault: VaultInfo
  onClose: () => void
}

export function VaultActions({ vault, onClose }: VaultActionsProps) {
  const { address } = useAccount()
  const [tab, setTab] = useState<'deposit' | 'withdraw'>('deposit')
  const [depositInput, setDepositInput] = useState('')
  const [withdrawInput, setWithdrawInput] = useState('')

  const branding = useFundBranding(vault.address)

  const {
    deposit,
    step: depositStep,
    isPending: depositPending,
    isConfirming: depositConfirming,
    error: depositError,
    reset: resetDeposit,
  } = useVaultDeposit()
  const {
    redeem,
    step: redeemStep,
    isPending: redeemPending,
    isConfirming: redeemConfirming,
    error: redeemError,
    reset: resetRedeem,
  } = useVaultRedeem()

  const { data: userShares } = useReadContract({
    address: vault.address,
    abi: VISION_VAULT_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: indexL3.id,
    query: { enabled: !!address },
  })
  const shares = (userShares as bigint | undefined) ?? 0n
  const sharesFloat = parseFloat(formatUnits(shares, 18))
  const userValue =
    vault.totalSupply > 0n && shares > 0n
      ? (Number(shares) / Number(vault.totalSupply)) *
        parseFloat(formatUnits(vault.totalAssets, 18))
      : 0

  const perfPercent = (vault.performanceSinceInception * 100).toFixed(2)
  const isPositive = vault.performanceSinceInception >= 0
  const feePercent = Number(vault.performanceFeeRate) / 1e16

  const { snapshots, hasHistory } = useVaultHistory(vault.address)

  const navHistory = useMemo(() => {
    if (hasHistory) return snapshots.map(s => s.nav)
    return null // No synthetic data — show nothing until real history exists
  }, [hasHistory, snapshots])

  const accentColor = branding?.color ?? '#000'
  const strategyKey = branding?.strategy ?? ''
  const strategyPill =
    STRATEGY_COLORS[strategyKey] ?? 'bg-zinc-500/10 text-zinc-700'

  const handleDeposit = () => {
    const amount = parseUnits(depositInput || '0', 18)
    if (amount <= 0n) return
    deposit(vault.address, amount)
  }

  const handleWithdraw = () => {
    const shareAmount = parseUnits(withdrawInput || '0', 18)
    if (shareAmount <= 0n) return
    redeem(vault.address, shareAmount)
  }

  const depositBusy =
    depositStep === 'approving' || depositStep === 'depositing'
  const redeemBusy = redeemStep === 'requesting'

  // Suppress unused-variable warnings from destructured hook values
  void depositPending
  void redeemPending

  return (
    <SpringBackdrop className={glass.backdrop} onClick={onClose}>
      <SpringModal
        className={`${glass.modal} max-w-lg w-full relative`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Color accent bar */}
        <div
          className="h-[3px] rounded-t-2xl"
          style={{ backgroundColor: accentColor }}
        />

        <div className="px-5 pb-6">
          <ModalClose onClick={onClose} className="absolute top-4 right-4" />

          {/* Header */}
          <div className="pt-6 mb-1">
            <div className="flex items-start justify-between gap-3 pr-8">
              <h2 className="text-title font-bold text-text-primary leading-tight">
                {branding?.name ?? vault.name}
              </h2>
              {strategyKey && (
                <span
                  className={cn(
                    'text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full whitespace-nowrap',
                    strategyPill,
                  )}
                >
                  {strategyKey.replace(/_/g, ' ')}
                </span>
              )}
            </div>
            {branding?.tagline && (
              <p className="text-xs text-text-secondary mt-1 line-clamp-1">
                {branding.tagline}
              </p>
            )}
            {branding?.source && (
              <p className="text-[10px] text-text-muted font-mono mt-0.5">
                {branding.source}
              </p>
            )}
          </div>

          {/* Interactive NAV chart when history exists, otherwise show NAV highlight */}
          {navHistory && navHistory.length >= 2 ? (
            <div className="mt-4 mb-5 -mx-1">
              <NavChart data={navHistory} vaultAddr={vault.address} timestamps={snapshots.map(s => s.ts)} />
            </div>
          ) : (
            <div className="mt-4 mb-5 rounded-md bg-black/[0.02] px-5 py-5 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted mb-1">NAV / Share</p>
                <p className="text-[28px] font-black font-mono tabular-nums text-text-primary leading-none">
                  ${vault.navPerShare.toFixed(4)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted mb-1">Since Inception</p>
                <p className={cn(
                  'text-[28px] font-black font-mono tabular-nums leading-none',
                  isPositive ? 'text-color-up' : 'text-color-down',
                )}>
                  {isPositive ? '+' : ''}{perfPercent}%
                </p>
              </div>
            </div>
          )}

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <StatBox label="TVL" value={`$${vault.tvlFormatted}`} />
            <StatBox
              label="NAV / Share"
              value={`$${vault.navPerShare.toFixed(4)}`}
            />
            <StatBox
              label="Performance"
              value={`${isPositive ? '+' : ''}${perfPercent}%`}
              valueColor={isPositive ? 'text-color-up' : 'text-color-down'}
            />
            <StatBox label="Fee" value={`${feePercent.toFixed(0)}% perf`} />
          </div>

          {/* User position */}
          {shares > 0n && (
            <div className="border border-border-light rounded-md p-4 mb-5">
              <p className="text-micro font-semibold uppercase tracking-[0.08em] text-text-muted mb-2">
                Your Position
              </p>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-text-secondary">Value</span>
                <span className="font-mono tabular-nums text-text-primary font-semibold">
                  $
                  {userValue.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Shares</span>
                <span className="font-mono tabular-nums text-text-secondary">
                  {sharesFloat.toLocaleString(undefined, {
                    maximumFractionDigits: 4,
                  })}
                </span>
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="flex border-b border-border-light mb-4" role="tablist">
            <button
              role="tab"
              aria-selected={tab === 'deposit'}
              onClick={() => {
                setTab('deposit')
                resetDeposit()
                resetRedeem()
              }}
              className={cn(
                'flex-1 py-2 text-sm font-semibold transition-colors',
                tab === 'deposit'
                  ? 'text-text-primary border-b-2 border-brand'
                  : 'text-text-muted hover:text-text-secondary',
              )}
            >
              Deposit
            </button>
            <button
              role="tab"
              aria-selected={tab === 'withdraw'}
              onClick={() => {
                setTab('withdraw')
                resetDeposit()
                resetRedeem()
              }}
              className={cn(
                'flex-1 py-2 text-sm font-semibold transition-colors',
                tab === 'withdraw'
                  ? 'text-text-primary border-b-2 border-brand'
                  : 'text-text-muted hover:text-text-secondary',
              )}
            >
              Withdraw
            </button>
          </div>

          {/* Deposit form */}
          {tab === 'deposit' && (
            <div className="space-y-3" role="tabpanel">
              <div>
                <label htmlFor="deposit-amount" className="text-xs text-text-muted block mb-1">
                  Amount (USDC)
                </label>
                <input
                  id="deposit-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={depositInput}
                  onChange={(e) => setDepositInput(e.target.value)}
                  className="w-full px-3 py-2 border border-border-light rounded-md bg-card text-text-primary
                             font-mono tabular-nums text-sm focus:outline-none focus:ring-1 focus:ring-brand"
                />
              </div>
              <WalletActionButton
                onClick={handleDeposit}
                disabled={depositBusy || depositConfirming || !depositInput}
                className="w-full py-2.5 bg-brand text-white text-sm font-bold rounded-md
                           hover:bg-brand-dark transition-colors disabled:opacity-50"
              >
                {depositStep === 'approving'
                  ? 'Approving...'
                  : depositStep === 'depositing'
                    ? 'Depositing...'
                    : depositConfirming
                      ? 'Confirming...'
                      : depositStep === 'done'
                        ? 'Deposit requested'
                        : 'Deposit'}
              </WalletActionButton>
              {depositError && (
                <p className="text-xs text-color-down">{depositError}</p>
              )}
              {depositStep === 'done' && (
                <p className="text-xs text-color-up">
                  Deposit request submitted. Shares will be claimable after
                  reconciliation.
                </p>
              )}
            </div>
          )}

          {/* Withdraw form */}
          {tab === 'withdraw' && (
            <div className="space-y-3" role="tabpanel">
              <div>
                <div className="flex justify-between mb-1">
                  <label htmlFor="withdraw-amount" className="text-xs text-text-muted">
                    Shares to redeem
                  </label>
                  {shares > 0n && (
                    <button
                      onClick={() => setWithdrawInput(formatUnits(shares, 18))}
                      className="text-xs text-brand hover:text-brand-dark transition-colors"
                    >
                      Max
                    </button>
                  )}
                </div>
                <input
                  id="withdraw-amount"
                  type="number"
                  min="0"
                  step="0.0001"
                  placeholder="0.00"
                  value={withdrawInput}
                  onChange={(e) => setWithdrawInput(e.target.value)}
                  className="w-full px-3 py-2 border border-border-light rounded-md bg-card text-text-primary
                             font-mono tabular-nums text-sm focus:outline-none focus:ring-1 focus:ring-brand"
                />
              </div>
              <WalletActionButton
                onClick={handleWithdraw}
                disabled={redeemBusy || redeemConfirming || !withdrawInput}
                className="w-full py-2.5 border-2 border-zinc-900 text-text-primary text-sm font-bold rounded-md
                           hover:bg-zinc-900 hover:text-white transition-colors disabled:opacity-50"
              >
                {redeemStep === 'requesting'
                  ? 'Requesting...'
                  : redeemConfirming
                    ? 'Confirming...'
                    : redeemStep === 'done'
                      ? 'Redeem requested'
                      : 'Request Redeem'}
              </WalletActionButton>
              {redeemError && (
                <p className="text-xs text-color-down">{redeemError}</p>
              )}
              {redeemStep === 'done' && (
                <p className="text-xs text-color-up">
                  Redeem request submitted. USDC will be claimable after
                  reconciliation.
                </p>
              )}
            </div>
          )}
        </div>
      </SpringModal>
    </SpringBackdrop>
  )
}

function StatBox({
  label,
  value,
  valueColor,
}: {
  label: string
  value: string
  valueColor?: string
}) {
  return (
    <div className="border border-border-light rounded-md px-3 py-2">
      <p className="text-micro font-semibold uppercase tracking-[0.08em] text-text-muted">
        {label}
      </p>
      <p
        className={cn(
          'text-sm font-bold font-mono tabular-nums',
          valueColor || 'text-text-primary',
        )}
      >
        {value}
      </p>
    </div>
  )
}
