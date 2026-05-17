'use client'

import { motion, useMotionValue, useSpring, useTransform, useReducedMotion } from 'framer-motion'
import { useEffect, useMemo } from 'react'

const GRID = 28
const TOTAL = GRID * GRID
const TARGET = 10000

export function Card3Liquidity({ active }: { active: boolean }) {
  const reduced = useReducedMotion()

  const cells = useMemo(() => {
    const out: { x: number; y: number; side: 'yes' | 'no'; delay: number }[] = []
    for (let r = 0; r < GRID; r++) {
      for (let c = 0; c < GRID; c++) {
        const dx = c - (GRID - 1) / 2
        const dy = r - (GRID - 1) / 2
        const d = Math.hypot(dx, dy)
        const side: 'yes' | 'no' = (r + c) % 2 === 0 ? 'yes' : 'no'
        out.push({ x: c, y: r, side, delay: d * 0.012 })
      }
    }
    return out
  }, [])

  const cellSize = 12
  const gap = 3
  const totalWidth = GRID * cellSize + (GRID - 1) * gap

  const count = useMotionValue(0)
  const smooth = useSpring(count, { stiffness: 60, damping: 22, mass: 0.9 })
  const display = useTransform(smooth, (v) => Math.round(v).toLocaleString())

  useEffect(() => {
    if (!active || reduced) {
      count.set(active ? TARGET : 0)
      return
    }
    const t = setTimeout(() => count.set(TARGET), 700)
    return () => clearTimeout(t)
  }, [active, count, reduced])

  return (
    <div className="flex flex-col items-center justify-center gap-10 px-6 py-10 md:px-12 md:py-14">
      <div className="relative flex items-center justify-center w-full" style={{ minHeight: 260 }}>
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex items-center justify-between px-2 md:px-4 z-10">
          <Trader side="left" color="#0071e3" label="Trader A" active={active} reduced={!!reduced} />
          <Trader side="right" color="#1d1d1f" label="Trader B" active={active} reduced={!!reduced} />
        </div>

        <motion.svg
          width={totalWidth}
          height={totalWidth}
          viewBox={`0 0 ${totalWidth} ${totalWidth}`}
          style={{ maxWidth: '100%', height: 'auto' }}
          aria-hidden
        >
          <motion.line
            x1={0}
            y1={totalWidth / 2}
            x2={totalWidth}
            y2={totalWidth / 2}
            stroke="#1d1d1f"
            strokeOpacity={0.35}
            strokeWidth={1.2}
            initial={{ pathLength: 0, opacity: 0 }}
            animate={active && !reduced ? { pathLength: 1, opacity: [0, 1, 1, 0] } : { opacity: 0 }}
            transition={{
              duration: 1.4,
              delay: 0.25,
              ease: [0.4, 0, 0.2, 1],
              times: [0, 0.3, 0.65, 1],
            }}
          />

          {cells.map((c, i) => {
            const cx = c.x * (cellSize + gap) + cellSize / 2
            const cy = c.y * (cellSize + gap) + cellSize / 2
            const fill = c.side === 'yes' ? '#0071e3' : '#1d1d1f'
            return (
              <motion.rect
                key={i}
                x={cx - cellSize / 2}
                y={cy - cellSize / 2}
                width={cellSize}
                height={cellSize}
                rx={2}
                fill={fill}
                initial={{ opacity: 0, scale: 0.2 }}
                animate={
                  active && !reduced
                    ? { opacity: c.side === 'yes' ? 0.85 : 0.7, scale: 1 }
                    : reduced
                      ? { opacity: 0.7, scale: 1 }
                      : { opacity: 0, scale: 0.2 }
                }
                style={{ originX: `${cx}px`, originY: `${cy}px` }}
                transition={{
                  duration: 0.5,
                  delay: 0.9 + c.delay,
                  ease: [0.25, 0.1, 0.3, 1],
                }}
              />
            )
          })}
        </motion.svg>
      </div>

      <div className="flex items-baseline gap-3 tabular-nums">
        <motion.span
          style={{
            fontFamily: 'var(--apple-font-display)',
            fontSize: 'clamp(40px, 6vw, 56px)',
            fontWeight: 600,
            letterSpacing: 'var(--apple-track-tight)',
            color: 'var(--apple-text)',
            lineHeight: 1,
          }}
        >
          {display}
        </motion.span>
        <span
          style={{
            fontFamily: 'var(--apple-font-text)',
            fontSize: 'var(--apple-fs-17)',
            letterSpacing: 'var(--apple-track-tight)',
            color: 'var(--apple-text-secondary)',
          }}
        >
          markets, both sides covered
        </span>
      </div>

      <div className="flex flex-col items-center text-center max-w-[640px]">
        <div
          style={{
            fontFamily: 'var(--apple-font-display)',
            fontSize: 'var(--apple-fs-12)',
            letterSpacing: '0.08em',
            color: 'var(--apple-text-secondary)',
            textTransform: 'uppercase',
          }}
        >
          Liquidity from nothing
        </div>
        <h2
          className="mt-3"
          style={{
            fontFamily: 'var(--apple-font-display)',
            fontSize: 'clamp(28px, 4vw, 40px)',
            fontWeight: 600,
            letterSpacing: 'var(--apple-track-tight)',
            color: 'var(--apple-text)',
            lineHeight: 1.1,
          }}
        >
          Two opinions. Ten thousand markets.
        </h2>
        <p
          className="mt-4"
          style={{
            fontFamily: 'var(--apple-font-text)',
            fontSize: '17px',
            letterSpacing: 'var(--apple-track-tight)',
            color: 'var(--apple-text-secondary)',
            lineHeight: 1.5,
          }}
        >
          The order book was a tax. We removed it.
        </p>
      </div>
    </div>
  )
}

function Trader({
  side,
  color,
  label,
  active,
  reduced,
}: {
  side: 'left' | 'right'
  color: string
  label: string
  active: boolean
  reduced: boolean
}) {
  const dir = side === 'left' ? -1 : 1
  return (
    <motion.div
      className="flex flex-col items-center gap-2"
      initial={{ opacity: 0, x: dir * 20 }}
      animate={active && !reduced ? { opacity: 1, x: 0 } : reduced ? { opacity: 1, x: 0 } : { opacity: 0, x: dir * 20 }}
      transition={{ duration: 0.4, delay: 0.05, ease: [0.25, 0.1, 0.3, 1] }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 999,
          background: color,
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
        }}
      />
      <span
        style={{
          fontFamily: 'var(--apple-font-text)',
          fontSize: 'var(--apple-fs-12)',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: 'var(--apple-text-secondary)',
        }}
      >
        {label}
      </span>
    </motion.div>
  )
}
