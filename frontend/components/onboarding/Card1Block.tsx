'use client'

import { motion, useReducedMotion } from 'framer-motion'

type Market = {
  name: string
  category: string
  yes: number
}

const MARKETS: Market[] = [
  { name: 'BTC > $200k by 2027', category: 'Crypto', yes: 64 },
  { name: 'US recession in 2026', category: 'Macro', yes: 38 },
  { name: 'Trump approval > 50%', category: 'Politics', yes: 41 },
  { name: 'Lakers win 2026 finals', category: 'Sports', yes: 18 },
  { name: 'Apple ships AR glasses', category: 'Tech', yes: 72 },
  { name: 'Fed cuts rates in Q1', category: 'Macro', yes: 56 },
  { name: 'ETH > $8k by year-end', category: 'Crypto', yes: 47 },
  { name: 'CPI < 3% next month', category: 'Macro', yes: 61 },
]

export function Card1Block({ active }: { active: boolean }) {
  const reduced = useReducedMotion()

  return (
    <div className="flex flex-col items-center gap-10 px-6 py-12 md:px-12 md:py-14">
      <div className="w-full max-w-[760px]">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center gap-6 md:gap-8">

          <div className="flex flex-col gap-2">
            <div
              className="mb-1"
              style={{
                fontFamily: 'var(--apple-font-text)',
                fontSize: 'var(--apple-fs-12)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.45)',
              }}
            >
              10,000 markets
            </div>
            {MARKETS.map((m, i) => (
              <motion.div
                key={m.name}
                initial={{ opacity: 0, y: 8 }}
                animate={
                  active && !reduced
                    ? { opacity: 1, y: 0 }
                    : reduced
                      ? { opacity: 1, y: 0 }
                      : { opacity: 0, y: 8 }
                }
                transition={{
                  duration: 0.4,
                  delay: 0.15 + i * 0.06,
                  ease: [0.25, 0.1, 0.3, 1],
                }}
                className="flex items-center gap-3"
                style={{
                  padding: '10px 12px',
                  borderRadius: 10,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--apple-font-text)',
                    fontSize: '10px',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: 'rgba(255,255,255,0.45)',
                    width: 56,
                    flexShrink: 0,
                  }}
                >
                  {m.category}
                </span>
                <span
                  className="flex-1 truncate"
                  style={{
                    fontFamily: 'var(--apple-font-text)',
                    fontSize: 'var(--apple-fs-12)',
                    letterSpacing: 'var(--apple-track-tight)',
                    color: 'rgba(255,255,255,0.85)',
                  }}
                >
                  {m.name}
                </span>
                <span
                  className="tabular-nums"
                  style={{
                    fontFamily: 'var(--apple-font-text)',
                    fontSize: 'var(--apple-fs-12)',
                    color: 'rgba(255,255,255,0.55)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {m.yes}¢
                </span>
              </motion.div>
            ))}
            <div
              className="mt-1 text-center"
              style={{
                fontFamily: 'var(--apple-font-text)',
                fontSize: 'var(--apple-fs-12)',
                color: 'rgba(255,255,255,0.4)',
                fontStyle: 'italic',
              }}
            >
              · · · 9,992 more
            </div>
          </div>

          <motion.div
            className="flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={active && !reduced ? { opacity: 1 } : reduced ? { opacity: 1 } : { opacity: 0 }}
            transition={{ duration: 0.4, delay: 0.95 }}
          >
            <svg
              width="64"
              height="44"
              viewBox="0 0 64 44"
              fill="none"
              aria-hidden
              className="hidden md:block"
            >
              <motion.path
                d="M4 22 L52 22"
                stroke="rgba(255,255,255,0.55)"
                strokeWidth="1.5"
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={active && !reduced ? { pathLength: 1 } : { pathLength: 1 }}
                transition={{ duration: 0.6, delay: 1.0, ease: [0.4, 0, 0.2, 1] }}
              />
              <motion.path
                d="M46 14 L56 22 L46 30"
                stroke="rgba(255,255,255,0.55)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                initial={{ opacity: 0 }}
                animate={active && !reduced ? { opacity: 1 } : { opacity: 1 }}
                transition={{ duration: 0.3, delay: 1.4 }}
              />
            </svg>
            <svg
              width="44"
              height="64"
              viewBox="0 0 44 64"
              fill="none"
              aria-hidden
              className="md:hidden"
            >
              <motion.path
                d="M22 4 L22 52"
                stroke="rgba(255,255,255,0.55)"
                strokeWidth="1.5"
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={active && !reduced ? { pathLength: 1 } : { pathLength: 1 }}
                transition={{ duration: 0.6, delay: 1.0, ease: [0.4, 0, 0.2, 1] }}
              />
              <motion.path
                d="M14 46 L22 56 L30 46"
                stroke="rgba(255,255,255,0.55)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                initial={{ opacity: 0 }}
                animate={active && !reduced ? { opacity: 1 } : { opacity: 1 }}
                transition={{ duration: 0.3, delay: 1.4 }}
              />
            </svg>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 8 }}
            animate={
              active && !reduced
                ? { opacity: 1, scale: 1, y: 0 }
                : reduced
                  ? { opacity: 1, scale: 1, y: 0 }
                  : { opacity: 0, scale: 0.92, y: 8 }
            }
            transition={{ duration: 0.5, delay: 1.5, ease: [0.25, 0.1, 0.3, 1] }}
            className="relative w-full"
            style={{
              padding: '20px 22px',
              borderRadius: 16,
              background: 'linear-gradient(180deg, rgba(41,151,255,0.18) 0%, rgba(41,151,255,0.06) 100%)',
              border: '1px solid rgba(41,151,255,0.35)',
              boxShadow: '0 12px 32px rgba(41,151,255,0.18)',
            }}
          >
            <div
              style={{
                fontFamily: 'var(--apple-font-text)',
                fontSize: '10px',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.6)',
              }}
            >
              Index
            </div>
            <div
              className="mt-1"
              style={{
                fontFamily: 'var(--apple-font-display)',
                fontSize: '24px',
                fontWeight: 600,
                letterSpacing: 'var(--apple-track-tight)',
                color: '#ffffff',
                lineHeight: 1.1,
              }}
            >
              General Index
            </div>
            <div
              className="mt-2 flex items-baseline gap-2"
              style={{ fontFamily: 'var(--apple-font-text)' }}
            >
              <span
                style={{
                  fontSize: '28px',
                  fontWeight: 600,
                  letterSpacing: 'var(--apple-track-tight)',
                  color: '#ffffff',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                $1.00
              </span>
              <span
                style={{
                  fontSize: 'var(--apple-fs-12)',
                  color: 'rgba(255,255,255,0.55)',
                  letterSpacing: 'var(--apple-track-tight)',
                }}
              >
                / share
              </span>
            </div>
            <div
              className="mt-3 pt-3"
              style={{
                borderTop: '1px solid rgba(255,255,255,0.1)',
                fontFamily: 'var(--apple-font-text)',
                fontSize: 'var(--apple-fs-12)',
                color: 'rgba(255,255,255,0.65)',
                lineHeight: 1.5,
              }}
            >
              10,000 markets · equal weight
              <br />
              one click, one position
            </div>
            <motion.button
              initial={{ opacity: 0 }}
              animate={active && !reduced ? { opacity: 1 } : reduced ? { opacity: 1 } : { opacity: 0 }}
              transition={{ duration: 0.3, delay: 2.0 }}
              type="button"
              className="mt-4 w-full"
              style={{
                fontFamily: 'var(--apple-font-text)',
                fontSize: 'var(--apple-fs-14)',
                fontWeight: 500,
                letterSpacing: 'var(--apple-track-tight)',
                color: '#ffffff',
                background: '#2997ff',
                border: 'none',
                padding: '10px 16px',
                borderRadius: 999,
                cursor: 'default',
              }}
            >
              Buy
            </motion.button>
          </motion.div>
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
          One click. Ten thousand markets.
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
          Stop picking horses. Buy the racetrack.
        </p>
      </div>
    </div>
  )
}
