import type { ChartProps } from '../types'

export function HackDrain({ loss = '$1,000', tickerFrom, tickerTo = '$0' }: ChartProps) {
  const from = tickerFrom ?? loss
  return (
    <>
      <svg className="acf-chart-svg" viewBox="0 0 280 110" aria-hidden="true">
        <line className="acf-axis seq" style={{ ['--s' as never]: 0 }} x1="0" y1="92" x2="280" y2="92" />

        {/* Balance bar — your deposit */}
        <rect className="acf-you-rect seq" style={{ ['--s' as never]: 0.4 }} x="6" y="18" width="72" height="20" rx="3" />
        <text className="acf-label seq" style={{ ['--s' as never]: 0.4 }} x="12" y="32">YOUR {loss}</text>

        {/* Flat balance line — months of normal */}
        <path className="acf-line seq-draw" style={{ ['--s' as never]: 1, ['--len' as never]: 180 }}
          d="M 0 28 L 180 28" />
        <text className="acf-label acf-label-soft seq" style={{ ['--s' as never]: 1 }} x="80" y="22">months of normal</text>

        {/* Compromise marker — single point */}
        <circle className="acf-marker seq-pulse" style={{ ['--s' as never]: 3, ['--ox' as never]: '180px', ['--oy' as never]: '28px' }} cx="180" cy="28" r="4" />
        <text className="acf-label acf-label-loss seq" style={{ ['--s' as never]: 3 }} x="120" y="46">UI compromised</text>

        {/* Vertical drop — drain */}
        <path className="acf-cheat seq-draw" style={{ ['--s' as never]: 4, ['--len' as never]: 60 }}
          d="M 180 28 L 180 88" />

        {/* Zero floor */}
        <path className="acf-line seq-draw" style={{ ['--s' as never]: 4.6, ['--len' as never]: 100 }}
          d="M 180 88 L 280 88" />

        {/* Damage readout */}
        <text className="acf-label seq" style={{ ['--s' as never]: 5 }} x="6" y="106">BALANCE</text>
        <text className="acf-label acf-label-soft seq" style={{ ['--s' as never]: 5 }} x="58" y="106">{from}</text>
        <text className="acf-label acf-label-loss seq" style={{ ['--s' as never]: 5.4 }} x="100" y="106">→ {tickerTo}</text>
      </svg>
      <div className="acf-card-chart-label">Drain · flat balance, single moment, zero recovery</div>
    </>
  )
}
