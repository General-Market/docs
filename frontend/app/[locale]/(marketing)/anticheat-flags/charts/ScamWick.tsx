import type { ChartProps } from '../types'

export function ScamWick({ loss = '$1,000', tickerFrom = '+$80', tickerTo = '−$420' }: ChartProps) {
  return (
    <>
      <svg className="acf-chart-svg" viewBox="0 0 280 110" aria-hidden="true">
        {/* axis */}
        <line className="acf-axis seq" style={{ ['--s' as never]: 0 }} x1="0" y1="84" x2="280" y2="84" />
        {/* stops dashed line */}
        <line className="acf-dash seq" style={{ ['--s' as never]: 1 }} x1="0" y1="72" x2="280" y2="72" />
        <text className="acf-label acf-label-soft seq" style={{ ['--s' as never]: 1 }} x="232" y="68">your stop</text>

        {/* YOUR POSITION rect — entry */}
        <rect className="acf-you-rect seq" style={{ ['--s' as never]: 0.4 }} x="6" y="34" width="46" height="14" rx="3" />
        <text className="acf-label seq" style={{ ['--s' as never]: 0.4 }} x="10" y="44">LONG {loss}</text>

        {/* Ghost line — what should have happened (no wick) */}
        <path className="acf-ghost seq-draw" style={{ ['--s' as never]: 2, ['--len' as never]: 280 }}
          d="M 0 40 L 70 38 L 130 36 L 200 34 L 280 32" />
        <text className="acf-label acf-label-fair seq" style={{ ['--s' as never]: 2 }} x="232" y="28">fair: +$80</text>

        {/* Actual price line with the wick */}
        <path className="acf-line seq-draw" style={{ ['--s' as never]: 3, ['--len' as never]: 400 }}
          d="M 0 40 L 90 38 L 120 40 L 134 98 L 148 40 L 200 36 L 280 32" />

        {/* Cheat wick segment highlighted */}
        <path className="acf-cheat seq-draw" style={{ ['--s' as never]: 4, ['--len' as never]: 120 }}
          d="M 120 40 L 134 98 L 148 40" />

        {/* Liquidation blood dots at the wick bottom */}
        <circle className="acf-marker seq-pulse" style={{ ['--s' as never]: 4.5, ['--ox' as never]: '134px', ['--oy' as never]: '98px' }} cx="134" cy="98" r="3" />
        <circle className="acf-marker seq-pulse" style={{ ['--s' as never]: 4.7, ['--ox' as never]: '128px', ['--oy' as never]: '90px' }} cx="128" cy="90" r="2" />
        <circle className="acf-marker seq-pulse" style={{ ['--s' as never]: 4.7, ['--ox' as never]: '140px', ['--oy' as never]: '90px' }} cx="140" cy="90" r="2" />

        {/* Damage readout — ticker */}
        <text className="acf-label seq" style={{ ['--s' as never]: 4.8 }} x="6" y="106">YOUR P&amp;L</text>
        <text className="acf-label acf-label-soft seq" style={{ ['--s' as never]: 4.8 }} x="50" y="106">{tickerFrom}</text>
        <text className="acf-label acf-label-loss seq" style={{ ['--s' as never]: 5.4 }} x="84" y="106">→ {tickerTo}</text>
      </svg>
      <div className="acf-card-chart-label">Scam wick · stops cleared, recovery in three seconds</div>
    </>
  )
}
