'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { useMemo } from 'react'

const COLS = 30
const ROWS = 14

export function Card1Block({ active }: { active: boolean }) {
  const reduced = useReducedMotion()

  const cells = useMemo(() => {
    const out: { x: number; y: number; key: string; delay: number }[] = []
    const cx = (COLS - 1) / 2
    const cy = (ROWS - 1) / 2
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const d = Math.hypot(c - cx, r - cy)
        out.push({ x: c, y: r, key: `${r}-${c}`, delay: 1.45 + d * 0.018 })
      }
    }
    return out
  }, [])

  return (
    <div className="flex flex-col items-center gap-8 px-6 py-10 md:px-12 md:py-12">

      <div className="flex flex-col items-center gap-4">
        <motion.button
          type="button"
          tabIndex={-1}
          initial={{ scale: 1 }}
          animate={
            active && !reduced
              ? { scale: [1, 1, 0.94, 1.02, 1] }
              : { scale: 1 }
          }
          transition={{
            duration: 1.4,
            delay: 0.4,
            times: [0, 0.55, 0.72, 0.82, 1],
            ease: [0.4, 0, 0.2, 1],
          }}
          style={{
            fontFamily: 'var(--apple-font-text)',
            fontSize: '17px',
            fontWeight: 600,
            letterSpacing: 'var(--apple-track-tight)',
            color: '#ffffff',
            background: '#2997ff',
            border: 'none',
            padding: '14px 36px',
            borderRadius: 999,
            cursor: 'default',
            boxShadow: '0 12px 32px rgba(41,151,255,0.35), 0 0 0 0 rgba(41,151,255,0.4)',
          }}
        >
          Buy the basket — $100
        </motion.button>

        <motion.div
          className="flex items-center gap-2 tabular-nums"
          initial={{ opacity: 0 }}
          animate={active && !reduced ? { opacity: 1 } : { opacity: reduced ? 1 : 0 }}
          transition={{ duration: 0.3, delay: 1.3 }}
        >
          <span
            style={{
              fontFamily: 'var(--apple-font-text)',
              fontSize: '11px',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.5)',
            }}
          >
            1 click
          </span>
          <span style={{ color: 'rgba(255,255,255,0.35)' }}>·</span>
          <span
            style={{
              fontFamily: 'var(--apple-font-text)',
              fontSize: '11px',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.5)',
            }}
          >
            1 transaction
          </span>
          <span style={{ color: 'rgba(255,255,255,0.35)' }}>·</span>
          <span
            style={{
              fontFamily: 'var(--apple-font-text)',
              fontSize: '11px',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.5)',
            }}
          >
            <span style={{ color: 'rgba(41,151,255,0.95)', fontWeight: 600 }}>10,000</span> markets
          </span>
        </motion.div>
      </div>

      <div className="w-full max-w-[640px]" style={{ aspectRatio: `${COLS} / ${ROWS}` }}>
        <svg
          viewBox={`-1 -1 ${COLS + 1} ${ROWS + 1}`}
          width="100%"
          height="100%"
          aria-hidden
        >
          {cells.map((c) => (
            <motion.rect
              key={c.key}
              x={c.x}
              y={c.y}
              width={0.7}
              height={0.7}
              rx={0.12}
              fill="#2997ff"
              initial={{ opacity: 0.08, scale: 0.6 }}
              animate={
                active && !reduced
                  ? { opacity: [0.08, 0.95, 0.55], scale: [0.6, 1.15, 1] }
                  : reduced
                    ? { opacity: 0.55, scale: 1 }
                    : { opacity: 0.08, scale: 0.6 }
              }
              style={{ originX: `${c.x + 0.35}px`, originY: `${c.y + 0.35}px` }}
              transition={{
                duration: 0.55,
                delay: c.delay,
                ease: [0.25, 0.1, 0.3, 1],
                times: [0, 0.45, 1],
              }}
            />
          ))}
        </svg>
      </div>

      <div className="grid grid-cols-2 gap-6 w-full max-w-[640px]">
        <div
          className="flex flex-col gap-1"
          style={{
            padding: '12px 14px',
            borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(255,255,255,0.025)',
            opacity: 0.6,
          }}
        >
          <span
            style={{
              fontFamily: 'var(--apple-font-text)',
              fontSize: '10px',
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.4)',
            }}
          >
            Polymarket / Kalshi
          </span>
          <span
            style={{
              fontFamily: 'var(--apple-font-display)',
              fontSize: '17px',
              fontWeight: 500,
              letterSpacing: 'var(--apple-track-tight)',
              color: 'rgba(255,255,255,0.85)',
              lineHeight: 1.3,
            }}
          >
            10,000 trades
          </span>
          <span
            style={{
              fontFamily: 'var(--apple-font-text)',
              fontSize: '11.5px',
              color: 'rgba(255,255,255,0.45)',
              lineHeight: 1.5,
            }}
          >
            One click per market. Hours of decisions.
          </span>
        </div>

        <div
          className="flex flex-col gap-1"
          style={{
            padding: '12px 14px',
            borderRadius: 12,
            border: '1px solid rgba(41,151,255,0.32)',
            background: 'rgba(41,151,255,0.08)',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--apple-font-text)',
              fontSize: '10px',
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'rgba(41,151,255,0.9)',
              fontWeight: 600,
            }}
          >
            General Market
          </span>
          <span
            style={{
              fontFamily: 'var(--apple-font-display)',
              fontSize: '17px',
              fontWeight: 600,
              letterSpacing: 'var(--apple-track-tight)',
              color: '#ffffff',
              lineHeight: 1.3,
            }}
          >
            1 trade
          </span>
          <span
            style={{
              fontFamily: 'var(--apple-font-text)',
              fontSize: '11.5px',
              color: 'rgba(255,255,255,0.65)',
              lineHeight: 1.5,
            }}
          >
            Buy one ITP. Own all 10,000 markets.
          </span>
        </div>
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
            fontSize: 'clamp(26px, 3.8vw, 36px)',
            fontWeight: 600,
            letterSpacing: 'var(--apple-track-tight)',
            color: '#ffffff',
            lineHeight: 1.1,
          }}
        >
          One transaction. Every market.
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
          Buy 10,000 prediction markets in a single click.
        </p>
      </div>
    </div>
  )
}
