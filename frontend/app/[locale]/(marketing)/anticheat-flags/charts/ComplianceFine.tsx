import type { ChartProps } from '../types'

export function ComplianceFine({
  loss = '$1,000',
  extracted = '$4.3B',
  recipient = 'the regulator',
}: ChartProps) {
  return (
    <>
      <svg className="acf-chart-svg" viewBox="0 0 280 110" aria-hidden="true">
        <line className="acf-axis seq" style={{ ['--s' as never]: 0 }} x1="0" y1="92" x2="280" y2="92" />

        {/* Customer deposits — inflow arrows from top */}
        <text className="acf-label acf-label-soft seq" style={{ ['--s' as never]: 0.5 }} x="6" y="16">CUSTOMER DEPOSITS</text>
        <path className="acf-line seq-draw" style={{ ['--s' as never]: 1, ['--len' as never]: 18 }} d="M 22 22 L 22 38" />
        <path className="acf-line seq-draw" style={{ ['--s' as never]: 1.1, ['--len' as never]: 18 }} d="M 48 22 L 48 38" />
        <path className="acf-line seq-draw" style={{ ['--s' as never]: 1.2, ['--len' as never]: 18 }} d="M 74 22 L 74 38" />
        <path className="acf-line seq-draw" style={{ ['--s' as never]: 1.3, ['--len' as never]: 18 }} d="M 100 22 L 100 38" />

        {/* Venue vault */}
        <rect className="acf-line seq" style={{ ['--s' as never]: 2 }} x="14" y="42" width="100" height="36" rx="4" fill="none" />
        <text className="acf-label seq" style={{ ['--s' as never]: 2 }} x="24" y="56">THE VENUE</text>
        <text className="acf-label acf-label-soft seq" style={{ ['--s' as never]: 2 }} x="24" y="70">"compliance"</text>

        {/* Outflow leaking out — labelled with the recipient (sanctioned/Alameda/etc) */}
        <path className="acf-cheat seq-draw" style={{ ['--s' as never]: 3, ['--len' as never]: 130 }}
          d="M 114 60 C 160 60, 200 60, 244 30" />
        <text className="acf-label acf-label-loss seq" style={{ ['--s' as never]: 3 }} x="160" y="44">→ {recipient}</text>

        {/* Years later — the fine arrives */}
        <line className="acf-dash seq" style={{ ['--s' as never]: 4 }} x1="120" y1="86" x2="280" y2="86" />
        <text className="acf-label acf-label-soft seq" style={{ ['--s' as never]: 4 }} x="124" y="84">years later</text>

        {/* Fine bar */}
        <rect className="acf-marker seq" style={{ ['--s' as never]: 5 }} x="150" y="92" width="120" height="14" />
        <text className="acf-label seq" style={{ ['--s' as never]: 5 }} x="156" y="104" fill="#FFF">FINE {extracted}</text>

        {/* YOUR loss — the customers still wait */}
        <text className="acf-label seq" style={{ ['--s' as never]: 5.5 }} x="6" y="104">YOUR {loss}</text>
        <text className="acf-label acf-label-soft seq" style={{ ['--s' as never]: 5.5 }} x="58" y="104">still on the venue</text>
      </svg>
      <div className="acf-card-chart-label">Regulator fines the venue · customers got the press release</div>
    </>
  )
}
