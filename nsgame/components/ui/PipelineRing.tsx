'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { springs } from '@/components/ui/spring'

export interface PipelineRingPhase {
  key: string
  label: string
}

export interface PipelineRingProps {
  phases: PipelineRingPhase[]
  /** Current phase index. -1 = not started, phases.length = done. */
  currentPhase: number
  /** 0..1 partial progress within the current phase (visual only). */
  phaseProgress?: number
  /** Either pass `elapsedMs` directly, or a `startedAt` epoch ms for the ring to self-tick. */
  elapsedMs?: number
  startedAt?: number
  typicalMs: number
  done: boolean
  /** 0-3 keeper dots lit around the ring. */
  keepersLit?: number
  /** Small copy shown below the centre time line (e.g. "shares landed"). */
  subLabel?: string
  /** Override the centre top line; defaults to the current phase label. */
  topLabel?: string
}

const SIZE = 240
const CENTER = SIZE / 2
const OUTER_R = 108
const INNER_R = 92
const KEEPER_R = 92
const GAP_DEG = 3.5 // angular gap between phase arcs

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function describeArc(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const start = polar(cx, cy, r, endDeg)
  const end = polar(cx, cy, r, startDeg)
  const largeArc = endDeg - startDeg <= 180 ? 0 : 1
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`
}

function formatClock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000))
  const mm = Math.floor(s / 60).toString().padStart(2, '0')
  const ss = (s % 60).toString().padStart(2, '0')
  return `${mm}:${ss}`
}

export function PipelineRing({
  phases,
  currentPhase,
  phaseProgress = 0,
  elapsedMs: elapsedMsProp,
  startedAt,
  typicalMs,
  done,
  keepersLit = 0,
  subLabel,
  topLabel,
}: PipelineRingProps) {
  const reduced = useReducedMotion()

  // Redraw at 4 Hz while waiting so the clock + outer ring progress.
  const [, tick] = useState(0)
  const rafRef = useRef<number | null>(null)
  useEffect(() => {
    if (done) return
    let last = 0
    const loop = (t: number) => {
      if (t - last > 250) {
        last = t
        tick(v => v + 1)
      }
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current) }
  }, [done])

  const elapsedMs = startedAt !== undefined
    ? Math.max(0, Date.now() - startedAt)
    : (elapsedMsProp ?? 0)

  const n = phases.length
  const sweep = (360 - GAP_DEG * n) / n
  const timeRatio = Math.min(1, elapsedMs / Math.max(1, typicalMs))

  const phaseState = (i: number): { fill: number; isCurrent: boolean; isPast: boolean } => {
    if (done || i < currentPhase) return { fill: 1, isCurrent: false, isPast: true }
    if (i === currentPhase) return { fill: Math.max(0.02, Math.min(1, phaseProgress)), isCurrent: true, isPast: false }
    return { fill: 0, isCurrent: false, isPast: false }
  }

  const keeperAngles = [150, 210, 270]
  const allLit = done || keepersLit >= 3

  const topText = topLabel ?? (done ? phases[phases.length - 1]?.label ?? '' : phases[currentPhase]?.label ?? phases[0]?.label ?? '')

  return (
    <div className="flex flex-col items-center justify-center select-none">
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="overflow-visible">
        {/* Outer time-budget ring background */}
        <circle
          cx={CENTER}
          cy={CENTER}
          r={OUTER_R}
          fill="none"
          stroke="rgb(255 255 255 / 0.06)"
          strokeWidth={2}
        />
        {/* Outer time-budget ring progress */}
        <motion.circle
          cx={CENTER}
          cy={CENTER}
          r={OUTER_R}
          fill="none"
          stroke="rgb(228 228 231 / 0.45)"
          strokeWidth={2}
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray={1}
          initial={false}
          animate={{ strokeDashoffset: 1 - timeRatio }}
          transition={reduced ? { duration: 0 } : { type: 'tween', duration: 0.6, ease: 'easeOut' }}
          style={{ transform: `rotate(-90deg)`, transformOrigin: `${CENTER}px ${CENTER}px` }}
        />

        {/* Phase arcs */}
        {phases.map((p, i) => {
          const start = GAP_DEG / 2 + i * (sweep + GAP_DEG)
          const end = start + sweep
          const state = phaseState(i)
          const bgPath = describeArc(CENTER, CENTER, INNER_R, start, end)
          const fgEnd = start + sweep * state.fill
          const fgPath = describeArc(CENTER, CENTER, INNER_R, start, fgEnd)
          const fgStroke = state.isPast ? '#34d399' /* emerald-400 */ : '#e4e4e7' /* zinc-200 */

          return (
            <g key={p.key}>
              <path d={bgPath} stroke="rgb(255 255 255 / 0.08)" strokeWidth={8} strokeLinecap="round" fill="none" />
              <motion.path
                d={fgPath}
                stroke={fgStroke}
                strokeWidth={8}
                strokeLinecap="round"
                fill="none"
                initial={false}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={reduced ? { duration: 0 } : springs.number}
              />
              {state.isCurrent && !done && !reduced && (
                <motion.path
                  d={bgPath}
                  stroke="#e4e4e7"
                  strokeWidth={10}
                  strokeLinecap="round"
                  fill="none"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 0.18, 0] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                />
              )}
            </g>
          )
        })}

        {/* Keeper dots on the inner radius at fixed angles */}
        {keeperAngles.map((deg, i) => {
          const p = polar(CENTER, CENTER, KEEPER_R, deg)
          const lit = allLit || i < keepersLit
          return (
            <g key={`k${i}`}>
              <circle cx={p.x} cy={p.y} r={5.5} fill="#18181b" stroke="rgb(255 255 255 / 0.15)" strokeWidth={1} />
              <motion.circle
                cx={p.x}
                cy={p.y}
                r={4}
                fill={lit ? '#34d399' : 'rgb(255 255 255 / 0.12)'}
                initial={false}
                animate={reduced ? { opacity: 1 } : { scale: lit ? [0.8, 1.1, 1] : 1 }}
                transition={reduced ? { duration: 0 } : { duration: 0.5, delay: i * 0.12, ease: 'easeOut' }}
                style={{ transformOrigin: `${p.x}px ${p.y}px` }}
              />
              {lit && !reduced && !done && (
                <motion.circle
                  cx={p.x}
                  cy={p.y}
                  r={4}
                  fill="none"
                  stroke="#34d399"
                  strokeWidth={1.5}
                  initial={{ opacity: 0.6, r: 4 }}
                  animate={{ opacity: 0, r: 11 }}
                  transition={{ duration: 1.4, repeat: Infinity, ease: 'easeOut', delay: i * 0.15 }}
                />
              )}
            </g>
          )
        })}

        {/* Centre medallion */}
        <circle cx={CENTER} cy={CENTER} r={64} fill="#18181b" stroke="rgb(255 255 255 / 0.06)" />
      </svg>

      {/* Centre text overlaps the medallion via absolute positioning */}
      <div className="-mt-[162px] h-[128px] w-[128px] flex flex-col items-center justify-center text-center px-2 pointer-events-none">
        <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-zinc-500">
          {done ? 'Done' : 'In flight'}
        </span>
        <span className="mt-1 text-[13px] font-medium text-zinc-100 leading-tight line-clamp-2">
          {topText}
        </span>
        <span className="mt-2 text-[10px] font-mono tabular-nums text-zinc-500">
          {formatClock(elapsedMs)} <span className="opacity-50">·</span> {formatClock(typicalMs)}
        </span>
        {subLabel && (
          <span className="mt-1 text-[10px] font-mono text-zinc-500 line-clamp-1 max-w-full">
            {subLabel}
          </span>
        )}
      </div>
      {/* Spacer so layout below the ring is predictable */}
      <div className="h-[34px]" />
    </div>
  )
}
