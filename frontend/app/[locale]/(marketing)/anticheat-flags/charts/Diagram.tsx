'use client'

import { useEffect, useRef, useState } from 'react'
import type { ChartProps, Mechanism } from '../types'
import './diagram.css'

type Variant = 'loop' | 'reveal'

function useInViewOnce<T extends Element>(): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null)
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setSeen(true)
            io.disconnect()
            break
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.18 }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return [ref, seen]
}

function Frame({
  variant,
  children,
}: {
  variant: Variant
  children: React.ReactNode
}) {
  const [ref, inView] = useInViewOnce<HTMLDivElement>()
  const cls =
    variant === 'loop' ? 'acd-frame is-loop' : `acd-frame ${inView ? 'is-in' : ''}`
  return (
    <div ref={ref} className={cls}>
      {children}
    </div>
  )
}

/* Pointer callout — hairline + label, positioned in SVG user space. */
function Callout({
  x1, y1, x2, y2, label,
  align = 'start',
}: {
  x1: number; y1: number; x2: number; y2: number
  label: string
  align?: 'start' | 'middle' | 'end'
}) {
  return (
    <g className="acd-callout">
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(0,0,0,0.25)" strokeWidth="0.75" strokeDasharray="2 2" />
      <circle cx={x1} cy={y1} r="1.5" fill="rgba(0,0,0,0.45)" />
      <text
        x={x2}
        y={y2}
        textAnchor={align}
        dominantBaseline="middle"
        fontFamily="var(--apple-font-text)"
        fontSize="8.5"
        fontWeight={600}
        letterSpacing="0.01em"
        fill="#1d1d1f"
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {label}
      </text>
    </g>
  )
}

/* Grid: a single 16:9 chart viewport with subtle horizontal gridlines
   and tick marks across the bottom. Used inside all line diagrams. */
function GridBackdrop({ ticks }: { ticks?: string[] }) {
  return (
    <g className="acd-fade">
      {/* horizontal gridlines */}
      <line x1="0" y1="20" x2="400" y2="20" stroke="var(--acd-grid)" strokeWidth="0.75" />
      <line x1="0" y1="55" x2="400" y2="55" stroke="var(--acd-grid)" strokeWidth="0.75" strokeDasharray="2 3" />
      <line x1="0" y1="90" x2="400" y2="90" stroke="var(--acd-grid)" strokeWidth="0.75" />
      {/* time ticks */}
      {ticks && ticks.map((t, i) => {
        const x = (i / (ticks.length - 1)) * 400
        return (
          <g key={i}>
            <line x1={x} y1="90" x2={x} y2="93" stroke="var(--acd-grid-dash)" strokeWidth="0.75" />
            <text
              x={x}
              y="100"
              textAnchor={i === 0 ? 'start' : i === ticks.length - 1 ? 'end' : 'middle'}
              fontFamily="var(--apple-font-text)"
              fontSize="7"
              fill="var(--acd-text-tertiary)"
              letterSpacing="0.04em"
              style={{ textTransform: 'uppercase', fontVariantNumeric: 'tabular-nums' }}
            >
              {t}
            </text>
          </g>
        )
      })}
    </g>
  )
}

/* ──────────────────────────────────────────────────────────────────────────
   1. WICK — smooth Bezier baseline + sharp accent anomaly + halo + callout.
   Used for: spike, cliff, runup, dump.
   ────────────────────────────────────────────────────────────────────────── */

type WickKind = 'spike' | 'cliff' | 'runup' | 'dump'

interface WickGeometry {
  baseline: string
  baselineLen: number
  accent: string
  accentLen: number
  accentPt: { x: number; y: number }
  callout: { x1: number; y1: number; x2: number; y2: number; align?: 'start' | 'middle' | 'end' }
  ticks: string[]
}

const WICK_GEOM: Record<WickKind, WickGeometry> = {
  // Flat baseline, sudden vertical wick down and back up.
  spike: {
    baseline: 'M0 50 C 40 49, 80 51, 120 50 S 200 49, 240 50 L 248 50 M 268 50 C 300 50, 340 49, 400 50',
    baselineLen: 460,
    accent: 'M 248 50 L 256 84 L 264 50 L 268 50',
    accentLen: 80,
    accentPt: { x: 256, y: 84 },
    callout: { x1: 256, y1: 84, x2: 300, y2: 84, align: 'start' },
    ticks: ['10:42', '10:43', '10:44', '10:45'],
  },
  // Slow rise, then vertical drop, flat low.
  cliff: {
    baseline: 'M 0 80 C 40 78, 80 73, 120 65 S 200 42, 240 28 S 290 16, 300 14',
    baselineLen: 360,
    accent: 'M 300 14 L 300 86 L 400 86',
    accentLen: 180,
    accentPt: { x: 300, y: 50 },
    callout: { x1: 320, y1: 86, x2: 360, y2: 78, align: 'end' },
    ticks: ['DAY 1', 'DAY 60', 'DAY 90', 'DAY 91'],
  },
  // Long flat, ramp up before public event.
  runup: {
    baseline: 'M 0 70 C 60 70, 120 70, 180 70 S 220 69, 240 68',
    baselineLen: 260,
    accent: 'M 240 68 C 280 56, 320 32, 360 16 S 390 10, 400 9',
    accentLen: 200,
    accentPt: { x: 400, y: 9 },
    callout: { x1: 320, y1: 32, x2: 280, y2: 18, align: 'end' },
    ticks: ['T−14d', 'T−7d', 'T−1d', 'EVENT'],
  },
  // Spike up at listing, slow decay.
  dump: {
    baseline: 'M 0 86 L 30 84 L 50 30',
    baselineLen: 130,
    accent: 'M 50 30 C 90 42, 160 58, 240 70 S 360 80, 400 84',
    accentLen: 380,
    accentPt: { x: 50, y: 30 },
    callout: { x1: 50, y1: 30, x2: 95, y2: 18, align: 'start' },
    ticks: ['LIST', '+5m', '+1h', '+1d'],
  },
}

function WickDiagram({
  loss,
  extracted,
  recipient,
  pctMove,
  kind,
  variant,
}: ChartProps & { kind: WickKind; variant: Variant }) {
  const g = WICK_GEOM[kind]
  const calloutLabel = pctMove ?? extracted ?? loss ?? ''
  return (
    <Frame variant={variant}>
      <div className="acd-row">
        <span className="acd-eyebrow">{kindLabel(kind)}</span>
        {pctMove && <span className="acd-eyebrow is-emphasised">{pctMove}</span>}
      </div>

      <div className="acd-canvas">
        <svg viewBox="0 0 400 108" preserveAspectRatio="xMidYMid meet" aria-hidden>
          <defs>
            <radialGradient id={`halo-${kind}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="var(--acd-accent)" stopOpacity="0.32" />
              <stop offset="100%" stopColor="var(--acd-accent)" stopOpacity="0" />
            </radialGradient>
          </defs>

          <GridBackdrop ticks={g.ticks} />

          {/* baseline trace */}
          <path
            d={g.baseline}
            fill="none"
            stroke="var(--acd-stroke)"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="acd-draw"
            style={{ ['--len' as never]: g.baselineLen }}
          />

          {/* accent halo */}
          <circle
            cx={g.accentPt.x}
            cy={g.accentPt.y}
            r="12"
            fill={`url(#halo-${kind})`}
            className="acd-halo"
          />

          {/* accent anomaly stroke */}
          <path
            d={g.accent}
            fill="none"
            stroke="var(--acd-accent)"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="acd-accent-stroke"
            style={{ ['--len' as never]: g.accentLen }}
          />

          {/* accent point */}
          <circle
            cx={g.accentPt.x}
            cy={g.accentPt.y}
            r="2.5"
            fill="var(--acd-accent)"
            className="acd-accent-pt"
            style={{ ['--ox' as never]: `${g.accentPt.x}px`, ['--oy' as never]: `${g.accentPt.y}px` }}
          />

          {/* callout */}
          {calloutLabel && (
            <Callout
              x1={g.callout.x1}
              y1={g.callout.y1}
              x2={g.callout.x2}
              y2={g.callout.y2}
              align={g.callout.align}
              label={calloutLabel}
            />
          )}
        </svg>
      </div>

      <div className="acd-row" style={{ alignItems: 'flex-end' }}>
        <div className="acd-fade">
          <div className="acd-headline">{extracted ?? loss ?? '—'}</div>
          {recipient && (
            <div className="acd-caption" style={{ marginTop: 4 }}>
              kept by {recipient}
            </div>
          )}
        </div>
      </div>
    </Frame>
  )
}

function kindLabel(k: WickKind): string {
  switch (k) {
    case 'spike': return 'price · stops cleared'
    case 'cliff': return 'price · insiders out'
    case 'runup': return 'price · ahead of public'
    case 'dump': return 'price · listing → grind'
  }
}

/* ──────────────────────────────────────────────────────────────────────────
   2. DRAIN — stacked balance bars. Last bar collapses to a stub.
   Used for: button-freeze, backdoor.
   ────────────────────────────────────────────────────────────────────────── */

function DrainDiagram({
  loss,
  extracted,
  recipient,
  variant,
}: ChartProps & { variant: Variant }) {
  // Six bars: gentle decline then collapse on the last one.
  // Heights are normalized to 0..100.
  const bars = [88, 86, 84, 82, 80, 6]
  const labels = ['T−5', 'T−4', 'T−3', 'T−2', 'T−1', 'NOW']
  return (
    <Frame variant={variant}>
      <div className="acd-row">
        <span className="acd-eyebrow">hot wallet · balance</span>
        {recipient && <span className="acd-eyebrow is-emphasised">→ {recipient}</span>}
      </div>

      <div className="acd-canvas">
        <svg viewBox="0 0 400 108" preserveAspectRatio="xMidYMid meet" aria-hidden>
          <GridBackdrop ticks={labels} />
          {/* the bars */}
          {bars.map((h, i) => {
            const x = 16 + i * 62
            const w = 36
            const yTop = 90 - h
            const isLast = i === bars.length - 1
            return (
              <g key={i} className={`acd-bar ${isLast ? 'is-collapsed' : ''}`} style={{ transformBox: 'fill-box', transformOrigin: '50% 100%' }}>
                <rect
                  x={x}
                  y={yTop}
                  width={w}
                  height={90 - yTop}
                  rx="1.5"
                  fill={isLast ? 'var(--acd-accent)' : 'var(--acd-stroke-soft)'}
                  opacity={isLast ? 1 : 0.9}
                />
              </g>
            )
          })}
          {/* callout pointing at the collapse */}
          <g className="acd-callout">
            <line x1="370" y1="86" x2="330" y2="60" stroke="rgba(0,0,0,0.25)" strokeWidth="0.75" strokeDasharray="2 2" />
            <text
              x="328"
              y="56"
              textAnchor="end"
              fontFamily="var(--apple-font-text)"
              fontSize="8.5"
              fontWeight={600}
              fill="#1d1d1f"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {loss ?? 'drained'}
            </text>
          </g>
        </svg>
      </div>

      <div className="acd-row" style={{ alignItems: 'flex-end' }}>
        <div className="acd-fade">
          <div className="acd-headline acd-headline-accent">{extracted ?? loss ?? '—'}</div>
          <div className="acd-caption" style={{ marginTop: 4 }}>
            balance to zero in one block
          </div>
        </div>
      </div>
    </Frame>
  )
}

/* ──────────────────────────────────────────────────────────────────────────
   3. CARVEOUT — promised payoff vs after-fineprint, accent shows the cut.
   Used for: carveout, oracle-override, margin-doubled, socialized-loss, b-book-mirror.
   ────────────────────────────────────────────────────────────────────────── */

function CarveoutDiagram({
  loss,
  extracted,
  recipient,
  pctMove,
  variant,
}: ChartProps & { variant: Variant }) {
  // Two horizontal bars stacked. Top: promise (full). Bottom: actual + cut overlay.
  return (
    <Frame variant={variant}>
      <div className="acd-row">
        <span className="acd-eyebrow">payoff</span>
        {pctMove && <span className="acd-eyebrow is-emphasised">{pctMove}</span>}
      </div>

      <div className="acd-canvas">
        <svg viewBox="0 0 400 108" preserveAspectRatio="xMidYMid meet" aria-hidden>
          <GridBackdrop />

          {/* row labels */}
          <text x="0" y="24" fontFamily="var(--apple-font-text)" fontSize="8" fill="var(--acd-text-tertiary)" letterSpacing="0.08em" style={{ textTransform: 'uppercase' }}>promised</text>
          <text x="0" y="72" fontFamily="var(--apple-font-text)" fontSize="8" fill="var(--acd-text-tertiary)" letterSpacing="0.08em" style={{ textTransform: 'uppercase' }}>after</text>

          {/* promised bar */}
          <g className="acd-bar" style={{ transformBox: 'fill-box', transformOrigin: '0 50%' }}>
            <rect x="60" y="28" width="320" height="14" rx="2" fill="var(--acd-stroke-soft)" opacity="0.7" />
          </g>

          {/* after — kept portion */}
          <g className="acd-bar" style={{ transformBox: 'fill-box', transformOrigin: '0 50%' }}>
            <rect x="60" y="60" width="96" height="14" rx="2" fill="var(--acd-stroke)" opacity="0.9" />
          </g>

          {/* after — carved portion (accent, hatched) */}
          <g className="acd-bar" style={{ transformBox: 'fill-box', transformOrigin: '0 50%' }}>
            <defs>
              <pattern id="carve-hatch" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
                <line x1="0" y1="0" x2="0" y2="6" stroke="var(--acd-accent)" strokeWidth="0.8" opacity="0.45" />
              </pattern>
            </defs>
            <rect x="160" y="60" width="220" height="14" rx="2" fill="url(#carve-hatch)" stroke="var(--acd-accent)" strokeWidth="1" strokeDasharray="3 2" />
          </g>

          {/* tick from promised down to after-kept showing the cut */}
          <g className="acd-callout">
            <line x1="156" y1="42" x2="156" y2="60" stroke="var(--acd-accent)" strokeWidth="0.75" />
            <line x1="380" y1="42" x2="380" y2="60" stroke="var(--acd-accent)" strokeWidth="0.75" />
            <text
              x="270"
              y="54"
              textAnchor="middle"
              fontFamily="var(--apple-font-text)"
              fontSize="8.5"
              fontWeight={600}
              fill="var(--acd-accent)"
              style={{ fontVariantNumeric: 'tabular-nums', letterSpacing: '0.04em', textTransform: 'uppercase' }}
            >
              carved by venue
            </text>
          </g>
        </svg>
      </div>

      <div className="acd-row" style={{ alignItems: 'flex-end' }}>
        <div className="acd-fade">
          <div className="acd-headline">{extracted ?? loss ?? '—'}</div>
          {recipient && (
            <div className="acd-caption" style={{ marginTop: 4 }}>
              kept by {recipient}
            </div>
          )}
        </div>
      </div>
    </Frame>
  )
}

/* ──────────────────────────────────────────────────────────────────────────
   4. FLOW — user → venue → recipient, with values drifting along the path.
   Used for: wash-trading.
   ────────────────────────────────────────────────────────────────────────── */

function FlowDiagram({
  loss,
  extracted,
  recipient,
  variant,
}: ChartProps & { variant: Variant }) {
  return (
    <Frame variant={variant}>
      <div className="acd-row">
        <span className="acd-eyebrow">flow · user → recipient</span>
        {extracted && <span className="acd-eyebrow is-emphasised">{extracted}</span>}
      </div>

      <div className="acd-canvas">
        <svg viewBox="0 0 400 108" preserveAspectRatio="xMidYMid meet" aria-hidden>
          {/* spine */}
          <line x1="40" y1="54" x2="360" y2="54" stroke="var(--acd-grid-dash)" strokeWidth="0.75" strokeDasharray="2 3" className="acd-fade" />

          {/* user node */}
          <g className="acd-fade">
            <circle cx="40" cy="54" r="10" fill="#fff" stroke="var(--acd-stroke-soft)" strokeWidth="1" />
            <text x="40" y="57" textAnchor="middle" fontFamily="var(--apple-font-text)" fontSize="8" fontWeight={600} fill="var(--acd-text-secondary)" style={{ letterSpacing: '0.04em' }}>U</text>
            <text x="40" y="78" textAnchor="middle" fontFamily="var(--apple-font-text)" fontSize="8" fill="var(--acd-text-tertiary)" letterSpacing="0.08em" style={{ textTransform: 'uppercase' }}>user</text>
            <text x="40" y="34" textAnchor="middle" fontFamily="var(--apple-font-display)" fontSize="10" fontWeight={600} fill="var(--acd-text)" style={{ fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.016em' }}>{loss ?? '—'}</text>
          </g>

          {/* venue node */}
          <g className="acd-fade">
            <rect x="180" y="42" width="40" height="24" rx="3" fill="#fff" stroke="var(--acd-stroke-soft)" strokeWidth="1" />
            <text x="200" y="57" textAnchor="middle" fontFamily="var(--apple-font-text)" fontSize="8" fontWeight={600} fill="var(--acd-text-secondary)" style={{ letterSpacing: '0.04em' }}>venue</text>
            <text x="200" y="78" textAnchor="middle" fontFamily="var(--apple-font-text)" fontSize="8" fill="var(--acd-text-tertiary)" letterSpacing="0.08em" style={{ textTransform: 'uppercase' }}>routing</text>
          </g>

          {/* recipient node */}
          <g className="acd-fade">
            <circle cx="360" cy="54" r="11" fill="var(--acd-accent-soft)" stroke="var(--acd-accent)" strokeWidth="1" />
            <text x="360" y="57" textAnchor="middle" fontFamily="var(--apple-font-text)" fontSize="8" fontWeight={700} fill="var(--acd-accent)" style={{ letterSpacing: '0.04em' }}>R</text>
            <text x="360" y="78" textAnchor="middle" fontFamily="var(--apple-font-text)" fontSize="8" fill="var(--acd-text-tertiary)" letterSpacing="0.08em" style={{ textTransform: 'uppercase' }}>{recipient ?? 'recipient'}</text>
            <text x="360" y="34" textAnchor="middle" fontFamily="var(--apple-font-display)" fontSize="10" fontWeight={600} fill="var(--acd-accent)" style={{ fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.016em' }}>{extracted ?? '—'}</text>
          </g>

          {/* arrows: user → venue, venue → recipient */}
          <g className="acd-accent-stroke" style={{ ['--len' as never]: 130 }}>
            <line x1="52" y1="54" x2="174" y2="54" stroke="var(--acd-accent)" strokeWidth="1.4" strokeLinecap="round" />
            <path d="M 170 51 L 178 54 L 170 57" fill="none" stroke="var(--acd-accent)" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" />
          </g>
          <g className="acd-accent-stroke" style={{ ['--len' as never]: 130, animationDelay: '1.1s' }}>
            <line x1="222" y1="54" x2="345" y2="54" stroke="var(--acd-accent)" strokeWidth="1.4" strokeLinecap="round" />
            <path d="M 341 51 L 349 54 L 341 57" fill="none" stroke="var(--acd-accent)" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" />
          </g>
        </svg>
      </div>

      <div className="acd-row" style={{ alignItems: 'flex-end' }}>
        <div className="acd-fade">
          <div className="acd-headline">{extracted ?? loss ?? '—'}</div>
          {recipient && (
            <div className="acd-caption" style={{ marginTop: 4 }}>
              to {recipient}
            </div>
          )}
        </div>
      </div>
    </Frame>
  )
}

/* ────────────────────────────────────────────────────────────────────────── */

const REGISTRY: Record<Mechanism, (p: ChartProps & { variant: Variant }) => React.ReactElement> = {
  'price-wick':         (p) => <WickDiagram {...p} kind="spike" />,
  'rug-cliff':          (p) => <WickDiagram {...p} kind="cliff" />,
  'listing-dump':       (p) => <WickDiagram {...p} kind="dump" />,
  'insider-runup':      (p) => <WickDiagram {...p} kind="runup" />,

  'button-freeze':      (p) => <DrainDiagram {...p} />,
  'backdoor':           (p) => <DrainDiagram {...p} />,

  'carveout':           (p) => <CarveoutDiagram {...p} />,
  'oracle-override':    (p) => <CarveoutDiagram {...p} />,
  'margin-doubled':     (p) => <CarveoutDiagram {...p} />,
  'socialized-loss':    (p) => <CarveoutDiagram {...p} />,
  'b-book-mirror':      (p) => <CarveoutDiagram {...p} />,

  'wash-trading':       (p) => <FlowDiagram {...p} />,
}

export function Diagram({
  mechanism,
  loop = false,
  ...props
}: { mechanism: Mechanism; loop?: boolean } & ChartProps) {
  const Component = REGISTRY[mechanism]
  return Component({ ...props, variant: loop ? 'loop' : 'reveal' })
}
