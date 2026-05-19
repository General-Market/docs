'use client'

import type { ChartProps, Mechanism } from '../types'
import './diagram.css'

/* ──────────────────────────────────────────────────────────────────────────
   The diagram is now a Girardian snapshot — the moment of predation
   without the trading sequence around it.

   What remains: the user's price level (red dashed line + chip), the
   predator marker pulsing above the break point, and the liquidation
   X with its loss label. No candles, no time series. Just the act.
   ────────────────────────────────────────────────────────────────────────── */

const APPLE_RED = '#FF3B30'
const GRID = 'rgba(0, 0, 0, 0.09)'
const TEXT_TERT = '#6e6e73'

const VW = 400
const VH = 200
const PAD_X = 22
const CHART_TOP = 30
const CHART_BOTTOM = 168
const TICK_Y = 188

interface SceneMeta {
  ticks: [string, string, string, string]
  victim: {
    y: number                  // 0..100, 100 = top
    label: string
    breakFrac: number          // 0..1, x position along the chart, -1 = no break
    liqLabel?: string
  }
  predator: {
    label: string
  }
}

type SceneKind =
  | 'spike' | 'cliff' | 'runup' | 'dump'
  | 'drain' | 'freeze' | 'carve' | 'wash'

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

function buildScene(kind: SceneKind, p: ChartProps): SceneMeta {
  const lossTxt = p.loss ?? ''
  const moveTxt = p.pctMove ?? ''
  const exTxt = p.extracted ?? ''

  switch (kind) {
    case 'spike':
      return {
        ticks: ['10:42', '10:43', '10:44', '10:45'],
        victim: { y: 56, label: 'U STOP', breakFrac: 0.62, liqLabel: `LIQ ${lossTxt}` },
        predator: { label: `SCAM WICK${moveTxt ? ' · ' + moveTxt : ''}` },
      }
    case 'cliff':
      return {
        ticks: ['DAY 1', 'DAY 30', 'DAY 60', 'DAY 91'],
        victim: { y: 64, label: 'U HOLDS', breakFrac: 0.70, liqLabel: `WIPED ${lossTxt}` },
        predator: { label: 'INSIDERS EXIT' },
      }
    case 'runup':
      return {
        ticks: ['T−14d', 'T−7d', 'T−1d', 'EVENT'],
        victim: { y: 78, label: 'U BUYS', breakFrac: 0.78, liqLabel: `LATE ${lossTxt}` },
        predator: { label: 'INSIDERS BUY EARLY' },
      }
    case 'dump':
      return {
        ticks: ['LIST', '+5m', '+1h', '+1d'],
        victim: { y: 70, label: 'U BUYS LIST', breakFrac: 0.20, liqLabel: `DOWN ${lossTxt}` },
        predator: { label: 'MM DUMPS LISTING' },
      }
    case 'drain':
      return {
        ticks: ['T−9', 'T−6', 'T−3', 'NOW'],
        victim: { y: 64, label: 'USER BAL', breakFrac: 0.72, liqLabel: `DRAINED ${lossTxt}` },
        predator: { label: 'HOT WALLET → 0' },
      }
    case 'freeze':
      return {
        ticks: ['BUY OK', 'BTN OFF', 'CRASH', '+1d'],
        victim: { y: 60, label: 'U LOCKED', breakFrac: 0.62, liqLabel: `LOCKED IN ${lossTxt}` },
        predator: { label: 'EXIT DENIED' },
      }
    case 'carve':
      return {
        ticks: ['T0', 'T3', 'T6', 'T9'],
        victim: { y: 48, label: 'U KEEPS', breakFrac: -1, liqLabel: lossTxt ? `${lossTxt} CARVED` : undefined },
        predator: { label: `VENUE TAKES UPSIDE${exTxt ? ' · ' + exTxt : ''}` },
      }
    case 'wash':
      return {
        ticks: ['00:00', '00:15', '00:30', '00:45'],
        victim: { y: 50, label: 'NET 0', breakFrac: -1, liqLabel: lossTxt ? `${lossTxt} FAKE` : undefined },
        predator: { label: `MM WASHES VOLUME${exTxt ? ' · ' + exTxt : ''}` },
      }
  }
}

function py(p: number): number {
  return CHART_BOTTOM - (p / 100) * (CHART_BOTTOM - CHART_TOP)
}

function fracToX(f: number): number {
  return PAD_X + f * (VW - PAD_X * 2)
}

function CandleChart({ scene }: { scene: SceneMeta }) {
  const victimY = py(scene.victim.y)
  const hasBreak = scene.victim.breakFrac >= 0
  const breakX = hasBreak ? fracToX(scene.victim.breakFrac) : 0
  const predY = Math.max(CHART_TOP + 24, victimY - 56)

  // Flip the liq label when the break is in the right half — keeps text in-frame.
  const liqLabelLen = (scene.victim.liqLabel?.length ?? 0) * 8.5
  const flipLabel = hasBreak && breakX + liqLabelLen + 24 > VW - PAD_X

  // The chip width is sized to its label
  const chipW = scene.victim.label.length * 8.2 + 18

  return (
    <div className="acd-frame">
      <div className="acd-head">
        <span className="acd-eyebrow predator">{scene.predator.label}</span>
        <span className="acd-eyebrow victim">{scene.victim.label}</span>
      </div>

      <div className="acd-canvas">
        <svg viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="xMidYMid meet" aria-hidden>
          <defs>
            <radialGradient id="acd-grad-halo" cx="50%" cy="50%" r="50%">
              <stop offset="0%"   stopColor="#FF3B30" stopOpacity="0.40" />
              <stop offset="55%"  stopColor="#FF3B30" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#FF3B30" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* baseline + axis ticks */}
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

          {/* vertical hairline at the predation moment */}
          {hasBreak && (
            <line
              x1={breakX}
              y1={CHART_TOP + 4}
              x2={breakX}
              y2={CHART_BOTTOM}
              stroke={APPLE_RED}
              strokeWidth="0.75"
              strokeDasharray="2 4"
              opacity="0.55"
            />
          )}

          {/* victim's horizontal price line */}
          <line
            x1={PAD_X}
            y1={victimY}
            x2={VW - PAD_X}
            y2={victimY}
            stroke={APPLE_RED}
            strokeWidth="1.6"
            strokeDasharray="5 4"
            opacity={0.9}
          />

          {/* predator marker — pulsing halo + dot + arrow */}
          {hasBreak && (
            <g>
              <circle className="acd-pred-halo" cx={breakX} cy={predY} r="34" fill="url(#acd-grad-halo)" />
              <circle cx={breakX} cy={predY} r="7" fill={APPLE_RED} />
              <circle cx={breakX} cy={predY} r="7" fill="none" stroke="#fff" strokeWidth="1.6" />
              <path
                d={`M ${breakX - 6} ${predY + 9} L ${breakX} ${predY + 18} L ${breakX + 6} ${predY + 9} Z`}
                fill={APPLE_RED}
              />
            </g>
          )}

          {/* break X marker at the intersection */}
          {hasBreak && (
            <g>
              <circle cx={breakX} cy={victimY} r="13" fill="#fff" stroke={APPLE_RED} strokeWidth="1.6" />
              <line x1={breakX - 6} y1={victimY - 6} x2={breakX + 6} y2={victimY + 6} stroke={APPLE_RED} strokeWidth="2.4" strokeLinecap="round" />
              <line x1={breakX - 6} y1={victimY + 6} x2={breakX + 6} y2={victimY - 6} stroke={APPLE_RED} strokeWidth="2.4" strokeLinecap="round" />
            </g>
          )}

          {/* liq label */}
          {hasBreak && scene.victim.liqLabel && (
            <text
              x={flipLabel ? breakX - 20 : breakX + 20}
              y={victimY + 5}
              textAnchor={flipLabel ? 'end' : 'start'}
              fontFamily="var(--apple-font-text)"
              fontSize="15"
              fontWeight={700}
              fill={APPLE_RED}
              letterSpacing="0.04em"
              style={{ textTransform: 'uppercase', fontVariantNumeric: 'tabular-nums' }}
            >
              {scene.victim.liqLabel}
            </text>
          )}

          {/* victim pill chip — anchored to left edge */}
          <g>
            <rect
              x={PAD_X + 1}
              y={victimY - 14}
              width={chipW}
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
