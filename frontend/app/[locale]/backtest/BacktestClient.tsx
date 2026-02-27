'use client'

import dynamic from 'next/dynamic'

const BacktestSection = dynamic(
  () => import('@/components/domain/simulation/BacktestSection').then(mod => ({ default: mod.BacktestSection })),
  { ssr: false },
)

export function BacktestClient() {
  return (
    <BacktestSection
      expanded={true}
      onToggle={() => {}}
    />
  )
}
