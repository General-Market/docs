'use client'

import { Reveal } from '@/components/ui/Reveal'

const TEXT = 'var(--apple-text)'
const SECONDARY = 'var(--apple-text-secondary)'
const TERTIARY = 'var(--apple-text-tertiary)'
const LINE = 'var(--apple-line)'

interface Objection {
  shot: string
  reply: string
}

const OBJECTIONS: Objection[] = [
  {
    shot: 'Anyone can rent a Tokyo VPS at 3–5 ms. The 145 ms gap is geography, not gating.',
    reply: 'Correct, and we corrected the chart accordingly. The Binance and Bybit rows now show only the gated delta — roughly 20 ms inside AWS Tokyo, not 145 ms across the Pacific. What a rental cannot buy is the MMGW cross-connect, the FIX cage at LD4, the Foundation-node gossip on Hyperliquid, or the bilateral KYC. Those are the milliseconds that remain after you have already paid for proximity.',
  },
  {
    shot: 'Binance is pure FIFO. So is Hyperliquid. Queue-jumping is fiction.',
    reply: 'The book is FIFO, but Binance publishes a feature called Order Amend Keep Priority that lets a maker shrink an order without losing its place in the queue. Deribit ships the same feature. Hyperliquid sequences cancels before takers, which is a different mechanism in the same family. Strict FIFO with privileged edit rights is no longer strict FIFO for the desks that know how to edit.',
  },
  {
    shot: 'Pump.fun has no queue. You cannot jump what does not exist.',
    reply: 'Also correct, and that is exactly the point of putting the mempool inside the matching-engine section. On an AMM the matching engine is the mempool itself; the order in which transactions land is decided by Jito tip auctions, not by an orderbook. The privilege exists at a different layer, but it is still a matching-engine privilege.',
  },
  {
    shot: 'General Market charges 5 bps on the pot. That is also a fee.',
    reply: 'It is. Parimutuel has no per-trade break-even — you either win the round or you do not — so the 5 bps is a flat cut on the pool that scales with the prize, not with leverage or frequency. The number is on the schedule, there is no VIP tier above it, and whether that single fee is worth the absence of the twelve other edges this page documents is the only real question.',
  },
  {
    shot: 'You have not worked at a firm. Your assumptions are wrong on the whole line.',
    reply: 'Authority is not a source. Every number on this page is footnoted to a primary document, and where the document contradicted us, we changed the page — Hyperliquid maker rebate from −3 bps to −0.3 bps, Coinbase\'s unsourced LP rebate removed, Kalshi round-trip math corrected, eToro spread divided by five. Where we lacked a source, the row was removed entirely. The argument has to survive the audit, not the résumé.',
  },
  {
    shot: 'Retail loses regardless. Edge or no edge.',
    reply: 'Often, yes. But the question is whether retail loses to two hundred basis points of structural extraction — PFOF, tiered fees, colocation tax, listing leaks, sandwich attacks — or to their own decisions. This page measures the structural floor. What the trader does on top of that is their choice, and their responsibility.',
  },
]

export function ObjectionsSection() {
  return (
    <section style={{ paddingTop: 96, paddingBottom: 32 }}>
      <div style={{ marginBottom: 36, maxWidth: 760 }}>
        <Reveal mask>
          <h2
            className="font-semibold"
            style={{
              fontFamily: 'var(--apple-font-display)',
              fontSize: 'clamp(28px, 3.4vw, 36px)',
              fontWeight: 600,
              letterSpacing: 'var(--apple-track-tighter)',
              lineHeight: 1.12,
              color: TEXT,
            }}
          >
            Common objections, answered.
          </h2>
        </Reveal>
        <Reveal delay={0.08}>
          <p
            style={{
              fontFamily: 'var(--apple-font-text)',
              fontSize: 17,
              lineHeight: 1.47,
              letterSpacing: 'var(--apple-track-tight)',
              color: SECONDARY,
              marginTop: 14,
            }}
          >
            Every number on this page has been challenged by traders who work at, or have worked at, the venues described. Where they were right, the data above reflects the correction. Where the argument still holds, the response is below.
          </p>
        </Reveal>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {OBJECTIONS.map((o, i) => (
          <Reveal key={i} delay={Math.min(i * 0.04, 0.18)}>
            <article
              style={{
                borderTop: i === 0 ? `1px solid ${LINE}` : 'none',
                borderBottom: `1px solid ${LINE}`,
                padding: '28px 0',
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr)',
                gap: 12,
              }}
            >
              <div
                style={{
                  fontFamily: 'var(--apple-font-text)',
                  fontSize: 11,
                  fontWeight: 600,
                  color: TERTIARY,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                }}
              >
                Objection
              </div>
              <p
                style={{
                  fontFamily: 'var(--apple-font-display)',
                  fontSize: 21,
                  lineHeight: 1.32,
                  letterSpacing: '-0.018em',
                  color: TEXT,
                  fontWeight: 500,
                  fontStyle: 'italic',
                  margin: 0,
                  maxWidth: 760,
                }}
              >
                &ldquo;{o.shot}&rdquo;
              </p>
              <p
                style={{
                  fontFamily: 'var(--apple-font-text)',
                  fontSize: 15,
                  lineHeight: 1.55,
                  letterSpacing: '-0.011em',
                  color: SECONDARY,
                  margin: 0,
                  maxWidth: 760,
                }}
              >
                {o.reply}
              </p>
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  )
}
