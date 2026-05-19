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
const VH = 200
const PAD_X = 22
const SLOT = (VW - PAD_X * 2) / N
const BODY_W = 12
const CHART_TOP = 26
const CHART_BOTTOM = 168

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

function flat(n: number, mid: number, jitter = 2): Candle[] {
  return Array.from({ length: n }, (_, k) => {
    const o = mid + Math.sin(k * 1.7) * jitter
    const c = mid + Math.cos(k * 2.3) * jitter
    const h = Math.max(o, c) + jitter * 0.6
    const l = Math.min(o, c) - jitter * 0.6
    return { o, h, l, c, role: c >= o ? 'up' : 'down' }
  })
}

function ramp(n: number, from: number, to: number, role: Role = 'up'): Candle[] {
  const step = (to - from) / n
  return Array.from({ length: n }, (_, k) => {
    const o = from + step * k
    const c = from + step * (k + 1)
    const h = Math.max(o, c) + Math.abs(step) * 0.4 + 0.6
    const l = Math.min(o, c) - Math.abs(step) * 0.4 - 0.6
    return { o, h, l, c, role }
  })
}

function frozen(n: number, mid: number): Candle[] {
  return Array.from({ length: n }, () => ({
    o: mid, h: mid + 0.6, l: mid - 0.6, c: mid, role: 'frozen' as Role,
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
      const base = flat(8, 52, 2)
      const wick: Candle = { o: 52, h: 53, l: 8, c: 50, role: 'predator' }
      const after = flat(3, 50, 1.5)
      return {
        candles: [...base, wick, ...after],
        ticks: ['10:42', '10:43', '10:44', '10:45'],
        victim: { y: 42, label: 'U STOP', breakIdx: 8, liqLabel: `LIQ ${lossTxt}` },
        predator: { label: `SCAM WICK${moveTxt ? ' · ' + moveTxt : ''}`, idx: 8 },
      }
    }

    case 'cliff': {
      const climb = ramp(10, 30, 80, 'up')
      const drop: Candle = { o: 80, h: 81, l: 8, c: 10, role: 'predator' }
      const dead = flat(1, 9, 0.5)
      return {
        candles: [...climb, drop, ...dead],
        ticks: ['DAY 1', 'DAY 30', 'DAY 60', 'DAY 91'],
        victim: { y: 76, label: 'U HOLDS', breakIdx: 10, liqLabel: `WIPED ${lossTxt}` },
        predator: { label: 'INSIDERS EXIT', idx: 10 },
      }
    }

    case 'runup': {
      // Flat then ramp before announcement. Insider buying ahead.
      const sleep = flat(6, 32, 1.5)
      const climb = ramp(5, 32, 82, 'predator')
      const peak: Candle = { o: 82, h: 90, l: 81, c: 88, role: 'predator' }
      return {
        candles: [...sleep, ...climb, peak],
        ticks: ['T−14d', 'T−7d', 'T−1d', 'EVENT'],
        victim: { y: 88, label: 'U BUYS', breakIdx: 11, liqLabel: `LATE ${lossTxt}` },
        predator: { label: 'INSIDERS BUY EARLY', idx: 10 },
      }
    }

    case 'dump': {
      const initial: Candle = { o: 32, h: 92, l: 30, c: 58, role: 'predator' }
      const grind = ramp(11, 58, 14, 'down')
      return {
        candles: [initial, ...grind],
        ticks: ['LIST', '+5m', '+1h', '+1d'],
        victim: { y: 78, label: 'U BUYS LIST', breakIdx: 0, liqLabel: `DOWN ${lossTxt}` },
        predator: { label: 'MM DUMPS LISTING', idx: 0 },
      }
    }

    case 'drain': {
      // Balance candles. Stable then a collapse.
      const stable = flat(9, 78, 1.2)
      const drained: Candle = { o: 78, h: 79, l: 4, c: 6, role: 'predator' }
      const zero = flat(2, 6, 0.8)
      return {
        candles: [...stable, drained, ...zero],
        ticks: ['T−9', 'T−6', 'T−3', 'NOW'],
        victim: { y: 74, label: 'USER BAL', breakIdx: 9, liqLabel: `DRAINED ${lossTxt}` },
        predator: { label: 'HOT WALLET → 0', idx: 9 },
      }
    }

    case 'freeze': {
      const ok = flat(3, 76, 1.2)
      const lock = frozen(6, 76)
      const collapse: Candle = { o: 76, h: 76, l: 18, c: 20, role: 'predator' }
      const after = flat(2, 20, 1)
      return {
        candles: [...ok, ...lock, collapse, ...after],
        ticks: ['BUY OK', 'BTN OFF', 'CRASH', '+1d'],
        victim: { y: 73, label: 'U LOCKED', breakIdx: 9, liqLabel: `LOCKED IN ${lossTxt}` },
        predator: { label: 'EXIT DENIED', idx: 9 },
      }
    }

    case 'carve': {
      // Rising bodies. But every candle has an oversized red upper wick
      // (the upside the venue carved off for itself).
      const candles = ramp(12, 30, 60, 'carved').map((c, i) => ({
        ...c,
        h: c.h + 12 + Math.abs(Math.sin(i * 0.9)) * 6,
      }))
      return {
        candles,
        ticks: ['T0', 'T3', 'T6', 'T9'],
        victim: { y: 50, label: 'U KEEPS', breakIdx: -1 },
        predator: { label: `VENUE TAKES UPSIDE${exTxt ? ' · ' + exTxt : ''}`, idx: -1 },
      }
    }

    case 'wash': {
      // Doji-like bodies in tight range. Fake volume, no net movement.
      const candles: Candle[] = Array.from({ length: 12 }, (_, k) => {
        const dir = k % 2 === 0 ? 1 : -1
        return {
          o: 50 - dir * 1.5,
          c: 50 + dir * 1.5,
          h: 50 + 6,
          l: 50 - 6,
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
  const bodyTop = py(Math.max(cd.o, cd.c))
  const bodyBot = py(Math.min(cd.o, cd.c))
  const bodyH = Math.max(2, bodyBot - bodyTop)
  const cls = `acd-candle acd-c-${idx}`

  if (role === 'frozen') {
    return (
      <g className={cls}>
        <line x1={x} y1={py(cd.h)} x2={x} y2={py(cd.l)} stroke={STROKE_SOFT} strokeWidth="1.2" strokeDasharray="2 2" opacity="0.55" />
        <rect x={x - BODY_W / 2} y={bodyTop - 1.5} width={BODY_W} height={4} fill="#fff" stroke={STROKE_SOFT} strokeWidth="1" strokeDasharray="2 2" opacity="0.6" rx="1" />
      </g>
    )
  }

  if (role === 'carved') {
    // Upper wick rendered in red (carved upside), body kept neutral.
    return (
      <g className={cls}>
        {/* red carved upper wick */}
        <line x1={x} y1={top} x2={x} y2={bodyTop} stroke={APPLE_RED} strokeWidth="1.8" strokeLinecap="round" />
        {/* lower wick */}
        <line x1={x} y1={bodyBot} x2={x} y2={bot} stroke={STROKE} strokeWidth="1.2" />
        {/* body (kept) */}
        <rect x={x - BODY_W / 2} y={bodyTop} width={BODY_W} height={bodyH} fill={STROKE} opacity="0.9" rx="1" />
      </g>
    )
  }

  const isPred = role === 'predator'
  const isUp = role === 'up'
  const bodyFill = isPred ? APPLE_RED : isUp ? '#ffffff' : STROKE
  const bodyStroke = isPred ? APPLE_RED : STROKE
  const wickStroke = isPred ? APPLE_RED : STROKE
  const wickWidth = isPred ? 1.8 : 1.4

  return (
    <g className={cls}>
      <line x1={x} y1={top} x2={x} y2={bot} stroke={wickStroke} strokeWidth={wickWidth} strokeLinecap="round" />
      <rect
        x={x - BODY_W / 2}
        y={bodyTop}
        width={BODY_W}
        height={bodyH}
        fill={bodyFill}
        stroke={bodyStroke}
        strokeWidth={isUp ? 1.4 : 0.8}
        rx="1"
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
  const predatorY = scene.predator.idx >= 0
    ? py(scene.candles[scene.predator.idx]?.h ?? 80) - 12
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
          {/* gridlines */}
          <g className="acd-chrome">
            <line x1={PAD_X / 2} y1={CHART_TOP} x2={VW - PAD_X / 2} y2={CHART_TOP} stroke={GRID_SOFT} strokeWidth="0.9" />
            <line x1={PAD_X / 2} y1={CHART_TOP + (CHART_BOTTOM - CHART_TOP) / 3} x2={VW - PAD_X / 2} y2={CHART_TOP + (CHART_BOTTOM - CHART_TOP) / 3} stroke={GRID_SOFT} strokeWidth="0.75" strokeDasharray="2 4" />
            <line x1={PAD_X / 2} y1={CHART_TOP + 2 * (CHART_BOTTOM - CHART_TOP) / 3} x2={VW - PAD_X / 2} y2={CHART_TOP + 2 * (CHART_BOTTOM - CHART_TOP) / 3} stroke={GRID_SOFT} strokeWidth="0.75" strokeDasharray="2 4" />
            <line x1={PAD_X / 2} y1={CHART_BOTTOM} x2={VW - PAD_X / 2} y2={CHART_BOTTOM} stroke={GRID} strokeWidth="1" />
            {/* time ticks */}
            {scene.ticks.map((t, i) => {
              const tx = PAD_X / 2 + (i / (scene.ticks.length - 1)) * (VW - PAD_X)
              return (
                <g key={i}>
                  <line x1={tx} y1={CHART_BOTTOM} x2={tx} y2={CHART_BOTTOM + 4} stroke={GRID} strokeWidth="1" />
                  <text
                    x={tx}
                    y={CHART_BOTTOM + 18}
                    textAnchor={i === 0 ? 'start' : i === scene.ticks.length - 1 ? 'end' : 'middle'}
                    fontFamily="var(--apple-font-text)"
                    fontSize="11"
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
              <circle cx={predatorX} cy={predatorY} r="22" fill={APPLE_RED} opacity="0.10" />
              <circle cx={predatorX} cy={predatorY} r="10" fill={APPLE_RED} opacity="0.18" />
              <circle cx={predatorX} cy={predatorY} r="4.5" fill={APPLE_RED} />
              <path d={`M ${predatorX - 5} ${predatorY + 7} L ${predatorX} ${predatorY + 14} L ${predatorX + 5} ${predatorY + 7} Z`} fill={APPLE_RED} />
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
            strokeWidth="1.4"
            strokeDasharray="4 3"
            opacity="0.9"
          />

          {/* victim tag. Pill chip at left */}
          <g className="acd-victim-tag">
            <rect
              x={PAD_X / 2 + 1}
              y={victimY - 11}
              width={scene.victim.label.length * 7.2 + 14}
              height={20}
              rx="4"
              fill="#fff"
              stroke={APPLE_RED}
              strokeWidth="1"
            />
            <text
              x={PAD_X / 2 + 8}
              y={victimY + 3}
              fontFamily="var(--apple-font-text)"
              fontSize="11"
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
                <circle cx={liqX} cy={victimY} r="9" fill="#fff" stroke={APPLE_RED} strokeWidth="1.2" />
                <line x1={liqX - 4} y1={victimY - 4} x2={liqX + 4} y2={victimY + 4} stroke={APPLE_RED} strokeWidth="2" strokeLinecap="round" />
                <line x1={liqX - 4} y1={victimY + 4} x2={liqX + 4} y2={victimY - 4} stroke={APPLE_RED} strokeWidth="2" strokeLinecap="round" />
              </g>
              {scene.victim.liqLabel && (
                <g className="acd-liq-label">
                  <text
                    x={liqLabelX}
                    y={victimY + 4}
                    textAnchor={liqLabelAnchor}
                    fontFamily="var(--apple-font-text)"
                    fontSize="13"
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
