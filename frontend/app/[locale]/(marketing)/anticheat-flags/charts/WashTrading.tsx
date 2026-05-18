import type { ChartProps } from '../types'

export function WashTrading({ loss = '$1,000', extracted = '$190M', recipient = 'the house' }: ChartProps) {
  return (
    <>
      <svg className="acf-chart-svg" viewBox="0 0 280 110" aria-hidden="true">
        <line className="acf-axis seq" style={{ ['--s' as never]: 0 }} x1="0" y1="92" x2="280" y2="92" />

        {/* Two wallets — same operator, two sides */}
        <rect className="acf-line seq" style={{ ['--s' as never]: 0.4 }} x="6" y="20" width="60" height="22" rx="3" fill="none" />
        <text className="acf-label seq" style={{ ['--s' as never]: 0.4 }} x="10" y="34">WALLET A</text>
        <rect className="acf-line seq" style={{ ['--s' as never]: 0.4 }} x="6" y="64" width="60" height="22" rx="3" fill="none" />
        <text className="acf-label seq" style={{ ['--s' as never]: 0.4 }} x="10" y="78">WALLET B</text>
        <text className="acf-label acf-label-soft seq" style={{ ['--s' as never]: 1 }} x="76" y="56">same operator</text>

        {/* Round-trip arrows between A and B */}
        <path className="acf-cheat seq-draw" style={{ ['--s' as never]: 2, ['--len' as never]: 110 }}
          d="M 66 32 C 110 32, 110 74, 66 74" />
        <path className="acf-cheat seq-draw" style={{ ['--s' as never]: 2.4, ['--len' as never]: 110 }}
          d="M 66 74 C 110 74, 110 32, 66 32" />

        {/* Fake volume bars rising on the right */}
        <rect className="acf-marker seq-pulse" style={{ ['--s' as never]: 3, ['--ox' as never]: '160px', ['--oy' as never]: '82px' }} x="156" y="60" width="8" height="32" />
        <rect className="acf-marker seq-pulse" style={{ ['--s' as never]: 3.2, ['--ox' as never]: '174px', ['--oy' as never]: '82px' }} x="170" y="48" width="8" height="44" />
        <rect className="acf-marker seq-pulse" style={{ ['--s' as never]: 3.4, ['--ox' as never]: '188px', ['--oy' as never]: '82px' }} x="184" y="36" width="8" height="56" />
        <rect className="acf-marker seq-pulse" style={{ ['--s' as never]: 3.6, ['--ox' as never]: '202px', ['--oy' as never]: '82px' }} x="198" y="24" width="8" height="68" />
        <text className="acf-label acf-label-soft seq" style={{ ['--s' as never]: 4 }} x="156" y="20">99% of volume</text>

        {/* YOU bid into the inflated volume */}
        <rect className="acf-you-rect seq" style={{ ['--s' as never]: 4.5 }} x="220" y="52" width="56" height="14" rx="3" />
        <text className="acf-label seq" style={{ ['--s' as never]: 4.5 }} x="224" y="62">YOU BID {loss}</text>

        {/* Damage */}
        <text className="acf-label seq" style={{ ['--s' as never]: 5 }} x="6" y="106">EXTRACTED</text>
        <text className="acf-label acf-label-loss seq" style={{ ['--s' as never]: 5.4 }} x="74" y="106">{extracted} → {recipient}</text>
      </svg>
      <div className="acf-card-chart-label">Wash trading · the volume was the venue talking to itself</div>
    </>
  )
}
