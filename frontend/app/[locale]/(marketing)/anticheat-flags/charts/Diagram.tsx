'use client'

import type { ChartProps, Mechanism } from '../types'
import './diagram.css'

/* ──────────────────────────────────────────────────────────────────────────
   Mini candle chart per incident. Always-on conveyor: 12 candles visible,
   sliding left while new ones enter on the right. Every candle's open is
   the previous candle's close — gapless. The accent is red — the predator
   role. The user is a horizontal price line. When the predator candle
   crosses it, the line breaks. The market scapegoats one participant in
   order to keep moving.
   ────────────────────────────────────────────────────────────────────────── */

const APPLE_RED = '#FF3B30'
const STROKE = '#2c2c2e'
const STROKE_SOFT = '#c7c7cc'
const GRID = 'rgba(0, 0, 0, 0.09)'
const TEXT_TERT = '#6e6e73'

const N = 12
const VW = 400
const VH = 260
const PAD_X = 20
const SLOT = (VW - PAD_X * 2) / N        // 30
const BODY_W = SLOT - 2                   // 28 — bodies practically touch
const CHART_TOP = 32
const CHART_BOTTOM = 222
const TICK_Y = 244
const MIN_BODY_H = 14
const STRIP_W = N * SLOT                  // 360 = the visible scroll width

function cx(stripIdx: number): number {
  return PAD_X + SLOT * (stripIdx + 0.5)
}

function py(p: number): number {
  // p: 0..100, 0 = bottom, 100 = top
  return CHART_BOTTOM - (p / 100) * (CHART_BOTTOM - CHART_TOP)
}

type Role = 'up' | 'down' | 'predator' | 'frozen' | 'carved'

interface Candle {
  o: number
  h: number
  l: number
  c: number
  role: Role
}

interface Scene {
  candles: Candle[]            // exactly N, cyclic: C[N-1] === O[0]
  ticks: [string, string, string, string]
  victim: {
    y: number
    label: string
    breakIdx: number           // -1 = no break
    liqLabel?: string
  }
  predator: {
    label: string
    idx: number                // -1 = no predator marker
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

/* ── Walker ─────────────────────────────────────────────────────────────
   Deterministic random-walk segment. Each candle's open is set by the
   caller (= previous candle's close), so the chain stays gapless. */

function walkSegment(opts: {
  startOpen: number
  targetClose: number
  steps: number
  noise: number
  role?: Role
  seed?: number
}): Candle[] {
  const { startOpen, targetClose, steps, noise, role, seed = 0 } = opts
  const drift = (targetClose - startOpen) / steps
  const out: Candle[] = []
  let open = startOpen
  for (let k = 0; k < steps; k++) {
    const wave = Math.sin((k + seed) * 1.7 + 0.3) * noise + Math.cos((k + seed) * 2.4 + 1.1) * noise * 0.6
    let close = open + drift + wave
    if (k === steps - 1) close = targetClose // pin exact close for seamless join
    const swing = Math.abs(close - open)
    const wickHi = Math.abs(Math.cos((k + seed) * 0.8 + 0.4)) * noise * 0.7 + 1.5
    const wickLo = Math.abs(Math.sin((k + seed) * 1.3 + 0.7)) * noise * 0.7 + 1.5
    const h = Math.max(open, close) + wickHi + swing * 0.2
    const l = Math.min(open, close) - wickLo - swing * 0.2
    const detected: Role = close >= open ? 'up' : 'down'
    out.push({ o: open, h, l, c: close, role: role ?? detected })
    open = close
  }
  return out
}

function predatorCandle({
  open, close, lowExtra = 0, highExtra = 0, role = 'predator' as Role,
}: { open: number; close: number; lowExtra?: number; highExtra?: number; role?: Role }): Candle {
  const isDown = close < open
  const baseLow = Math.min(open, close) - 1
  const baseHi = Math.max(open, close) + 1
  return {
    o: open,
    c: close,
    h: baseHi + (isDown ? highExtra : highExtra + 4),
    l: baseLow - (isDown ? lowExtra + 4 : lowExtra),
    role,
  }
}

function frozenCandle(mid: number): Candle {
  return { o: mid, c: mid, h: mid + 1, l: mid - 1, role: 'frozen' }
}

/* ── Scenes — every series cycles: C[11] === O[0] ───────────────────── */

function buildScene(kind: SceneKind, p: ChartProps): Scene {
  const lossTxt = p.loss ?? ''
  const moveTxt = p.pctMove ?? ''
  const exTxt = p.extracted ?? ''

  switch (kind) {
    case 'spike': {
      // Stable trading, sudden wick to the low, recovery. Cycle: 56 → 56.
      const a = walkSegment({ startOpen: 56, targetClose: 54, steps: 4, noise: 5 })
      const b = walkSegment({ startOpen: 54, targetClose: 56, steps: 4, noise: 4, seed: 4 })
      const wick = predatorCandle({ open: 56, close: 54, lowExtra: 48 }) // l ≈ 5
      const c = walkSegment({ startOpen: 54, targetClose: 56, steps: 3, noise: 4, seed: 8 })
      const candles = [...a, ...b, wick, ...c]
      return {
        candles,
        ticks: ['10:42', '10:43', '10:44', '10:45'],
        victim: { y: 46, label: 'U STOP', breakIdx: 8, liqLabel: `LIQ ${lossTxt}` },
        predator: { label: `SCAM WICK${moveTxt ? ' · ' + moveTxt : ''}`, idx: 8 },
      }
    }

    case 'cliff': {
      // 22 → climb to 80 → predator drop → 8 → 22. Cycle.
      const climb = walkSegment({ startOpen: 22, targetClose: 80, steps: 8, noise: 5 })
      const drop = predatorCandle({ open: 80, close: 12, lowExtra: 4 })
      const dead = walkSegment({ startOpen: 12, targetClose: 10, steps: 1, noise: 1 })
      const restart = walkSegment({ startOpen: 10, targetClose: 22, steps: 2, noise: 3, seed: 10 })
      const candles = [...climb, drop, ...dead, ...restart]
      return {
        candles,
        ticks: ['DAY 1', 'DAY 30', 'DAY 60', 'DAY 91'],
        victim: { y: 78, label: 'U HOLDS', breakIdx: 8, liqLabel: `WIPED ${lossTxt}` },
        predator: { label: 'INSIDERS EXIT', idx: 8 },
      }
    }

    case 'runup': {
      // Flat 32 → predator buys 32→80 → dump back to 32. Cycle.
      const sleep = walkSegment({ startOpen: 32, targetClose: 32, steps: 5, noise: 4 })
      const climb = walkSegment({ startOpen: 32, targetClose: 80, steps: 4, noise: 4, role: 'predator', seed: 5 })
      const peak = predatorCandle({ open: 80, close: 88, highExtra: 4 })
      const dump = walkSegment({ startOpen: 88, targetClose: 60, steps: 1, noise: 2 })
      const back = walkSegment({ startOpen: 60, targetClose: 32, steps: 1, noise: 2, seed: 11 })
      const candles = [...sleep, ...climb, peak, ...dump, ...back]
      return {
        candles,
        ticks: ['T−14d', 'T−7d', 'T−1d', 'EVENT'],
        victim: { y: 86, label: 'U BUYS', breakIdx: 9, liqLabel: `LATE ${lossTxt}` },
        predator: { label: 'INSIDERS BUY EARLY', idx: 9 },
      }
    }

    case 'dump': {
      // Pump at listing → grind down → recover to start. Cycle: 22 → 22.
      const pump = predatorCandle({ open: 22, close: 60, highExtra: 30 })
      const grind = walkSegment({ startOpen: 60, targetClose: 14, steps: 9, noise: 4, role: 'down', seed: 3 })
      const recover = walkSegment({ startOpen: 14, targetClose: 22, steps: 2, noise: 3, seed: 12 })
      const candles = [pump, ...grind, ...recover]
      return {
        candles,
        ticks: ['LIST', '+5m', '+1h', '+1d'],
        victim: { y: 78, label: 'U BUYS LIST', breakIdx: 0, liqLabel: `DOWN ${lossTxt}` },
        predator: { label: 'MM DUMPS LISTING', idx: 0 },
      }
    }

    case 'drain': {
      // Lifecycle: drained at 12 → user refills to 78 → stable → drained → drained.
      const wreck = walkSegment({ startOpen: 12, targetClose: 12, steps: 3, noise: 2 })
      const refill = walkSegment({ startOpen: 12, targetClose: 78, steps: 2, noise: 4, seed: 3 })
      const stable = walkSegment({ startOpen: 78, targetClose: 78, steps: 4, noise: 5, seed: 5 })
      const drained = predatorCandle({ open: 78, close: 14, lowExtra: 6 })
      const aftermath = walkSegment({ startOpen: 14, targetClose: 12, steps: 2, noise: 2, seed: 10 })
      const candles = [...wreck, ...refill, ...stable, drained, ...aftermath]
      return {
        candles,
        ticks: ['T−9', 'T−6', 'T−3', 'NOW'],
        victim: { y: 72, label: 'USER BAL', breakIdx: 9, liqLabel: `DRAINED ${lossTxt}` },
        predator: { label: 'HOT WALLET → 0', idx: 9 },
      }
    }

    case 'freeze': {
      // Trading ok → frozen → crash → recover. Cycle: 76 → 76.
      const ok = walkSegment({ startOpen: 76, targetClose: 76, steps: 2, noise: 4 })
      const lock = Array.from({ length: 4 }, () => frozenCandle(76))
      const collapse = predatorCandle({ open: 76, close: 20, lowExtra: 4 })
      const aftermath = walkSegment({ startOpen: 20, targetClose: 22, steps: 2, noise: 3, seed: 7 })
      const recover = walkSegment({ startOpen: 22, targetClose: 76, steps: 3, noise: 4, seed: 11 })
      const candles = [...ok, ...lock, collapse, ...aftermath, ...recover]
      return {
        candles,
        ticks: ['BUY OK', 'BTN OFF', 'CRASH', '+1d'],
        victim: { y: 72, label: 'U LOCKED', breakIdx: 6, liqLabel: `LOCKED IN ${lossTxt}` },
        predator: { label: 'EXIT DENIED', idx: 6 },
      }
    }

    case 'carve': {
      // Bodies walk slowly around 50; every candle has a tall red upper wick.
      const base = walkSegment({ startOpen: 50, targetClose: 50, steps: 12, noise: 5 })
      const candles = base.map<Candle>((cd, i) => ({
        ...cd,
        role: 'carved',
        h: cd.h + 14 + Math.abs(Math.sin(i * 0.9)) * 8,
      }))
      return {
        candles,
        ticks: ['T0', 'T3', 'T6', 'T9'],
        victim: { y: 50, label: 'U KEEPS', breakIdx: -1 },
        predator: { label: `VENUE TAKES UPSIDE${exTxt ? ' · ' + exTxt : ''}`, idx: -1 },
      }
    }

    case 'wash': {
      // Doji-like bodies in tight band — fake volume, no net movement.
      const base = walkSegment({ startOpen: 50, targetClose: 50, steps: 12, noise: 5, role: 'predator' })
      // Stretch wicks so the volume looks pumped.
      const candles = base.map<Candle>((cd, i) => ({
        ...cd,
        h: cd.h + 4 + Math.abs(Math.sin(i * 1.1)) * 4,
        l: cd.l - 4 - Math.abs(Math.cos(i * 0.9)) * 4,
      }))
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

function CandleEl({ stripIdx, c: cd }: { stripIdx: number; c: Candle }) {
  const x = cx(stripIdx)
  const role = cd.role
  const top = py(cd.h)
  const bot = py(cd.l)
  const rawTop = py(Math.max(cd.o, cd.c))
  const rawBot = py(Math.min(cd.o, cd.c))
  const rawH = rawBot - rawTop

  let bodyTop = rawTop
  let bodyH = rawH
  if (rawH < MIN_BODY_H) {
    const grow = (MIN_BODY_H - rawH) / 2
    bodyTop = rawTop - grow
    bodyH = MIN_BODY_H
  }

  if (role === 'frozen') {
    return (
      <g>
        <line x1={x} y1={top} x2={x} y2={bot} stroke={STROKE_SOFT} strokeWidth="1.4" strokeDasharray="2 3" opacity="0.6" />
        <rect
          x={x - BODY_W / 2}
          y={bodyTop}
          width={BODY_W}
          height={bodyH}
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
    return (
      <g>
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
  const fill = isPred ? 'url(#acd-grad-pred)' : isUp ? 'url(#acd-grad-up)' : 'url(#acd-grad-down)'
  const stroke = isPred ? '#e02a20' : isUp ? STROKE_SOFT : STROKE
  const wickStroke = isPred ? APPLE_RED : STROKE
  const wickWidth = isPred ? 2 : 1.4

  return (
    <g>
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

function PredatorMarker({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r="28" fill="url(#acd-grad-halo)" />
      <circle cx={x} cy={y} r="6" fill={APPLE_RED} />
      <circle cx={x} cy={y} r="6" fill="none" stroke="#fff" strokeWidth="1.5" />
      <path d={`M ${x - 6} ${y + 8} L ${x} ${y + 16} L ${x + 6} ${y + 8} Z`} fill={APPLE_RED} />
    </g>
  )
}

function BreakMarker({ x, y, label, flipLabel }: { x: number; y: number; label?: string; flipLabel: boolean }) {
  return (
    <g>
      <circle cx={x} cy={y} r="12" fill="#fff" stroke={APPLE_RED} strokeWidth="1.6" />
      <line x1={x - 5} y1={y - 5} x2={x + 5} y2={y + 5} stroke={APPLE_RED} strokeWidth="2.4" strokeLinecap="round" />
      <line x1={x - 5} y1={y + 5} x2={x + 5} y2={y - 5} stroke={APPLE_RED} strokeWidth="2.4" strokeLinecap="round" />
      {label && (
        <text
          x={flipLabel ? x - 18 : x + 18}
          y={y + 5}
          textAnchor={flipLabel ? 'end' : 'start'}
          fontFamily="var(--apple-font-text)"
          fontSize="15"
          fontWeight={700}
          fill={APPLE_RED}
          letterSpacing="0.04em"
          style={{ textTransform: 'uppercase', fontVariantNumeric: 'tabular-nums' }}
        >
          {label}
        </text>
      )}
    </g>
  )
}

function CandleChart({ scene }: { scene: Scene }) {
  const dup = [...scene.candles, ...scene.candles]
  const victimY = py(scene.victim.y)
  const predIdx = scene.predator.idx
  const breakIdx = scene.victim.breakIdx
  // Flip the liq label when the break is in the right half — keeps text in-frame.
  const liqLabelLen = (scene.victim.liqLabel?.length ?? 0) * 8.5
  const flipForRight = breakIdx >= 0 && cx(breakIdx) + liqLabelLen + 24 > VW - PAD_X

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
            <clipPath id="acd-clip">
              <rect x={PAD_X - 1} y={0} width={VW - PAD_X * 2 + 2} height={CHART_BOTTOM + 6} />
            </clipPath>
          </defs>

          {/* baseline + axis ticks (static) */}
          <g>
            <line x1={PAD_X} y1={CHART_BOTTOM} x2={VW - PAD_X} y2={CHART_BOTTOM} stroke={GRID} strokeWidth="1" />
            {scene.ticks.map((t, i) => {
              const tx = PAD_X + (i / (scene.ticks.length - 1)) * (VW - PAD_X * 2)
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

          {/* victim line (static, across the chart) */}
          <line
            x1={PAD_X}
            y1={victimY}
            x2={VW - PAD_X}
            y2={victimY}
            stroke={APPLE_RED}
            strokeWidth="1.6"
            strokeDasharray="5 4"
            opacity="0.9"
          />

          {/* candle conveyor — clipped to chart area, sliding left */}
          <g clipPath="url(#acd-clip)">
            <g className="acd-strip">
              {dup.map((c, i) => (
                <CandleEl key={i} stripIdx={i} c={c} />
              ))}
              {/* predator markers — one per copy, travel with their candles */}
              {predIdx >= 0 && (
                <>
                  <PredatorMarker x={cx(predIdx)} y={Math.max(CHART_TOP + 14, py(scene.candles[predIdx].h) - 18)} />
                  <PredatorMarker x={cx(predIdx + N)} y={Math.max(CHART_TOP + 14, py(scene.candles[predIdx].h) - 18)} />
                </>
              )}
              {/* break markers + liq labels — anchored to predator candle */}
              {breakIdx >= 0 && (
                <>
                  <BreakMarker x={cx(breakIdx)} y={victimY} label={scene.victim.liqLabel} flipLabel={flipForRight} />
                  <BreakMarker x={cx(breakIdx + N)} y={victimY} label={scene.victim.liqLabel} flipLabel={flipForRight} />
                </>
              )}
            </g>
          </g>

          {/* victim pill chip — static, anchored to left edge */}
          <g>
            <rect
              x={PAD_X + 1}
              y={victimY - 14}
              width={scene.victim.label.length * 8.2 + 18}
              height={26}
              rx="5"
              fill="#fff"
              stroke={APPLE_RED}
              strokeWidth="1.2"
            />
            <text
              x={PAD_X + 10}
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
