'use client'

import { useState } from 'react'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { ItpListing } from '@/components/domain/ItpListing'
import { CreateItpSection } from '@/components/domain/CreateItpSection'
import { PortfolioSection } from '@/components/domain/PortfolioSection'
import { SystemStatusSection } from '@/components/domain/SystemStatusSection'
import { VaultModal } from '@/components/domain/VaultModal'

type Section = 'create' | 'system' | 'portfolio' | null

export default function Home() {
  const [expandedSection, setExpandedSection] = useState<Section>(null)
  const [showVault, setShowVault] = useState(false)

  const toggle = (section: Section) => {
    setExpandedSection(prev => prev === section ? null : section)
  }

  return (
    <main className="min-h-screen bg-terminal flex flex-col">
      <Header />

      <div className="flex-1">
        <div className="max-w-4xl mx-auto p-6">
          {/* Hero */}
          <div className="mb-8 text-center">
            <h2 className="text-4xl font-bold text-accent mb-2">Index</h2>
            <p className="text-lg text-white/70">The First AGI Capital Market</p>
          </div>

          {/* ITP Listing Section */}
          <div className="mb-6">
            <ItpListing onCreateClick={() => toggle('create')} onLendingClick={() => setShowVault(true)} />
          </div>

          {/* Portfolio Section (includes Orders tab) */}
          <div className="mb-6">
            <PortfolioSection
              expanded={expandedSection === 'portfolio'}
              onToggle={() => toggle('portfolio')}
            />
          </div>

          {/* Create ITP Section */}
          <div className="mb-6">
            <CreateItpSection
              expanded={expandedSection === 'create'}
              onToggle={() => toggle('create')}
            />
          </div>

          {/* System Status (AP Status + Performance merged) */}
          <div className="mb-6">
            <SystemStatusSection
              expanded={expandedSection === 'system'}
              onToggle={() => toggle('system')}
            />
          </div>
        </div>
      </div>

      {/* Lending Modal */}
      {showVault && <VaultModal onClose={() => setShowVault(false)} />}

      <Footer />
    </main>
  )
}
