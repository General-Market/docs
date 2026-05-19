'use client'

import type { ChartProps, Mechanism } from '../types'
import './diagram.css'

/* ──────────────────────────────────────────────────────────────────────────
   Mini candle chart per incident. Always looping. The accent colour is
   red. The predator role. And the user appears as a horizontal price
   line that breaks at the predator candle. The Girardian frame:
   the market scapegoats one participant in order to keep moving.
   ────────────────────────────────────────────────────────────────────────── */

const APPLE_RED = '#FF3B30'
const STROKE = '#4a4a4f'
const STROKE_SOFT = '#b8b8bd'
const GRID = 'rgba(0, 0, 0, 0.07)'
const GRID_SOFT = 'rgba(0, 0, 0, 0.04)'
const TEXT_TERT = '#6e6e73'

const N = 12
const VW = 400
const VH = 260
const PAD_X = 14
const SLOT = (VW - PAD_X * 2) / N
const BODY_W = SLOT - 1            // touching neighbours: 1px hairline gap
const CHART_TOP = 32
const CHART_BOTTOM = 222
const TICK_Y = 244
const MIN_BODY_H = 14              // forced minimum so flat candles still have presence

function cx(i: number): number {
  return PAD_X + SLOT * (i + 0.5)
}

function py(p: number): number {
  // p: 0..100, 0=bottom, 100=top
  return CHART_BOTTOM - (p / 100) * (CHART_BOTTOM - CHART_TOP)
}

type Role = 'up' | 'down' | 'predator' | 'frozen' | 'carved'

interface Candle {
  o: number
  h: number
  l: number
  c: number
  role?: Role
}

interface Scene {
  candles: Candle[]
  ticks: [string, string, string, string]
  victim: {
    y: number              // price level (0..100)
    label: string          // e.g. "U LONG"
    breakIdx: number       // -1 = no break (line continues all the way)
    liqLabel?: string      // shown at the break point
  }
  predator: {
    label: string          // e.g. "SCAM WICK"
    idx: number            // candle index to highlight (-1 = none)
  }
}

type SceneKind = 'spike' | 'cliff' | 'runup' | 'dump' | 'drain' | 'freeze' | 'carve' | 'wash'

function getKind(m: Mechanism): SceneKind {
  switch (m) {
    case 'price-wick':       return 'spike'
    case 'rug-cliff':        return 'cliff'
    case 'insider-runup':    return 'runup'
    case 'listing-dump':     return 'dump'
    case 'backdoor':         return 'drain'
    case 'button-freeze':    return 'freeze'
    case 'carveout':
    case 'oracle-override':
    case 'margin-doubled':
    case 'socialized-loss':
    case 'b-book-mirror':    return 'carve'
    case 'wash-trading':     return 'wash'
  }
}

/* ── Candle generators ────────────────────────────────────────────────── */

function flat(n: number, mid: number, jitter = 6): Candle[] {
  // Random walk around `mid` — bodies span 6–10 price units, visible at small sizes.
  return Array.from({ length: n }, (_, k) => {
    const drift = Math.sin(k * 1.7) * jitter + Math.cos(k * 0.9) * jitter * 0.4
    const o = mid + drift
    const c = mid + Math.cos(k * 2.3) * jitter + Math.sin(k * 1.1) * jitter * 0.3
    const h = Math.max(o, c) + jitter * 0.8
    const l = Math.min(o, c) - jitter * 0.8
    return { o, h, l, c, role: c >= o ? 'up' : 'down' }
  })
}

function ramp(n: number, from: number, to: number, role: Role = 'up'): Candle[] {
  // Stepped move with body height proportional to step.
  const step = (to - from) / n
  return Array.from({ length: n }, (_, k) => {
    const o = from + step * k
    const c = from + step * (k + 1)
    const wickPad = Math.abs(step) * 0.45 + 1.2
    const h = Math.max(o, c) + wickPad
    const l = Math.min(o, c) - wickPad
    return { o, h, l, c, role }
  })
}

function frozen(n: number, mid: number): Candle[] {
  // Frozen candles are short bars at mid — the render layer will floor them
  // to MIN_BODY_H so they still register visually.
  return Array.from({ length: n }, () => ({
    o: mid, h: mid + 1, l: mid - 1, c: mid, role: 'frozen' as Role,
  }))
}

/* ── Scene builders ───────────────────────────────────────────────────── */

function buildScene(kind: SceneKind, p: ChartProps): Scene {
  const lossTxt = p.loss ?? ''
  const moveTxt = p.pctMove ?? ''
  const exTxt = p.extracted ?? ''

  switch (kind) {
    case 'spike': {
      // Quiet long, sudden wick, recovery.
      const base = flat(8, 56, 6)
      const wick: Candle = { o: 56, h: 60, l: 6, c: 52, role: 'predator' }
      const after = flat(3, 52, 5)
      return {
        candles: [...base, wick, ...after],
        ticks: ['10:42', '10:43', '10:44', '10:45'],
        victim: { y: 46, label: 'U STOP', breakIdx: 8, liqLabel: `LIQ ${lossTxt}` },
        predator: { label: `SCAM WICK${moveTxt ? ' · ' + moveTxt : ''}`, idx: 8 },
      }
    }

    case 'cliff': {
      const climb = ramp(10, 22, 84, 'up')
      const drop: Candle = { o: 84, h: 86, l: 6, c: 10, role: 'predator' }
      const dead = flat(1, 8, 2)
      return {
        candles: [...climb, drop, ...dead],
        ticks: ['DAY 1', 'DAY 30', 'DAY 60', 'DAY 91'],
        victim: { y: 80, label: 'U HOLDS', breakIdx: 10, liqLabel: `WIPED ${lossTxt}` },
        predator: { label: 'INSIDERS EXIT', idx: 10 },
      }
    }

    case 'runup': {
      // Flat then ramp before announcement. Insider buying ahead.
      const sleep = flat(6, 22, 5)
      const climb = ramp(5, 22, 80, 'predator')
      const peak: Candle = { o: 80, h: 92, l: 78, c: 90, role: 'predator' }
      return {
        candles: [...sleep, ...climb, peak],
        ticks: ['T−14d', 'T−7d', 'T−1d', 'EVENT'],
        victim: { y: 88, label: 'U BUYS', breakIdx: 11, liqLabel: `LATE ${lossTxt}` },
        predator: { label: 'INSIDERS BUY EARLY', idx: 10 },
      }
    }

    case 'dump': {
      const initial: Candle = { o: 28, h: 94, l: 24, c: 56, role: 'predator' }
      const grind = ramp(11, 56, 8, 'down')
      return {
        candles: [initial, ...grind],
        ticks: ['LIST', '+5m', '+1h', '+1d'],
        victim: { y: 82, label: 'U BUYS LIST', breakIdx: 0, liqLabel: `DOWN ${lossTxt}` },
        predator: { label: 'MM DUMPS LISTING', idx: 0 },
      }
    }

    case 'drain': {
      // Balance candles. Stable then a collapse.
      const stable = flat(9, 78, 5)
      const drained: Candle = { o: 78, h: 82, l: 4, c: 8, role: 'predator' }
      const zero = flat(2, 8, 3)
      return {
        candles: [...stable, drained, ...zero],
        ticks: ['T−9', 'T−6', 'T−3', 'NOW'],
        victim: { y: 72, label: 'USER BAL', breakIdx: 9, liqLabel: `DRAINED ${lossTxt}` },
        predator: { label: 'HOT WALLET → 0', idx: 9 },
      }
    }

    case 'freeze': {
      const ok = flat(3, 76, 5)
      const lock = frozen(6, 76)
      const collapse: Candle = { o: 76, h: 78, l: 16, c: 20, role: 'predator' }
      const after = flat(2, 18, 3)
      return {
        candles: [...ok, ...lock, collapse, ...after],
        ticks: ['BUY OK', 'BTN OFF', 'CRASH', '+1d'],
        victim: { y: 72, label: 'U LOCKED', breakIdx: 9, liqLabel: `LOCKED IN ${lossTxt}` },
        predator: { label: 'EXIT DENIED', idx: 9 },
      }
    }

    case 'carve': {
      // Rising bodies. But every candle has an oversized red upper wick
      // (the upside the venue carved off for itself).
      const candles = ramp(12, 18, 60, 'carved').map((c, i) => ({
        ...c,
        h: c.h + 16 + Math.abs(Math.sin(i * 0.9)) * 8,
      }))
      return {
        candles,
        ticks: ['T0', 'T3', 'T6', 'T9'],
        victim: { y: 50, label: 'U KEEPS', breakIdx: -1 },
        predator: { label: `VENUE TAKES UPSIDE${exTxt ? ' · ' + exTxt : ''}`, idx: -1 },
      }
    }

    case 'wash': {
      // Bodies in a tight band but with random walk so they look like trading.
      const candles: Candle[] = Array.from({ length: 12 }, (_, k) => {
        const dir = k % 2 === 0 ? 1 : -1
        const drift = Math.sin(k * 1.4) * 4
        return {
          o: 48 + drift - dir * 3,
          c: 52 + drift + dir * 3,
          h: 60 + drift,
          l: 38 + drift,
          role: 'predator',
        }
      })
      return {
        candles,
        ticks: ['00:00', '00:15', '00:30', '00:45'],
        victim: { y: 50, label: 'NET 0', breakIdx: -1 },
        predator: { label: `MM WASHES VOLUME${exTxt ? ' · ' + exTxt : ''}`, idx: -1 },
      }
    }

  }
}

/* ── Rendering ────────────────────────────────────────────────────────── */

function CandleEl({ idx, c: cd }: { idx: number; c: Candle }) {
  const x = cx(idx)
  const role: Role = cd.role ?? (cd.c >= cd.o ? 'up' : 'down')
  const top = py(cd.h)
  const bot = py(cd.l)
  const rawTop = py(Math.max(cd.o, cd.c))
  const rawBot = py(Math.min(cd.o, cd.c))
  const rawH = rawBot - rawTop

  // Enforce a minimum body height. Centre the floor around the original body.
  let bodyTop = rawTop
  let bodyH = rawH
  if (rawH < MIN_BODY_H) {
    const grow = (MIN_BODY_H - rawH) / 2
    bodyTop = rawTop - grow
    bodyH = MIN_BODY_H
  }

  const cls = `acd-candle acd-c-${idx}`

  if (role === 'frozen') {
    return (
      <g className={cls}>
        <line x1={x} y1={py(cd.h)} x2={x} y2={py(cd.l)} stroke={STROKE_SOFT} strokeWidth="1.4" strokeDasharray="2 3" opacity="0.6" />
        <rect
          x={x - BODY_W / 2}
          y={bodyTop}
          width={BODY_W}
          height={Math.max(MIN_BODY_H, bodyH)}
          fill="#fff"
          stroke={STROKE_SOFT}
          strokeWidth="1"
          strokeDasharray="2 2"
          opacity="0.7"
          rx="1.5"
        />
      </g>
    )
  }

  if (role === 'carved') {
    // Upper wick rendered in red (carved upside), body kept neutral.
    return (
      <g className={cls}>
        <line x1={x} y1={top} x2={x} y2={bodyTop} stroke={APPLE_RED} strokeWidth="2" strokeLinecap="round" />
        <line x1={x} y1={bodyTop + bodyH} x2={x} y2={bot} stroke={STROKE} strokeWidth="1.4" />
        <rect
          x={x - BODY_W / 2}
          y={bodyTop}
          width={BODY_W}
          height={bodyH}
          fill="url(#acd-grad-down)"
          rx="1.5"
        />
      </g>
    )
  }

  const isPred = role === 'predator'
  const isUp = role === 'up'
  const fill = isPred ? `url(#acd-grad-pred)` : isUp ? `url(#acd-grad-up)` : `url(#acd-grad-down)`
  const stroke = isPred ? '#e02a20' : isUp ? STROKE_SOFT : STROKE
  const wickStroke = isPred ? APPLE_RED : STROKE
  const wickWidth = isPred ? 2 : 1.4

  return (
    <g className={cls}>
      <line x1={x} y1={top} x2={x} y2={bot} stroke={wickStroke} strokeWidth={wickWidth} strokeLinecap="round" />
      <rect
        x={x - BODY_W / 2}
        y={bodyTop}
        width={BODY_W}
        height={bodyH}
        fill={fill}
        stroke={stroke}
        strokeWidth={isUp ? 1.2 : 0.8}
        rx="1.5"
      />
    </g>
  )
}

function CandleChart({ scene }: { scene: Scene }) {
  const victimY = py(scene.victim.y)
  const victimBreakX = scene.victim.breakIdx >= 0 ? cx(scene.victim.breakIdx) : VW - PAD_X
  const liqX = scene.victim.breakIdx >= 0 ? cx(scene.victim.breakIdx) : 0
  const predatorX = scene.predator.idx >= 0 ? cx(scene.predator.idx) : 0
  // Predator marker sits above the highest point of the highlighted candle.
  // Clamp to the chart top so it never escapes the canvas on near-top peaks.
  const predatorY = scene.predator.idx >= 0
    ? Math.max(CHART_TOP + 14, py(scene.candles[scene.predator.idx]?.h ?? 80) - 18)
    : 0

  // Estimate liq label width so a right-side break still fits inside the frame
  const liqLabelW = (scene.victim.liqLabel?.length ?? 0) * 7.5
  const liqLabelX = liqX + liqLabelW + 14 > VW - 4 ? liqX - 14 : liqX + 14
  const liqLabelAnchor = liqX + liqLabelW + 14 > VW - 4 ? 'end' : 'start'

  return (
    <div className="acd-frame">
      <div className="acd-head">
        <span className="acd-eyebrow predator">{scene.predator.label}</span>
        <span className="acd-eyebrow victim">{scene.victim.label}</span>
      </div>

      <div className="acd-canvas">
        <svg viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="xMidYMid meet" aria-hidden>
          <defs>
            <linearGradient id="acd-grad-pred" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#FF6B61" />
              <stop offset="55%"  stopColor="#FF3B30" />
              <stop offset="100%" stopColor="#D8261D" />
            </linearGradient>
            <linearGradient id="acd-grad-down" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#4a4a4f" />
              <stop offset="100%" stopColor="#1d1d1f" />
            </linearGradient>
            <linearGradient id="acd-grad-up" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#ffffff" />
              <stop offset="100%" stopColor="#f0f0f3" />
            </linearGradient>
            <radialGradient id="acd-grad-halo" cx="50%" cy="50%" r="50%">
              <stop offset="0%"   stopColor="#FF3B30" stopOpacity="0.35" />
              <stop offset="60%"  stopColor="#FF3B30" stopOpacity="0.10" />
              <stop offset="100%" stopColor="#FF3B30" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* baseline + ticks. Minimal chrome — one strong hairline + 4 labels. */}
          <g className="acd-chrome">
            <line x1={PAD_X / 2} y1={CHART_BOTTOM} x2={VW - PAD_X / 2} y2={CHART_BOTTOM} stroke={GRID} strokeWidth="1" />
            {scene.ticks.map((t, i) => {
              const tx = PAD_X / 2 + (i / (scene.ticks.length - 1)) * (VW - PAD_X)
              return (
                <g key={i}>
                  <line x1={tx} y1={CHART_BOTTOM} x2={tx} y2={CHART_BOTTOM + 5} stroke={GRID} strokeWidth="1" />
                  <text
                    x={tx}
                    y={TICK_Y}
                    textAnchor={i === 0 ? 'start' : i === scene.ticks.length - 1 ? 'end' : 'middle'}
                    fontFamily="var(--apple-font-text)"
                    fontSize="13"
                    fontWeight={600}
                    fill={TEXT_TERT}
                    letterSpacing="0.1em"
                    style={{ textTransform: 'uppercase', fontVariantNumeric: 'tabular-nums' }}
                  >
                    {t}
                  </text>
                </g>
              )
            })}
          </g>

          {/* candles */}
          {scene.candles.map((c, i) => (
            <CandleEl key={i} idx={i} c={c} />
          ))}

          {/* predator pulse. Soft halo + dot + downward arrow above the predator candle */}
          {scene.predator.idx >= 0 && (
            <g className="acd-pred-mark">
              <circle cx={predatorX} cy={predatorY} r="30" fill="url(#acd-grad-halo)" />
              <circle cx={predatorX} cy={predatorY} r="6" fill={APPLE_RED} />
              <circle cx={predatorX} cy={predatorY} r="6" fill="none" stroke="#fff" strokeWidth="1.5" />
              <path d={`M ${predatorX - 6} ${predatorY + 8} L ${predatorX} ${predatorY + 16} L ${predatorX + 6} ${predatorY + 8} Z`} fill={APPLE_RED} />
            </g>
          )}

          {/* victim position line (red dashed) */}
          <line
            className="acd-victim-line"
            x1={PAD_X / 2}
            y1={victimY}
            x2={victimBreakX}
            y2={victimY}
            stroke={APPLE_RED}
            strokeWidth="1.6"
            strokeDasharray="5 4"
            opacity="0.9"
          />

          {/* victim tag. Pill chip at left */}
          <g className="acd-victim-tag">
            <rect
              x={PAD_X / 2 + 1}
              y={victimY - 14}
              width={scene.victim.label.length * 8.2 + 18}
              height={26}
              rx="5"
              fill="#fff"
              stroke={APPLE_RED}
              strokeWidth="1.2"
            />
            <text
              x={PAD_X / 2 + 10}
              y={victimY + 4}
              fontFamily="var(--apple-font-text)"
              fontSize="13"
              fontWeight={700}
              fill={APPLE_RED}
              letterSpacing="0.06em"
              style={{ textTransform: 'uppercase', fontVariantNumeric: 'tabular-nums' }}
            >
              {scene.victim.label}
            </text>
          </g>

          {/* break / liquidation marker */}
          {scene.victim.breakIdx >= 0 && (
            <>
              <g className="acd-liq-mark">
                <circle cx={liqX} cy={victimY} r="12" fill="#fff" stroke={APPLE_RED} strokeWidth="1.6" />
                <line x1={liqX - 5} y1={victimY - 5} x2={liqX + 5} y2={victimY + 5} stroke={APPLE_RED} strokeWidth="2.4" strokeLinecap="round" />
                <line x1={liqX - 5} y1={victimY + 5} x2={liqX + 5} y2={victimY - 5} stroke={APPLE_RED} strokeWidth="2.4" strokeLinecap="round" />
              </g>
              {scene.victim.liqLabel && (
                <g className="acd-liq-label">
                  <text
                    x={liqLabelX}
                    y={victimY + 5}
                    textAnchor={liqLabelAnchor}
                    fontFamily="var(--apple-font-text)"
                    fontSize="15"
                    fontWeight={700}
                    fill={APPLE_RED}
                    letterSpacing="0.04em"
                    style={{ textTransform: 'uppercase', fontVariantNumeric: 'tabular-nums' }}
                  >
                    {scene.victim.liqLabel}
                  </text>
                </g>
              )}
            </>
          )}
        </svg>
      </div>
    </div>
  )
}

export function Diagram({ mechanism, ...props }: { mechanism: Mechanism } & ChartProps) {
  const kind = getKind(mechanism)
  const scene = buildScene(kind, props)
  return <CandleChart scene={scene} />
}
