'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { useMemo } from 'react'

const COLS = 28
const ROWS = 12

export function Card3Liquidity({ active }: { active: boolean }) {
  const reduced = useReducedMotion()

  const cells = useMemo(() => {
    const out: { x: number; y: number; key: string; delay: number }[] = []
    const cx = (COLS - 1) / 2
    const cy = (ROWS - 1) / 2
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const d = Math.hypot(c - cx, r - cy)
        out.push({ x: c, y: r, key: `${r}-${c}`, delay: 1.4 + d * 0.018 })
      }
    }
    return out
  }, [])

  return (
    <div className="flex flex-col items-center justify-center gap-8 px-6 py-10 md:px-12 md:py-12">

      <div className="grid grid-cols-2 gap-4 w-full max-w-[640px]">
        <TraderCard
          name="Trader A"
          color="#2997ff"
          action="Buys the basket"
          subtitle="$100 · 10,000 YES positions"
          delay={0.3}
          active={active}
          reduced={!!reduced}
        />
        <TraderCard
          name="Trader B"
          color="#ffffff"
          action="Sells the basket"
          subtitle="$100 · 10,000 NO positions"
          delay={0.55}
          active={active}
          reduced={!!reduced}
        />
      </div>

      <motion.div
        className="flex flex-col items-center gap-2"
        initial={{ opacity: 0 }}
        animate={active && !reduced ? { opacity: 1 } : reduced ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 0.4, delay: 0.95 }}
      >
        <svg width="220" height="48" viewBox="0 0 220 48" fill="none" aria-hidden>
          <motion.path
            d="M30 4 Q30 24 110 24"
            stroke="rgba(41,151,255,0.55)"
            strokeWidth="1.5"
            fill="none"
            initial={{ pathLength: 0 }}
            animate={active && !reduced ? { pathLength: 1 } : { pathLength: 1 }}
            transition={{ duration: 0.6, delay: 0.95 }}
          />
          <motion.path
            d="M190 4 Q190 24 110 24"
            stroke="rgba(255,255,255,0.55)"
            strokeWidth="1.5"
            fill="none"
            initial={{ pathLength: 0 }}
            animate={active && !reduced ? { pathLength: 1 } : { pathLength: 1 }}
            transition={{ duration: 0.6, delay: 0.95 }}
          />
          <motion.path
            d="M110 24 L110 42"
            stroke="rgba(255,255,255,0.55)"
            strokeWidth="1.5"
            fill="none"
            initial={{ pathLength: 0 }}
            animate={active && !reduced ? { pathLength: 1 } : { pathLength: 1 }}
            transition={{ duration: 0.3, delay: 1.3 }}
          />
        </svg>
        <div
          className="text-center"
          style={{
            fontFamily: 'var(--apple-font-text)',
            fontSize: '11px',
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.55)',
            fontWeight: 600,
          }}
        >
          Two block trades · Every market matched
        </div>
      </motion.div>

      <div className="w-full max-w-[640px]" style={{ aspectRatio: `${COLS} / ${ROWS}` }}>
        <svg
          viewBox={`-0.5 -0.5 ${COLS} ${ROWS}`}
          width="100%"
          height="100%"
          aria-hidden
        >
          {cells.map((c) => (
            <g key={c.key}>
              <motion.rect
                x={c.x}
                y={c.y}
                width={0.85}
                height={0.4}
                rx={0.08}
                fill="#2997ff"
                initial={{ opacity: 0, scale: 0.3 }}
                animate={
                  active && !reduced
                    ? { opacity: 0.92, scale: 1 }
                    : reduced
                      ? { opacity: 0.85, scale: 1 }
                      : { opacity: 0, scale: 0.3 }
                }
                style={{ originX: `${c.x + 0.425}px`, originY: `${c.y + 0.2}px` }}
                transition={{ duration: 0.45, delay: c.delay, ease: [0.25, 0.1, 0.3, 1] }}
              />
              <motion.rect
                x={c.x}
                y={c.y + 0.45}
                width={0.85}
                height={0.4}
                rx={0.08}
                fill="#ffffff"
                initial={{ opacity: 0, scale: 0.3 }}
                animate={
                  active && !reduced
                    ? { opacity: 0.55, scale: 1 }
                    : reduced
                      ? { opacity: 0.5, scale: 1 }
                      : { opacity: 0, scale: 0.3 }
                }
                style={{ originX: `${c.x + 0.425}px`, originY: `${c.y + 0.65}px` }}
                transition={{ duration: 0.45, delay: c.delay + 0.06, ease: [0.25, 0.1, 0.3, 1] }}
              />
            </g>
          ))}
        </svg>
      </div>

      <div className="grid grid-cols-2 gap-3 w-full max-w-[640px]">
        <StatTile
          label="Markets liquid"
          value="10,000"
          accent="#2997ff"
          active={active}
          reduced={!!reduced}
          delay={2.4}
        />
        <StatTile
          label="Market makers needed"
          value="0"
          accent="#ffffff"
          active={active}
          reduced={!!reduced}
          delay={2.55}
        />
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
          Inherent liquidity
        </div>
        <h2
          className="mt-3"
          style={{
            fontFamily: 'var(--apple-font-display)',
            fontSize: 'clamp(26px, 3.8vw, 36px)',
            fontWeight: 600,
            letterSpacing: 'var(--apple-track-tight)',
            color: '#ffffff',
            lineHeight: 1.15,
          }}
        >
          Two traders. Ten thousand liquid markets.
        </h2>
        <p
          className="mt-3"
          style={{
            fontFamily: 'var(--apple-font-text)',
            fontSize: '17px',
            letterSpacing: 'var(--apple-track-tight)',
            color: 'rgba(255,255,255,0.7)',
            lineHeight: 1.5,
          }}
        >
          Polymarket needs a market maker for every market.
          <br className="hidden md:block" />
          Block trading is its own market maker.
        </p>
      </div>
    </div>
  )
}

function TraderCard({
  name,
  color,
  action,
  subtitle,
  delay,
  active,
  reduced,
}: {
  name: string
  color: string
  action: string
  subtitle: string
  delay: number
  active: boolean
  reduced: boolean
}) {
  const tinted = color === '#ffffff'
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={active && !reduced ? { opacity: 1, y: 0 } : reduced ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
      transition={{ duration: 0.4, delay, ease: [0.25, 0.1, 0.3, 1] }}
      className="flex items-center gap-3"
      style={{
        padding: '12px 14px',
        borderRadius: 12,
        background: tinted ? 'rgba(255,255,255,0.06)' : 'rgba(41,151,255,0.08)',
        border: `1px solid ${tinted ? 'rgba(255,255,255,0.14)' : 'rgba(41,151,255,0.3)'}`,
      }}
    >
      <div
        className="shrink-0"
        style={{
          width: 36,
          height: 36,
          borderRadius: 999,
          background: color,
          boxShadow: tinted ? 'inset 0 0 0 1px rgba(0,0,0,0.06)' : '0 6px 16px rgba(41,151,255,0.3)',
        }}
        aria-hidden
      />
      <div className="flex-1 min-w-0">
        <div
          style={{
            fontFamily: 'var(--apple-font-text)',
            fontSize: '11px',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: tinted ? 'rgba(255,255,255,0.55)' : 'rgba(41,151,255,0.95)',
            fontWeight: 600,
          }}
        >
          {name}
        </div>
        <div
          className="truncate"
          style={{
            fontFamily: 'var(--apple-font-text)',
            fontSize: 'var(--apple-fs-14)',
            color: '#ffffff',
            fontWeight: 500,
            letterSpacing: 'var(--apple-track-tight)',
            lineHeight: 1.3,
          }}
        >
          {action}
        </div>
        <div
          style={{
            fontFamily: 'var(--apple-font-text)',
            fontSize: '11.5px',
            color: 'rgba(255,255,255,0.55)',
            marginTop: 2,
          }}
        >
          {subtitle}
        </div>
      </div>
    </motion.div>
  )
}

function StatTile({
  label,
  value,
  accent,
  active,
  reduced,
  delay,
}: {
  label: string
  value: string
  accent: string
  active: boolean
  reduced: boolean
  delay: number
}) {
  const isZero = value === '0'
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={active && !reduced ? { opacity: 1, y: 0 } : reduced ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
      transition={{ duration: 0.4, delay, ease: [0.25, 0.1, 0.3, 1] }}
      className="flex flex-col gap-1"
      style={{
        padding: '12px 14px',
        borderRadius: 12,
        background: isZero ? 'rgba(255,255,255,0.04)' : 'rgba(41,151,255,0.08)',
        border: `1px solid ${isZero ? 'rgba(255,255,255,0.1)' : 'rgba(41,151,255,0.3)'}`,
      }}
    >
      <span
        style={{
          fontFamily: 'var(--apple-font-text)',
          fontSize: '11px',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.55)',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: 'var(--apple-font-display)',
          fontSize: 'clamp(24px, 3vw, 28px)',
          fontWeight: 600,
          letterSpacing: 'var(--apple-track-tight)',
          color: accent,
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1.1,
        }}
      >
        {value}
      </span>
    </motion.div>
  )
}
