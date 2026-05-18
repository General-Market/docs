'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { useMemo } from 'react'

const COLS = 14
const ROWS = 10
const DOT_RADIUS = 3
const GAP = 28

export function Card1Block({ active }: { active: boolean }) {
  const reduced = useReducedMotion()

  const dots = useMemo(() => {
    const out: { x: number; y: number; key: string; delay: number }[] = []
    const cx = ((COLS - 1) * GAP) / 2
    const cy = ((ROWS - 1) * GAP) / 2
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const x = c * GAP
        const y = r * GAP
        const d = Math.hypot(x - cx, y - cy)
        out.push({ x, y, key: `${r}-${c}`, delay: 0.4 + d * 0.004 })
      }
    }
    return out
  }, [])

  const width = (COLS - 1) * GAP
  const height = (ROWS - 1) * GAP
  const centerX = width / 2
  const centerY = height / 2

  return (
    <div className="flex flex-col items-center justify-center gap-10 px-6 py-12 md:px-12 md:py-16">
      <div
        className="relative"
        style={{
          width: '100%',
          maxWidth: width,
          aspectRatio: `${width} / ${height + 60}`,
        }}
      >
        <svg
          viewBox={`-20 -20 ${width + 40} ${height + 40}`}
          className="w-full h-full"
          aria-hidden
        >
          {dots.map((d) => (
            <motion.circle
              key={d.key}
              cx={d.x}
              cy={d.y}
              r={DOT_RADIUS}
              fill="#ffffff"
              fillOpacity={0.32}
              initial={{ cx: d.x, cy: d.y, opacity: 0.32, scale: 1 }}
              animate={
                active && !reduced
                  ? {
                      cx: centerX,
                      cy: centerY,
                      opacity: [0.32, 0.32, 0],
                      scale: [1, 1, 0.4],
                    }
                  : { cx: d.x, cy: d.y, opacity: 0.32, scale: 1 }
              }
              transition={{
                duration: 1.6,
                delay: d.delay,
                ease: [0.4, 0, 0.2, 1],
                times: [0, 0.6, 1],
              }}
            />
          ))}

          <motion.rect
            x={centerX - 64}
            y={centerY - 24}
            width={128}
            height={48}
            rx={12}
            fill="#2997ff"
            initial={{ opacity: 0, scale: 0.4 }}
            animate={active && !reduced ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.4 }}
            transition={{ duration: 0.45, delay: 1.7, ease: [0.4, 0, 0.2, 1] }}
          />
          <motion.text
            x={centerX}
            y={centerY}
            textAnchor="middle"
            dominantBaseline="central"
            fill="#ffffff"
            fontFamily='"SF Pro Display", -apple-system, system-ui, sans-serif'
            fontSize="15"
            fontWeight="600"
            letterSpacing="-0.022em"
            initial={{ opacity: 0 }}
            animate={active && !reduced ? { opacity: 1 } : { opacity: 0 }}
            transition={{ duration: 0.3, delay: 1.85 }}
          >
            ITP · 10,000
          </motion.text>
        </svg>
      </div>

      <div className="flex flex-col items-center text-center max-w-[640px]">
        <div
          style={{
            fontFamily: 'var(--apple-font-display)',
            fontSize: 'var(--apple-fs-12)',
            letterSpacing: '0.08em',
            color: 'rgba(255,255,255,0.55)',
            textTransform: 'uppercase',
          }}
        >
          Block trading
        </div>
        <h2
          className="mt-3"
          style={{
            fontFamily: 'var(--apple-font-display)',
            fontSize: 'clamp(28px, 4vw, 40px)',
            fontWeight: 600,
            letterSpacing: 'var(--apple-track-tight)',
            color: '#ffffff',
            lineHeight: 1.1,
          }}
        >
          One trade. Every market.
        </h2>
        <p
          className="mt-4"
          style={{
            fontFamily: 'var(--apple-font-text)',
            fontSize: '17px',
            letterSpacing: 'var(--apple-track-tight)',
            color: 'rgba(255,255,255,0.7)',
            lineHeight: 1.5,
          }}
        >
          You stopped picking horses. You bought the racetrack.
        </p>
      </div>
    </div>
  )
}
