'use client'

import { useState } from 'react'
import { APBalanceCard } from './APBalanceCard'
import { FillSpeedChart } from '@/components/domain/FillSpeedChart'
import { InventoryBumpChart } from '@/components/domain/InventoryBumpChart'

type Tab = 'ap' | 'performance'

interface SystemStatusSectionProps {
  expanded: boolean
  onToggle: () => void
}

export function SystemStatusSection({ expanded, onToggle }: SystemStatusSectionProps) {
  const [activeTab, setActiveTab] = useState<Tab>('ap')

  return (
    <div className="bg-terminal-dark/50 border border-white/10 rounded-lg">
      <button
        onClick={onToggle}
        className="w-full p-4 flex justify-between items-center text-left"
      >
        <div>
          <h2 className="text-xl font-bold text-white">System Status</h2>
          <p className="text-sm text-white/50">AP keeper health, balances & performance metrics</p>
        </div>
        <span className="text-accent text-2xl">{expanded ? '−' : '+'}</span>
      </button>

      {expanded && (
        <div className="border-t border-white/10">
          {/* Tabs */}
          <div className="flex gap-2 px-4 pt-4">
            {(['ap', 'performance'] as Tab[]).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 text-sm rounded ${
                  activeTab === tab
                    ? 'bg-accent/20 text-accent border border-accent/50'
                    : 'text-white/50 hover:text-white/80 border border-white/10'
                }`}
              >
                {tab === 'ap' ? 'AP Status' : 'Performance'}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {activeTab === 'ap' && <APBalanceCard />}
          {activeTab === 'performance' && (
            <div className="p-4 space-y-4">
              <FillSpeedChart />
              <InventoryBumpChart />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-terminal border border-white/10 rounded-lg p-4 text-center">
                  <p className="text-xs text-white/50 mb-1">Consensus Threshold</p>
                  <p className="text-2xl font-bold text-white">2/3</p>
                  <p className="text-xs text-white/40">BLS signatures required</p>
                </div>
                <div className="bg-terminal border border-white/10 rounded-lg p-4 text-center">
                  <p className="text-xs text-white/50 mb-1">Active Issuers</p>
                  <p className="text-2xl font-bold text-white">3</p>
                  <p className="text-xs text-white/40">Processing orders</p>
                </div>
                <div className="bg-terminal border border-white/10 rounded-lg p-4 text-center">
                  <p className="text-xs text-white/50 mb-1">Network</p>
                  <p className="text-2xl font-bold text-white">Index L3</p>
                  <p className="text-xs text-white/40">Orbit chain</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
