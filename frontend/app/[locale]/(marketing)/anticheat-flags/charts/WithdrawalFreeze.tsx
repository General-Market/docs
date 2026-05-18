import type { ChartProps } from '../types'

export function WithdrawalFreeze({ loss = '$1,000', pctMove = '−47%', tickerFrom, tickerTo }: ChartProps) {
  const from = tickerFrom ?? loss
  const to = tickerTo ?? (pctMove ? `${loss} · ${pctMove}` : '$530')
  return (
    <>
      <svg className="acf-chart-svg" viewBox="0 0 280 110" aria-hidden="true">
        <line className="acf-axis seq" style={{ ['--s' as never]: 0 }} x1="0" y1="92" x2="280" y2="92" />

        {/* YOU at the top with the position */}
        <rect className="acf-you-rect seq" style={{ ['--s' as never]: 0.4 }} x="6" y="22" width="70" height="14" rx="3" />
        <text className="acf-label seq" style={{ ['--s' as never]: 0.4 }} x="10" y="32">YOU HOLD {loss}</text>

        {/* Price falling */}
        <path className="acf-cheat seq-draw" style={{ ['--s' as never]: 1, ['--len' as never]: 260 }}
          d="M 0 36 L 60 42 L 120 60 L 180 76 L 280 82" />

        {/* Frozen padlock — withdraw disabled */}
        <rect className="acf-line seq" style={{ ['--s' as never]: 2 }} x="118" y="44" width="44" height="22" rx="3" fill="none" />
        <line className="acf-line seq" style={{ ['--s' as never]: 2 }} x1="128" y1="44" x2="128" y2="38" />
        <line className="acf-line seq" style={{ ['--s' as never]: 2 }} x1="152" y1="44" x2="152" y2="38" />
        <path className="acf-line seq" style={{ ['--s' as never]: 2 }} d="M 128 38 A 12 12 0 0 1 152 38" fill="none" />
        <text className="acf-label acf-label-loss seq" style={{ ['--s' as never]: 2.5 }} x="124" y="60">FROZEN</text>

        {/* Ghost — what should have happened (you withdraw at top) */}
        <path className="acf-ghost seq-draw" style={{ ['--s' as never]: 4, ['--len' as never]: 280 }}
          d="M 0 36 L 60 36 L 60 92 L 280 92" />
        <text className="acf-label acf-label-fair seq" style={{ ['--s' as never]: 4 }} x="6" y="50">fair: exit at top</text>

        {/* Damage */}
        <text className="acf-label seq" style={{ ['--s' as never]: 5 }} x="6" y="106">YOUR ACCOUNT</text>
        <text className="acf-label acf-label-soft seq" style={{ ['--s' as never]: 5 }} x="92" y="106">{from}</text>
        <text className="acf-label acf-label-loss seq" style={{ ['--s' as never]: 5.5 }} x="138" y="106">→ {to}</text>
      </svg>
      <div className="acf-card-chart-label">Withdrawal frozen · trapped while the chart fell</div>
    </>
  )
}
