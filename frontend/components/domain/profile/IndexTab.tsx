'use client'

import { useState } from 'react'
import { PortfolioSection } from '@/components/domain/PortfolioSection'

interface IndexTabProps {
  address: string
}

export function IndexTab({ address: _address }: IndexTabProps) {
  const [expanded] = useState(true)

  return (
    <div className="space-y-6">
      {/* ITP portfolio only. Vaults have their own top-level tab in
          ProfileTabs — we don't duplicate them inside the Index tab. */}
      <PortfolioSection expanded={expanded} onToggle={() => {}} hideVaults />
    </div>
  )
}
