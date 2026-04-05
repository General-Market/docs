'use client'

import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { useReducedMotion } from 'framer-motion'
import { useTranslations } from 'next-intl'
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
import { SpringBackdrop, SpringModal, glass } from '@/components/ui/spring'
import type { VaultInfo } from '@/hooks/vaults/useVaults'

// ── Strategy pill colors ───────────────────────────────────

const STRATEGY_COLOR_HEX: Record<string, string> = {
  momentum: '#059669',
  contrarian: '#e11d48',
  bullish: '#0284c7',
  bearish: '#dc2626',
  mean_reversion: '#7c3aed',
  regime: '#d97706',
  cluster: '#0891b2',
  momentum_threshold: '#059669',
  time_of_day: '#ea580c',
  volatility_fade: '#71717a',
  adoption_curve: '#7c3aed',
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

const CHART_W = 500
const CHART_H = 300
const CHART_PAD_T = 16
const CHART_PAD_B = 32
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

// ── Trading Desk Modal ────────────────────────────────────

interface VaultEntry {
  fund: any
  vault: VaultInfo
}

interface VaultActionsProps {
  vaults: VaultEntry[]
  initialIndex: number
  onClose: () => void
}

function formatTvlCompact(tvl: number) {
  if (tvl >= 1_000_000) return `$${(tvl / 1_000_000).toFixed(2)}M`
  if (tvl >= 1_000) return `$${(tvl / 1_000).toFixed(1)}K`
  return `$${tvl.toFixed(0)}`
}

function VaultDetailPanel({ vault, fund }: { vault: VaultInfo; fund: any }) {
  const t = useTranslations('vision')
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
  const tvl = parseFloat(formatUnits(vault.totalAssets, 18))

  const { snapshots, hasHistory } = useVaultHistory(vault.address)
  const navHistory = useMemo(() => {
    if (hasHistory) return snapshots.map(s => s.nav)
    return generateNavHistory(vault.navPerShare, vault.address)
  }, [hasHistory, snapshots, vault.navPerShare, vault.address])

  const strategyKey = branding?.strategy ?? fund.strategy ?? ''
  const strategyColor = STRATEGY_COLOR_HEX[strategyKey] ?? '#999'

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

  const depositBusy = depositStep === 'approving' || depositStep === 'depositing'
  const redeemBusy = redeemStep === 'requesting'
  void depositPending
  void redeemPending

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <div className="bg-[#1A1A1A] px-4 py-1.5">
        <span className="text-[10px] font-bold tracking-[0.12em] text-white/80 uppercase">Strategy Detail</span>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5">
        <h2 className="text-[20px] font-extrabold text-text-primary leading-tight">
          {branding?.name ?? vault.name}
        </h2>
        {strategyKey && (
          <div className="text-[10px] font-bold tracking-[0.06em] uppercase mt-1" style={{ color: strategyColor }}>
            {strategyKey.replace(/_/g, ' ')}
          </div>
        )}
        {(branding?.tagline ?? fund.tagline) && (
          <p className="text-[12px] text-text-secondary leading-relaxed mt-3 mb-5">
            {branding?.tagline ?? fund.tagline}
          </p>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-4 py-3 border-y border-border-light mb-5">
          <div>
            <div className="text-[9px] font-semibold uppercase tracking-[0.1em] text-text-muted mb-1">TVL</div>
            <div className="font-mono text-[14px] font-bold tabular-nums text-text-primary">{formatTvlCompact(tvl)}</div>
          </div>
          <div>
            <div className="text-[9px] font-semibold uppercase tracking-[0.1em] text-text-muted mb-1">NAV</div>
            <div className="font-mono text-[14px] font-bold tabular-nums text-text-primary">${vault.navPerShare.toFixed(4)}</div>
          </div>
          <div>
            <div className="text-[9px] font-semibold uppercase tracking-[0.1em] text-text-muted mb-1">Perf</div>
            <div className={cn('font-mono text-[14px] font-bold tabular-nums', isPositive ? 'text-color-up' : 'text-color-down')}>
              {isPositive ? '+' : ''}{perfPercent}%
            </div>
          </div>
          <div>
            <div className="text-[9px] font-semibold uppercase tracking-[0.1em] text-text-muted mb-1">Fee</div>
            <div className="font-mono text-[14px] font-bold tabular-nums text-text-primary">{feePercent.toFixed(0)}%</div>
          </div>
        </div>

        {/* Chart */}
        <div className="mb-4">
          <NavChart data={navHistory} vaultAddr={vault.address} timestamps={hasHistory ? snapshots.map(s => s.ts) : undefined} />
        </div>

        {/* User position */}
        {shares > 0n && (
          <div className="border-y border-border-light py-3 mb-4">
            <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-text-muted mb-2">
              {t('vaults.your_position')}
            </p>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-text-secondary">{t('vaults.value')}</span>
              <span className="font-mono tabular-nums text-text-primary font-semibold">
                ${userValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">{t('vaults.shares')}</span>
              <span className="font-mono tabular-nums text-text-secondary">
                {sharesFloat.toLocaleString(undefined, { maximumFractionDigits: 4 })}
              </span>
            </div>
          </div>
        )}

        {/* Deposit/Withdraw form (visible when tab selected) */}
        {tab !== 'deposit' ? null : (
          <div className="space-y-3 mb-4">
            <label htmlFor="deposit-amount" className="text-[10px] font-semibold uppercase tracking-[0.06em] text-text-muted block">
              {t('vaults.amount_usdc')}
            </label>
            <input
              id="deposit-amount"
              type="number"
              min="0"
              step="0.01"
              placeholder={t('vaults.amount_placeholder')}
              value={depositInput}
              onChange={(e) => setDepositInput(e.target.value)}
              className="w-full px-3 py-2 border border-border-light rounded bg-white text-text-primary
                         font-mono tabular-nums text-sm focus:outline-none focus:ring-1 focus:ring-[#1A1A1A]"
            />
            {depositError && <p className="text-xs text-color-down">{depositError}</p>}
            {depositStep === 'done' && <p className="text-xs text-color-up">{t('vaults.deposit_success')}</p>}
          </div>
        )}
        {tab !== 'withdraw' ? null : (
          <div className="space-y-3 mb-4">
            <div className="flex justify-between">
              <label htmlFor="withdraw-amount" className="text-[10px] font-semibold uppercase tracking-[0.06em] text-text-muted">
                {t('vaults.shares_to_redeem')}
              </label>
              {shares > 0n && (
                <button onClick={() => setWithdrawInput(formatUnits(shares, 18))} className="text-xs text-[#00A36C] hover:text-[#008f5d] transition-colors">
                  {t('vaults.max')}
                </button>
              )}
            </div>
            <input
              id="withdraw-amount"
              type="number"
              min="0"
              step="0.0001"
              placeholder={t('vaults.amount_placeholder')}
              value={withdrawInput}
              onChange={(e) => setWithdrawInput(e.target.value)}
              className="w-full px-3 py-2 border border-border-light rounded bg-white text-text-primary
                         font-mono tabular-nums text-sm focus:outline-none focus:ring-1 focus:ring-[#1A1A1A]"
            />
            {redeemError && <p className="text-xs text-color-down">{redeemError}</p>}
            {redeemStep === 'done' && <p className="text-xs text-color-up">{t('vaults.redeem_success')}</p>}
          </div>
        )}
      </div>

      {/* Bottom action buttons */}
      <div className="px-5 py-3 border-t border-border-light flex gap-3 shrink-0">
        <WalletActionButton
          onClick={() => { setTab('deposit'); if (tab === 'deposit') handleDeposit() }}
          disabled={tab === 'deposit' && (depositBusy || depositConfirming || !depositInput)}
          className="flex-1 py-2.5 bg-[#00A36C] text-white text-[12px] font-bold rounded
                     hover:bg-[#008f5d] transition-colors disabled:opacity-50"
        >
          {depositStep === 'approving' ? t('vaults.approving')
            : depositStep === 'depositing' ? t('vaults.depositing')
            : depositConfirming ? t('vaults.confirming')
            : depositStep === 'done' ? t('vaults.deposit_requested')
            : t('vaults.deposit')}
        </WalletActionButton>
        <WalletActionButton
          onClick={() => { setTab('withdraw'); if (tab === 'withdraw') handleWithdraw() }}
          disabled={tab === 'withdraw' && (redeemBusy || redeemConfirming || !withdrawInput)}
          className="flex-1 py-2.5 border border-[#1A1A1A] text-text-primary text-[12px] font-bold rounded
                     hover:bg-[#1A1A1A] hover:text-white transition-colors disabled:opacity-50"
        >
          {redeemStep === 'requesting' ? t('vaults.requesting')
            : redeemConfirming ? t('vaults.confirming')
            : redeemStep === 'done' ? t('vaults.redeem_requested')
            : t('vaults.withdraw')}
        </WalletActionButton>
      </div>
    </div>
  )
}

export function VaultActions({ vaults, initialIndex, onClose }: VaultActionsProps) {
  const [selectedIdx, setSelectedIdx] = useState(initialIndex)
  const featured = vaults[0]
  const current = vaults[selectedIdx]

  const featuredTvl = parseFloat(formatUnits(featured.vault.totalAssets, 18))
  const featuredPerf = (featured.vault.performanceSinceInception * 100).toFixed(2)
  const featuredIsPos = featured.vault.performanceSinceInception >= 0
  const featuredFee = Number(featured.vault.performanceFeeRate) / 1e16
  const featuredStratKey = featured.fund.strategy ?? ''
  const featuredStratColor = STRATEGY_COLOR_HEX[featuredStratKey] ?? '#999'

  return (
    <SpringBackdrop className={glass.backdrop} onClick={onClose}>
      <SpringModal
        className="bg-white rounded-lg shadow-2xl w-[95vw] max-w-[1060px] max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top panel: featured strategy */}
        <div className="shrink-0 border-b border-[#E0E0E0]">
          <div className="bg-[#1A1A1A] px-4 py-1.5 flex items-center justify-between rounded-t-lg">
            <span className="text-[10px] font-bold tracking-[0.12em] text-white/80 uppercase">Featured Strategy</span>
            <button onClick={onClose} className="w-6 h-6 flex items-center justify-center text-white/40 hover:text-white transition-colors" aria-label="Close">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div
            className="bg-white px-4 py-3 flex items-center gap-5 cursor-pointer hover:bg-[#FAFAFA] transition-colors"
            onClick={() => setSelectedIdx(0)}
          >
            <span className="text-[15px] font-extrabold text-text-primary shrink-0">{featured.fund.name}</span>
            <span
              className="text-[9px] font-bold tracking-[0.06em] uppercase px-2 py-0.5 rounded-sm shrink-0"
              style={{ backgroundColor: featuredStratColor + '14', color: featuredStratColor }}
            >
              {featuredStratKey.replace(/_/g, ' ')}
            </span>
            <div className="flex gap-5 shrink-0">
              <div>
                <div className="text-[9px] font-semibold uppercase tracking-[0.08em] text-text-muted">TVL</div>
                <div className="font-mono text-[13px] font-bold tabular-nums">{formatTvlCompact(featuredTvl)}</div>
              </div>
              <div>
                <div className="text-[9px] font-semibold uppercase tracking-[0.08em] text-text-muted">NAV</div>
                <div className="font-mono text-[13px] font-bold tabular-nums">${featured.vault.navPerShare.toFixed(4)}</div>
              </div>
              <div>
                <div className="text-[9px] font-semibold uppercase tracking-[0.08em] text-text-muted">Perf</div>
                <div className={cn('font-mono text-[13px] font-bold tabular-nums', featuredIsPos ? 'text-color-up' : 'text-color-down')}>
                  {featuredIsPos ? '+' : ''}{featuredPerf}%
                </div>
              </div>
              <div>
                <div className="text-[9px] font-semibold uppercase tracking-[0.08em] text-text-muted">Fee</div>
                <div className="font-mono text-[13px] font-bold tabular-nums">{featuredFee.toFixed(0)}%</div>
              </div>
            </div>
            <p className="text-[11px] text-text-muted truncate flex-1 min-w-0">{featured.fund.tagline}</p>
          </div>
        </div>

        {/* Main body: left list + right detail */}
        <div className="flex flex-1 min-h-0">
          {/* Left: strategy list */}
          <div className="w-[280px] shrink-0 border-r border-[#E0E0E0] flex flex-col">
            <div className="bg-[#1A1A1A] px-4 py-1.5">
              <span className="text-[10px] font-bold tracking-[0.12em] text-white/80 uppercase">Strategies</span>
            </div>
            <div className="flex-1 overflow-y-auto">
              {vaults.map((entry, i) => {
                const perf = entry.vault.performanceSinceInception
                const isPos = perf >= 0
                const stratColor = STRATEGY_COLOR_HEX[entry.fund.strategy] ?? '#999'
                return (
                  <div
                    key={entry.vault.address}
                    onClick={() => setSelectedIdx(i)}
                    className={cn(
                      'flex items-center gap-2.5 px-3 py-2.5 border-b border-[#F0F0F0] cursor-pointer transition-colors hover:bg-[#FAFAFA]',
                      selectedIdx === i && 'bg-[#F5F5F5] border-l-[3px] border-l-[#00A36C] pl-[9px]',
                    )}
                  >
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: stratColor }} />
                    <span className="text-[13px] font-bold text-text-primary flex-1 truncate">{entry.fund.name}</span>
                    <span className="text-[9px] font-semibold uppercase tracking-[0.06em] text-text-muted shrink-0">
                      {(entry.fund.strategy ?? '').replace(/_/g, ' ')}
                    </span>
                    <span className={cn('font-mono text-[11px] font-bold tabular-nums shrink-0', isPos ? 'text-color-up' : 'text-color-down')}>
                      {(perf * 100).toFixed(2)}%
                    </span>
                  </div>
                )
              })}
            </div>
            <div className="border-t border-[#E0E0E0] px-3 py-3 text-center cursor-pointer hover:bg-[#FAFAFA] transition-colors">
              <span className="text-[11px] font-bold text-[#00A36C]">+ Build Your Own</span>
            </div>
          </div>

          {/* Right: detail panel */}
          <VaultDetailPanel key={current.vault.address} vault={current.vault} fund={current.fund} />
        </div>
      </SpringModal>
    </SpringBackdrop>
  )
}
