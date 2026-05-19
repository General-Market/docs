'use client'

import { Reveal } from '@/components/ui/Reveal'

const TEXT = 'var(--apple-text)'
const SECONDARY = 'var(--apple-text-secondary)'
const TERTIARY = 'var(--apple-text-tertiary)'
const LINE = 'var(--apple-line)'
const ACCENT = 'var(--apple-accent)'

interface Objection {
  shot: string
  reply: string
  knife: string
}

const OBJECTIONS: Objection[] = [
  {
    shot: 'Anyone can rent a Tokyo VPS at 3–5 ms. The 145 ms gap is geography, not gating.',
    reply: 'Conceded. The public API is buyable. The gated lane is the MMGW cross-connect inside AWS Tokyo, the FIX cage at LD4, the Foundation-node access on Hyperliquid. We corrected the Binance and Bybit rows to show only the gated delta — twenty milliseconds, not one hundred and forty-five.',
    knife: 'Geography is rented. The contract is signed.',
  },
  {
    shot: 'Binance is pure FIFO. So is Hyperliquid. Queue-jumping is fiction.',
    reply: 'The book is FIFO. The amend is not. Binance publishes "Order Amend Keep Priority" — shrink your order without losing its place. The queue exists; one tier can edit without leaving it. Deribit ships the same feature. Hyperliquid sequences cancels before takers, which is a different mechanism in the same family.',
    knife: 'FIFO with privileged edit rights is not FIFO. It is FIFO for the people who do not know they can edit.',
  },
  {
    shot: 'Pump.fun has no queue. You cannot jump what does not exist.',
    reply: 'Also conceded. Pump.fun is a bonding-curve AMM. The mechanism there is Jito bundle inclusion ordering inside a Solana slot — MEV, not matching priority. The row has moved categories.',
    knife: 'The argument was right. The label was wrong.',
  },
  {
    shot: 'General Market charges 5 bps on the pot. That is also a fee.',
    reply: 'It is. Parimutuel has no per-trade break-even — you win the round or you do not. The 5 bps is a flat cut on the pool. It scales with the prize, not with leverage, not with frequency. The number is on the schedule. There is no VIP 9.',
    knife: 'One fee. One tier. Whether that is worth the absence of the other twelve edges is the only question that matters.',
  },
  {
    shot: 'You have not worked at a firm. Your assumptions are wrong on the whole line.',
    reply: 'Authority is not a source. Every number on this page is footnoted to a primary document. Where the document was wrong, we corrected it — Hyperliquid maker rebate from −3 bps to −0.3 bps, Coinbase\'s phantom LP rebate deleted, Kalshi round-trip math doubled, eToro spread divided by five. Where we lacked a source, the row was removed.',
    knife: 'A page survives an audit. A résumé does not.',
  },
  {
    shot: 'Retail loses regardless. Edge or no edge.',
    reply: 'Possibly. The question is whether they lose to two hundred basis points of structural extraction — PFOF, tiered fees, colocation tax, listing leaks, sandwich — or to their own decisions. We measure the structural floor. The decisions remain theirs.',
    knife: 'A losing trader on a fair venue learned something. On a rigged one, they only learned the venue.',
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
            Objections, preshot.
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
            Every number on this page has been challenged. Some challenges were right. The corrections live in the data above. The arguments that survived live below.
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
                Shot
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
                  lineHeight: 1.5,
                  letterSpacing: '-0.011em',
                  color: SECONDARY,
                  margin: 0,
                  maxWidth: 760,
                }}
              >
                {o.reply}
              </p>
              <p
                style={{
                  fontFamily: 'var(--apple-font-text)',
                  fontSize: 14,
                  lineHeight: 1.45,
                  letterSpacing: '-0.005em',
                  color: ACCENT,
                  margin: 0,
                  marginTop: 4,
                  fontWeight: 500,
                  maxWidth: 760,
                }}
              >
                {o.knife}
              </p>
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  )
}
