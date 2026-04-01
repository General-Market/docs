'use client'

import { Link } from '@/i18n/routing'

/* ── Step data ─────────────────────────────────────────────── */

interface Step {
  number: string
  title: string
  body: string
  tip?: string
}

const STEPS: Step[] = [
  {
    number: '01',
    title: 'Connect your wallet',
    body: 'Click "Connect" in the top-right corner. MetaMask, Rabby, WalletConnect — anything works. This is your identity on-chain. No email, no password, no account to create.',
    tip: 'If you\'ve never used a wallet before: install MetaMask (browser extension), create a wallet, and you\'re done. Takes 60 seconds.',
  },
  {
    number: '02',
    title: 'Get some GM',
    body: 'GM is the currency on our chain. You need a small amount to pay for transactions. Hit the faucet button (top bar) — it gives you free GM for testing. That\'s it.',
  },
  {
    number: '03',
    title: 'Pick a source',
    body: 'A source is a category of real-world data. Twitch streamers, earthquake magnitudes, German train delays, Steam player counts. Each source has many markets inside it.',
    tip: 'Think of a source like a sport, and the markets inside it like individual games.',
  },
  {
    number: '04',
    title: 'Understand what you\'re looking at',
    body: 'Inside a source, you see a list of markets. Each market is one thing being measured right now — for example, "xQc viewers" or "magnitude of next earthquake in Japan." Next to each market is its current value and whether it went up or down recently.',
  },
  {
    number: '05',
    title: 'Make your predictions',
    body: 'For EACH market in the list, you predict: will the value go UP or DOWN in the next round? Click the green arrow for up, the red arrow for down. If you\'re not sure about one, skip it — leave it blank.',
    tip: 'You\'re predicting many things at once. That\'s the point. It\'s not one bet — it\'s a pattern of bets across all markets in the source. More correct predictions = bigger share of the pot.',
  },
  {
    number: '06',
    title: 'Set your deposit',
    body: 'Choose how much to put in. Minimum is $0.10. This money goes into a shared pool with everyone else who entered this round. There is no house. No bookmaker. Just players.',
    tip: 'Start with $0.10. Seriously. This is your first trade. The point is to understand the flow, not to win big.',
  },
  {
    number: '07',
    title: 'Wait for the round to end',
    body: 'Rounds last a few minutes (varies by source). When time runs out, real-world data comes in. The system checks: did the value actually go up or down? For every market, your prediction is graded.',
  },
  {
    number: '08',
    title: 'See your P&L',
    body: 'After the round resolves, you see your result in your portfolio. Here\'s how it works:',
  },
]

/* ── Component ─────────────────────────────────────────────── */

export function FirstTradeGuide() {
  return (
    <div className="px-6 lg:px-12 py-12">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="mb-12">
          <div className="text-label font-semibold tracking-[0.08em] uppercase text-text-muted mb-3">
            Tutorial
          </div>
          <h1 className="text-display font-black text-black mb-4">
            My First Vision Trade
          </h1>
          <p className="text-base text-text-secondary max-w-xl leading-relaxed">
            Everything you need to know, from zero. No crypto experience required.
            Read once, trade forever.
          </p>
        </div>

        {/* Steps */}
        <div className="space-y-0">
          {STEPS.map((step) => (
            <div
              key={step.number}
              className="border-t border-border-light py-8 first:border-t-0 first:pt-0"
            >
              <div className="flex gap-5">
                <div className="shrink-0 w-10 h-10 bg-black text-white flex items-center justify-center text-label font-black font-mono">
                  {step.number}
                </div>

                <div className="flex-1 min-w-0">
                  <h2 className="text-title font-black text-black mb-2">
                    {step.title}
                  </h2>
                  <p className="text-body text-text-primary leading-relaxed">
                    {step.body}
                  </p>
                  {step.tip && (
                    <p className="text-caption text-text-muted mt-2 pl-3 border-l-2 border-border-light">
                      {step.tip}
                    </p>
                  )}

                  {/* P&L explainer — only on step 08 */}
                  {step.number === '08' && <PnlExplainer />}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Quick reference */}
        <div className="mt-10 border border-border-light bg-surface p-6">
          <h3 className="text-body-sm font-black text-black uppercase tracking-[0.06em] mb-4">
            Quick Reference
          </h3>
          <dl className="space-y-3 text-caption">
            <div className="flex gap-3">
              <dt className="shrink-0 font-bold text-black w-24">Source</dt>
              <dd className="text-text-secondary">A category of real-world data (Twitch, earthquakes, trains...)</dd>
            </div>
            <div className="flex gap-3">
              <dt className="shrink-0 font-bold text-black w-24">Market</dt>
              <dd className="text-text-secondary">One thing being measured inside a source (e.g. "xQc viewers")</dd>
            </div>
            <div className="flex gap-3">
              <dt className="shrink-0 font-bold text-black w-24">Bitmap</dt>
              <dd className="text-text-secondary">Your pattern of UP/DOWN predictions across all markets</dd>
            </div>
            <div className="flex gap-3">
              <dt className="shrink-0 font-bold text-black w-24">Round</dt>
              <dd className="text-text-secondary">A timed window where players enter predictions, then data resolves</dd>
            </div>
            <div className="flex gap-3">
              <dt className="shrink-0 font-bold text-black w-24">Pool</dt>
              <dd className="text-text-secondary">Everyone&apos;s deposits combined. Winners split it. No house edge.</dd>
            </div>
            <div className="flex gap-3">
              <dt className="shrink-0 font-bold text-black w-24">P&L</dt>
              <dd className="text-text-secondary">Profit & Loss. What you earned minus what you deposited.</dd>
            </div>
          </dl>
        </div>

        {/* CTA */}
        <div className="mt-10 border-t border-border-light pt-8 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <Link
            href="/"
            className="bg-black text-white text-caption font-bold uppercase tracking-[0.08em] px-6 py-3 hover:bg-zinc-800 transition-colors"
          >
            Browse Sources
          </Link>
          <span className="text-caption text-text-muted">
            Pick a source. The rest follows.
          </span>
        </div>
      </div>
    </div>
  )
}

/* ── P&L explainer sub-component ───────────────────────────── */

function PnlExplainer() {
  return (
    <div className="mt-4 space-y-4">
      {/* How scoring works */}
      <div className="bg-surface border border-border-light p-4">
        <div className="text-body-sm font-bold text-black mb-2">How scoring works</div>
        <ol className="list-decimal list-inside space-y-1.5 text-caption text-text-primary">
          <li>Each market you predicted is graded: <span className="font-mono text-color-up">correct</span> or <span className="font-mono text-color-down">wrong</span>.</li>
          <li>Your <strong>score</strong> = number of correct predictions out of total predictions you made.</li>
          <li>Everyone who entered the round gets a score the same way.</li>
          <li>The total pool (everyone&apos;s deposits) is split proportionally by score.</li>
        </ol>
      </div>

      {/* Worked example */}
      <div className="bg-surface border border-border-light p-4">
        <div className="text-body-sm font-bold text-black mb-2">Example</div>
        <div className="text-caption text-text-primary space-y-1.5">
          <p>You deposit <strong className="font-mono">$1.00</strong>. The round has 5 players and a total pool of <strong className="font-mono">$8.00</strong>.</p>
          <p>You predicted 10 markets. 7 were correct. Your score: <strong className="font-mono text-color-up">70%</strong>.</p>
          <p>The average score in the round was 50%. You beat the average, so you get a bigger share of the pool than what you put in.</p>
          <p>Your payout: <strong className="font-mono text-color-up">$1.40</strong>. Your P&L: <strong className="font-mono text-color-up">+$0.40</strong>.</p>
        </div>
        <p className="text-micro text-text-muted mt-3">
          If you score below average, you get back less than you put in. If everyone scores equally, everyone gets their deposit back (minus a small protocol fee).
        </p>
      </div>

      {/* Key insight */}
      <p className="text-caption text-text-muted pl-3 border-l-2 border-border-light">
        You don&apos;t need to get everything right. You need to get more right than the other players.
        This is a competition, not a casino.
      </p>
    </div>
  )
}
