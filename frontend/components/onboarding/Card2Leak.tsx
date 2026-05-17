'use client'

import { motion, useReducedMotion } from 'framer-motion'

type Row = {
  label: string
  extracted: number
  trader: number
  highlight?: boolean
}

const ROWS: Row[] = [
  { label: 'Options', extracted: 70, trader: 30 },
  { label: 'Perps', extracted: 65, trader: 35 },
  { label: 'Memecoins', extracted: 80, trader: 20 },
  { label: 'General Market', extracted: 3, trader: 97, highlight: true },
]

export function Card2Leak({ active }: { active: boolean }) {
  const reduced = useReducedMotion()

  return (
    <div className="flex flex-col items-center justify-center gap-10 px-6 py-10 md:px-12 md:py-14">
      <div className="w-full max-w-[640px]">
        <div
          className="flex items-center justify-between mb-5"
          style={{
            fontFamily: 'var(--apple-font-text)',
            fontSize: 'var(--apple-fs-12)',
            color: 'var(--apple-text-secondary)',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}
        >
          <span>Where every $100 actually goes</span>
          <div className="hidden md:flex items-center gap-4">
            <Legend color="#1d1d1f" label="Extractors" />
            <Legend color="#0071e3" label="You" />
          </div>
        </div>

        <div className="flex flex-col gap-4">
          {ROWS.map((row, i) => (
            <BarRow
              key={row.label}
              row={row}
              index={i}
              active={active}
              reduced={!!reduced}
            />
          ))}
        </div>

        <p
          className="mt-6"
          style={{
            fontFamily: 'var(--apple-font-text)',
            fontSize: 'var(--apple-fs-12)',
            color: 'var(--apple-text-secondary)',
            lineHeight: 1.5,
            fontStyle: 'italic',
          }}
        >
          Extractors include market-maker spreads, MEV, funding flows, liquidation cascades, and slippage to LPs.
          On options venues, ~88% of trader cost reaches Citadel, Susquehanna, Optiver, IMC — never another trader.
        </p>
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
          The leak
        </div>
        <h2
          className="mt-3"
          style={{
            fontFamily: 'var(--apple-font-display)',
            fontSize: 'clamp(26px, 3.6vw, 36px)',
            fontWeight: 600,
            letterSpacing: 'var(--apple-track-tight)',
            color: 'var(--apple-text)',
            lineHeight: 1.15,
          }}
        >
          Seventy cents of every dollar you traded
          <br className="hidden md:block" />
          went to someone who never had an opinion.
        </h2>
      </div>
    </div>
  )
}

function BarRow({
  row,
  index,
  active,
  reduced,
}: {
  row: Row
  index: number
  active: boolean
  reduced: boolean
}) {
  const delay = 0.15 + index * 0.18
  return (
    <div className="flex items-center gap-4">
      <div
        className="shrink-0 text-right"
        style={{
          width: 120,
          fontFamily: 'var(--apple-font-text)',
          fontSize: 'var(--apple-fs-14)',
          letterSpacing: 'var(--apple-track-tight)',
          color: row.highlight ? 'var(--apple-text)' : 'var(--apple-text-secondary)',
          fontWeight: row.highlight ? 600 : 400,
        }}
      >
        {row.label}
      </div>

      <div
        className="relative flex-1 overflow-hidden"
        style={{
          height: 28,
          borderRadius: 6,
          background: 'rgba(0,0,0,0.04)',
        }}
      >
        <motion.div
          className="absolute inset-y-0 left-0"
          style={{
            background: '#1d1d1f',
            opacity: row.highlight ? 0.25 : 0.92,
          }}
          initial={{ width: 0 }}
          animate={active && !reduced ? { width: `${row.extracted}%` } : { width: reduced ? `${row.extracted}%` : 0 }}
          transition={{ duration: 0.9, delay, ease: [0.25, 0.1, 0.3, 1] }}
        />
        <motion.div
          className="absolute inset-y-0"
          style={{
            background: '#0071e3',
            left: `${row.extracted}%`,
            width: `${row.trader}%`,
          }}
          initial={{ scaleX: 0, transformOrigin: 'left center' }}
          animate={
            active && !reduced ? { scaleX: 1 } : { scaleX: reduced ? 1 : 0 }
          }
          transition={{ duration: 0.7, delay: delay + 0.25, ease: [0.25, 0.1, 0.3, 1] }}
        />

        <motion.span
          className="absolute top-1/2 -translate-y-1/2 left-3"
          style={{
            color: '#fff',
            fontFamily: 'var(--apple-font-text)',
            fontSize: 'var(--apple-fs-12)',
            fontWeight: 600,
            fontVariantNumeric: 'tabular-nums',
            pointerEvents: 'none',
          }}
          initial={{ opacity: 0 }}
          animate={active && !reduced ? { opacity: row.extracted > 8 ? 1 : 0 } : { opacity: reduced ? 1 : 0 }}
          transition={{ duration: 0.3, delay: delay + 0.55 }}
        >
          {row.extracted}%
        </motion.span>
        <motion.span
          className="absolute top-1/2 -translate-y-1/2"
          style={{
            right: 10,
            color: '#fff',
            fontFamily: 'var(--apple-font-text)',
            fontSize: 'var(--apple-fs-12)',
            fontWeight: 600,
            fontVariantNumeric: 'tabular-nums',
            pointerEvents: 'none',
          }}
          initial={{ opacity: 0 }}
          animate={active && !reduced ? { opacity: row.trader > 8 ? 1 : 0 } : { opacity: reduced ? 1 : 0 }}
          transition={{ duration: 0.3, delay: delay + 0.7 }}
        >
          {row.trader}%
        </motion.span>
      </div>
    </div>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span
        className="inline-block"
        style={{ width: 10, height: 10, borderRadius: 2, background: color }}
      />
      <span>{label}</span>
    </span>
  )
}
