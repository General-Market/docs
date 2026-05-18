'use client'

import { motion, useMotionValue, useSpring, useTransform, useReducedMotion } from 'framer-motion'
import { useEffect } from 'react'
import { CitationCard, type CitationKind } from './CitationCard'

type Stage = {
  trades: number
  balance: number
  pct: number
}

const STAGES: Stage[] = [
  { trades: 0, balance: 100, pct: 100 },
  { trades: 50, balance: 60.50, pct: 60.5 },
  { trades: 100, balance: 36.60, pct: 36.6 },
  { trades: 150, balance: 22.16, pct: 22.2 },
  { trades: 200, balance: 13.40, pct: 13.4 },
]

const FINAL_BALANCE = 13.40
const LOST = 100 - FINAL_BALANCE

const CITATIONS: { kind: CitationKind; title: string; meta: string; href?: string }[] = [
  {
    kind: 'paper',
    title: 'Options: 88% to market makers',
    meta: 'Bryzgalova, Pavlova, Sikorskaya · Journal of Finance, 2023 · $4.13B retail cost → Citadel, Susquehanna, Optiver, IMC',
    href: 'https://doi.org/10.1111/jofi.13285',
  },
  {
    kind: 'data',
    title: 'Memecoins: 4% slippage per trade',
    meta: 'DefiLlama · Pump.fun 1% fee + ~4% Solana DEX slippage to LPs · compounds on every entry and exit',
    href: 'https://defillama.com/protocol/pumpfun',
  },
  {
    kind: 'data',
    title: 'Perps: liquidation engine + funding',
    meta: 'Hyperliquid public stats · ~80% of leveraged accounts close at loss · spread, funding, forced-close slippage',
    href: 'https://stats.hyperliquid.xyz/',
  },
]

export function Card2Leak({ active }: { active: boolean }) {
  const reduced = useReducedMotion()

  const balance = useMotionValue(100)
  const smoothBalance = useSpring(balance, { stiffness: 50, damping: 24, mass: 1 })
  const balanceText = useTransform(smoothBalance, (v) => `$${v.toFixed(2)}`)

  const trades = useMotionValue(0)
  const smoothTrades = useSpring(trades, { stiffness: 50, damping: 24, mass: 1 })
  const tradesText = useTransform(smoothTrades, (v) => Math.round(v).toLocaleString())

  useEffect(() => {
    if (!active || reduced) {
      balance.set(active ? FINAL_BALANCE : 100)
      trades.set(active ? 200 : 0)
      return
    }
    const t = setTimeout(() => {
      balance.set(FINAL_BALANCE)
      trades.set(200)
    }, 500)
    return () => clearTimeout(t)
  }, [active, balance, trades, reduced])

  return (
    <div className="flex flex-col items-center justify-center gap-8 px-6 py-10 md:px-12 md:py-12">

      <div className="flex flex-col items-center gap-3">
        <div className="flex items-baseline gap-3 tabular-nums">
          <motion.span
            style={{
              fontFamily: 'var(--apple-font-display)',
              fontSize: 'clamp(40px, 6vw, 56px)',
              fontWeight: 600,
              letterSpacing: 'var(--apple-track-tight)',
              color: '#ffffff',
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1,
            }}
          >
            $100.00
          </motion.span>
          <motion.span
            initial={{ opacity: 0, x: -8 }}
            animate={active && !reduced ? { opacity: 1, x: 0 } : reduced ? { opacity: 1, x: 0 } : { opacity: 0, x: -8 }}
            transition={{ duration: 0.4, delay: 0.6 }}
            style={{
              fontFamily: 'var(--apple-font-text)',
              fontSize: 'var(--apple-fs-17)',
              color: 'rgba(255,255,255,0.5)',
              letterSpacing: 'var(--apple-track-tight)',
            }}
          >
            →
          </motion.span>
          <motion.span
            style={{
              fontFamily: 'var(--apple-font-display)',
              fontSize: 'clamp(40px, 6vw, 56px)',
              fontWeight: 600,
              letterSpacing: 'var(--apple-track-tight)',
              color: '#ff453a',
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1,
            }}
          >
            {balanceText}
          </motion.span>
        </div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={active && !reduced ? { opacity: 1 } : reduced ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.3, delay: 0.4 }}
          className="flex items-center gap-2 tabular-nums"
        >
          <span
            style={{
              fontFamily: 'var(--apple-font-text)',
              fontSize: '11px',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.55)',
            }}
          >
            after
          </span>
          <motion.span
            style={{
              fontFamily: 'var(--apple-font-text)',
              fontSize: '11px',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: '#ffffff',
              fontWeight: 600,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {tradesText}
          </motion.span>
          <span
            style={{
              fontFamily: 'var(--apple-font-text)',
              fontSize: '11px',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.55)',
            }}
          >
            trades at 1% fee each
          </span>
        </motion.div>
      </div>

      <div className="w-full max-w-[640px] flex flex-col gap-3">
        <div
          className="flex items-center justify-between mb-1"
          style={{
            fontFamily: 'var(--apple-font-text)',
            fontSize: '11px',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.4)',
          }}
        >
          <span>The compounding</span>
          <span>$100 starting capital · 1% fee/trade</span>
        </div>
        {STAGES.map((s, i) => (
          <StageRow key={s.trades} stage={s} index={i} active={active} reduced={!!reduced} />
        ))}
        <div
          className="mt-2 flex items-center justify-between"
          style={{
            padding: '12px 14px',
            borderRadius: 12,
            background: 'rgba(255,69,58,0.08)',
            border: '1px solid rgba(255,69,58,0.22)',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--apple-font-text)',
              fontSize: 'var(--apple-fs-14)',
              color: 'rgba(255,255,255,0.9)',
              letterSpacing: 'var(--apple-track-tight)',
            }}
          >
            Bled to extractors
          </span>
          <span
            style={{
              fontFamily: 'var(--apple-font-display)',
              fontSize: 'var(--apple-fs-21)',
              fontWeight: 600,
              color: '#ff453a',
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: 'var(--apple-track-tight)',
            }}
          >
            ${LOST.toFixed(2)} <span style={{ fontSize: 'var(--apple-fs-12)', fontWeight: 400, color: 'rgba(255,255,255,0.55)' }}>· 86.6%</span>
          </span>
        </div>
      </div>

      <div className="w-full max-w-[640px] flex flex-col gap-2">
        <div
          className="mb-1"
          style={{
            fontFamily: 'var(--apple-font-text)',
            fontSize: '11px',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.4)',
          }}
        >
          Where the 86.6% goes
        </div>
        {CITATIONS.map((c) => (
          <CitationCard key={c.title} compact {...c} />
        ))}
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
          The leak
        </div>
        <h2
          className="mt-3"
          style={{
            fontFamily: 'var(--apple-font-display)',
            fontSize: 'clamp(24px, 3.4vw, 32px)',
            fontWeight: 600,
            letterSpacing: 'var(--apple-track-tight)',
            color: '#ffffff',
            lineHeight: 1.2,
          }}
        >
          1% per trade. 200 trades. 87% gone.
        </h2>
        <p
          className="mt-3"
          style={{
            fontFamily: 'var(--apple-font-text)',
            fontSize: '15px',
            letterSpacing: 'var(--apple-track-tight)',
            color: 'rgba(255,255,255,0.7)',
            lineHeight: 1.5,
          }}
        >
          Fees don&apos;t sting once. They compound.
        </p>
      </div>
    </div>
  )
}

function StageRow({
  stage,
  index,
  active,
  reduced,
}: {
  stage: Stage
  index: number
  active: boolean
  reduced: boolean
}) {
  const delay = 0.8 + index * 0.18
  const isStart = stage.trades === 0
  const isEnd = stage.trades === 200

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={active && !reduced ? { opacity: 1, y: 0 } : reduced ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
      transition={{ duration: 0.4, delay, ease: [0.25, 0.1, 0.3, 1] }}
      className="flex items-center gap-4"
    >
      <div
        className="shrink-0 text-right tabular-nums"
        style={{
          width: 110,
          fontFamily: 'var(--apple-font-text)',
          fontSize: 'var(--apple-fs-12)',
          color: isStart ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.6)',
          letterSpacing: '0.02em',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {isStart ? 'Start' : `After ${stage.trades.toLocaleString()}`}
      </div>

      <div
        className="relative flex-1 overflow-hidden"
        style={{
          height: 22,
          borderRadius: 4,
          background: 'rgba(255,255,255,0.06)',
        }}
      >
        <motion.div
          className="absolute inset-y-0 left-0"
          style={{
            background: isEnd ? '#ff453a' : isStart ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.55)',
          }}
          initial={{ width: '100%' }}
          animate={active && !reduced ? { width: `${stage.pct}%` } : reduced ? { width: `${stage.pct}%` } : { width: '100%' }}
          transition={{ duration: 0.7, delay: delay + 0.1, ease: [0.25, 0.1, 0.3, 1] }}
        />
      </div>

      <div
        className="shrink-0 text-right tabular-nums"
        style={{
          width: 70,
          fontFamily: 'var(--apple-font-text)',
          fontSize: 'var(--apple-fs-14)',
          color: isEnd ? '#ff453a' : '#ffffff',
          fontWeight: isEnd ? 600 : 500,
          letterSpacing: 'var(--apple-track-tight)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        ${stage.balance.toFixed(2)}
      </div>
    </motion.div>
  )
}
