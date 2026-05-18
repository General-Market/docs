'use client'

import { motion, useMotionValue, useSpring, useTransform, useReducedMotion } from 'framer-motion'
import { useEffect } from 'react'
import { CitationCard, type CitationKind } from './CitationCard'

type Row = {
  label: string
  extracted: number
  trader: number
  citation: {
    kind: CitationKind
    title: string
    meta: string
    href?: string
  }
  highlight?: boolean
}

const ROWS: Row[] = [
  {
    label: 'Options',
    extracted: 88,
    trader: 12,
    citation: {
      kind: 'paper',
      title: 'Retail Trading in Options and the Rise of the Big Three',
      meta: 'Bryzgalova, Pavlova, Sikorskaya · Journal of Finance, 2023 · $4.13B retail cost — 88% to Citadel, Susquehanna, Optiver, IMC',
      href: 'https://doi.org/10.1111/jofi.13285',
    },
  },
  {
    label: 'Perps',
    extracted: 70,
    trader: 30,
    citation: {
      kind: 'data',
      title: 'Hyperliquid trader PnL distribution',
      meta: 'Public on-chain data · ~80% of leveraged accounts close at loss · funding + spread + liquidation engine',
      href: 'https://stats.hyperliquid.xyz/',
    },
  },
  {
    label: 'Memecoins',
    extracted: 80,
    trader: 20,
    citation: {
      kind: 'data',
      title: 'Pump.fun fees + Solana DEX slippage',
      meta: 'DefiLlama, May 2026 · 1% platform fee + ~4% LP slippage on every trade',
      href: 'https://defillama.com/protocol/pumpfun',
    },
  },
  {
    label: 'General Market',
    extracted: 3,
    trader: 97,
    citation: {
      kind: 'concept',
      title: 'Parimutuel block · trader pays trader',
      meta: '3% pool fee · no spread, no MM, no MEV · liquidity emerges from opposing bets',
      href: 'https://en.wikipedia.org/wiki/Parimutuel_betting',
    },
    highlight: true,
  },
]

const INVISIBLE_FINAL = 36.78
const INVISIBLE_LOST = 100 - INVISIBLE_FINAL

const INVISIBLE_CITATIONS: { kind: CitationKind; title: string; meta: string; href?: string }[] = [
  {
    kind: 'data',
    title: 'MEV · sandwich attacks on every swap',
    meta: 'Flashbots research · $1.5B+ extracted from Ethereum traders since 2020 · the bot you never see, taking a slice of every fill',
    href: 'https://writings.flashbots.net/',
  },
  {
    kind: 'paper',
    title: 'Insider trading widens the spread you pay',
    meta: 'Glosten–Milgrom model · informed traders force market makers to quote wider for everyone · you pay for the leaks you didn\'t cause',
    href: 'https://en.wikipedia.org/wiki/Bid%E2%80%93ask_spread',
  },
  {
    kind: 'article',
    title: 'Front-running retail flow',
    meta: 'HFT firms see your order routing milliseconds before the venue does · classic adverse selection · documented across equities, options, and perps',
    href: 'https://en.wikipedia.org/wiki/Front_running',
  },
]

export function Card2Leak({ active }: { active: boolean }) {
  const reduced = useReducedMotion()

  const invisibleBalance = useMotionValue(100)
  const smoothInvisible = useSpring(invisibleBalance, { stiffness: 50, damping: 24, mass: 1 })
  const invisibleText = useTransform(smoothInvisible, (v) => `$${v.toFixed(2)}`)

  useEffect(() => {
    if (!active || reduced) {
      invisibleBalance.set(active ? INVISIBLE_FINAL : 100)
      return
    }
    const t = setTimeout(() => invisibleBalance.set(INVISIBLE_FINAL), 1100)
    return () => clearTimeout(t)
  }, [active, invisibleBalance, reduced])

  return (
    <div className="flex flex-col items-center justify-center gap-8 px-6 py-10 md:px-12 md:py-12">

      <div className="w-full max-w-[680px]">
        <div
          className="flex items-center justify-between mb-5 flex-wrap gap-3"
          style={{
            fontFamily: 'var(--apple-font-text)',
            fontSize: '11px',
            color: 'rgba(255,255,255,0.55)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}
        >
          <span>Where every $100 you trade actually goes</span>
          <div className="flex items-center gap-4">
            <Legend color="rgba(255,255,255,0.85)" label="Extractors" />
            <Legend color="#2997ff" label="You" />
          </div>
        </div>

        <div className="flex flex-col gap-5">
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
      </div>

      <div className="w-full max-w-[680px] flex items-center gap-3" aria-hidden>
        <span className="flex-1" style={{ height: 1, background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.12), transparent)' }} />
        <span
          style={{
            fontFamily: 'var(--apple-font-text)',
            fontSize: '11px',
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.55)',
            fontWeight: 600,
          }}
        >
          And then the invisible tax
        </span>
        <span className="flex-1" style={{ height: 1, background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.12), transparent)' }} />
      </div>

      <div className="w-full max-w-[680px] flex flex-col gap-5">
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-baseline gap-3 tabular-nums">
            <span
              style={{
                fontFamily: 'var(--apple-font-display)',
                fontSize: 'clamp(34px, 5vw, 48px)',
                fontWeight: 600,
                letterSpacing: 'var(--apple-track-tight)',
                color: '#ffffff',
                fontVariantNumeric: 'tabular-nums',
                lineHeight: 1,
              }}
            >
              $100.00
            </span>
            <span
              style={{
                fontFamily: 'var(--apple-font-text)',
                fontSize: 'var(--apple-fs-17)',
                color: 'rgba(255,255,255,0.5)',
                letterSpacing: 'var(--apple-track-tight)',
              }}
            >
              →
            </span>
            <motion.span
              style={{
                fontFamily: 'var(--apple-font-display)',
                fontSize: 'clamp(34px, 5vw, 48px)',
                fontWeight: 600,
                letterSpacing: 'var(--apple-track-tight)',
                color: '#ff453a',
                fontVariantNumeric: 'tabular-nums',
                lineHeight: 1,
              }}
            >
              {invisibleText}
            </motion.span>
          </div>
          <div
            className="flex items-center gap-2 tabular-nums"
            style={{
              fontFamily: 'var(--apple-font-text)',
              fontSize: '11px',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.55)',
            }}
          >
            <span>after</span>
            <span style={{ color: '#ffffff', fontWeight: 600 }}>200 trades</span>
            <span>·</span>
            <span>~0.5% silently extracted each</span>
          </div>
        </div>

        <DecayBar active={active} reduced={!!reduced} />

        <div
          className="flex items-center justify-between"
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
            Silently bled — no invoice, no receipt
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
            ${INVISIBLE_LOST.toFixed(2)} <span style={{ fontSize: 'var(--apple-fs-12)', fontWeight: 400, color: 'rgba(255,255,255,0.55)' }}>· 63%</span>
          </span>
        </div>

        <div className="flex flex-col gap-2 mt-1">
          {INVISIBLE_CITATIONS.map((c) => (
            <CitationCard key={c.title} compact {...c} />
          ))}
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
          The leak
        </div>
        <h2
          className="mt-3"
          style={{
            fontFamily: 'var(--apple-font-display)',
            fontSize: 'clamp(22px, 3.2vw, 32px)',
            fontWeight: 600,
            letterSpacing: 'var(--apple-track-tight)',
            color: '#ffffff',
            lineHeight: 1.2,
          }}
        >
          The fees you see are the smallest part.
        </h2>
        <p
          className="mt-3"
          style={{
            fontFamily: 'var(--apple-font-text)',
            fontSize: '15px',
            letterSpacing: 'var(--apple-track-tight)',
            color: 'rgba(255,255,255,0.65)',
            lineHeight: 1.5,
          }}
        >
          Every trade pays the visible extractors above
          <br className="hidden md:block" />
          and the invisible ones who never appear on a statement.
        </p>
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
  const delay = 0.12 + index * 0.16
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-4">
        <div
          className="shrink-0 text-right"
          style={{
            width: 130,
            fontFamily: 'var(--apple-font-text)',
            fontSize: 'var(--apple-fs-14)',
            letterSpacing: 'var(--apple-track-tight)',
            color: row.highlight ? '#ffffff' : 'rgba(255,255,255,0.78)',
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
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.05)',
          }}
        >
          <motion.div
            className="absolute inset-y-0 left-0"
            style={{
              background: row.highlight ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.88)',
            }}
            initial={{ width: 0 }}
            animate={active && !reduced ? { width: `${row.extracted}%` } : { width: reduced ? `${row.extracted}%` : 0 }}
            transition={{ duration: 0.9, delay, ease: [0.25, 0.1, 0.3, 1] }}
          />
          <motion.div
            className="absolute inset-y-0"
            style={{
              background: '#2997ff',
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
              color: row.highlight ? 'rgba(255,255,255,0.85)' : '#1d1d1f',
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
              color: '#ffffff',
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

      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={
          active && !reduced
            ? { opacity: 1, y: 0 }
            : reduced
              ? { opacity: 1, y: 0 }
              : { opacity: 0, y: 4 }
        }
        transition={{ duration: 0.35, delay: delay + 0.9 }}
        className="flex"
      >
        <div style={{ width: 130, flexShrink: 0 }} className="hidden md:block" />
        <div className="md:ml-4 flex-1 min-w-0">
          <CitationCard
            compact
            kind={row.citation.kind}
            title={row.citation.title}
            meta={row.citation.meta}
            href={row.citation.href}
            highlight={row.highlight}
          />
        </div>
      </motion.div>
    </div>
  )
}

function DecayBar({ active, reduced }: { active: boolean; reduced: boolean }) {
  const milestones = [
    { trades: 50, pct: 78.0 },
    { trades: 100, pct: 60.6 },
    { trades: 150, pct: 47.2 },
    { trades: 200, pct: 36.8 },
  ]
  return (
    <div className="relative w-full" style={{ height: 36 }}>
      <div
        className="absolute inset-y-0 left-0 right-0"
        style={{
          height: 10,
          top: 6,
          borderRadius: 4,
          background: 'rgba(255,255,255,0.06)',
        }}
      />
      <motion.div
        className="absolute left-0"
        style={{
          height: 10,
          top: 6,
          borderRadius: 4,
          background: 'linear-gradient(to right, rgba(255,255,255,0.85), #ff453a)',
        }}
        initial={{ width: '100%' }}
        animate={active && !reduced ? { width: `${INVISIBLE_FINAL}%` } : reduced ? { width: `${INVISIBLE_FINAL}%` } : { width: '100%' }}
        transition={{ duration: 1.4, delay: 1.1, ease: [0.25, 0.1, 0.3, 1] }}
      />
      {milestones.map((m, i) => (
        <motion.div
          key={m.trades}
          className="absolute"
          style={{
            left: `${m.pct}%`,
            top: 0,
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            transform: 'translateX(-50%)',
          }}
          initial={{ opacity: 0 }}
          animate={active && !reduced ? { opacity: 1 } : reduced ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.3, delay: 1.4 + i * 0.18 }}
        >
          <span
            style={{
              width: 2,
              height: 22,
              background: 'rgba(255,255,255,0.35)',
              borderRadius: 999,
              marginTop: 0,
            }}
          />
          <span
            style={{
              fontFamily: 'var(--apple-font-text)',
              fontSize: '10px',
              color: 'rgba(255,255,255,0.5)',
              letterSpacing: '0.04em',
              marginTop: 2,
              fontVariantNumeric: 'tabular-nums',
              whiteSpace: 'nowrap',
            }}
          >
            {m.trades}
          </span>
        </motion.div>
      ))}
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
