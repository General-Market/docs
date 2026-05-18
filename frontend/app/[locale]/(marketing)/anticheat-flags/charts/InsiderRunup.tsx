import type { ChartProps } from '../types'

export function InsiderRunup({ loss = '$1,000', extracted = '$50k', recipient = 'insider' }: ChartProps) {
  return (
    <>
      <svg className="acf-chart-svg" viewBox="0 0 280 110" aria-hidden="true">
        <line className="acf-axis seq" style={{ ['--s' as never]: 0 }} x1="0" y1="86" x2="280" y2="86" />

        {/* YOU buying at the announcement (top) */}
        <rect className="acf-you-rect seq" style={{ ['--s' as never]: 3.5 }} x="148" y="22" width="56" height="14" rx="3" />
        <text className="acf-label seq" style={{ ['--s' as never]: 3.5 }} x="152" y="32">YOU BUY {loss}</text>

        {/* Pre-announcement flat */}
        <path className="acf-line seq-draw" style={{ ['--s' as never]: 1, ['--len' as never]: 70 }} d="M 0 64 L 70 64" />

        {/* Insider run-up — sharp climb before announcement */}
        <path className="acf-cheat seq-draw" style={{ ['--s' as never]: 2, ['--len' as never]: 90 }}
          d="M 70 64 Q 100 60 140 30" />
        <text className="acf-label acf-label-loss seq" style={{ ['--s' as never]: 2 }} x="74" y="56">{recipient} buys</text>
        <text className="acf-label seq" style={{ ['--s' as never]: 2.5 }} x="74" y="48">+{extracted}</text>

        {/* Announcement marker (vertical dashed line) */}
        <line className="acf-dash seq" style={{ ['--s' as never]: 3 }} x1="156" y1="6" x2="156" y2="86" />
        <text className="acf-label seq" style={{ ['--s' as never]: 3 }} x="160" y="14">ANNOUNCEMENT</text>

        {/* Post-announcement — flat / minor drift */}
        <path className="acf-line seq-draw" style={{ ['--s' as never]: 4, ['--len' as never]: 130 }}
          d="M 156 30 L 220 38 L 280 46" />

        {/* Ghost — what should have happened (no run-up): you fill at $X, get the full move */}
        <path className="acf-ghost seq-draw" style={{ ['--s' as never]: 5, ['--len' as never]: 280 }}
          d="M 0 64 L 156 64 L 156 30 L 280 30" />
        <text className="acf-label acf-label-fair seq" style={{ ['--s' as never]: 5 }} x="6" y="60">fair: you get the +{extracted}</text>

        {/* Damage readout */}
        <text className="acf-label seq" style={{ ['--s' as never]: 5.5 }} x="6" y="104">EDGE TAKEN</text>
        <text className="acf-label acf-label-loss seq" style={{ ['--s' as never]: 5.5 }} x="78" y="104">→ {recipient}</text>
      </svg>
      <div className="acf-card-chart-label">Insider run-up · the price moved before the headline</div>
    </>
  )
}
