'use client'

import { APBalanceCard } from './APBalanceCard'

interface APBalanceSectionProps {
  expanded: boolean
  onToggle: () => void
}

export function APBalanceSection({ expanded, onToggle }: APBalanceSectionProps) {
  return (
    <div className="bg-terminal-dark/50 border border-white/10 rounded-lg">
      <button
        onClick={onToggle}
        className="w-full p-4 flex justify-between items-center text-left"
      >
        <div>
          <h2 className="text-xl font-bold text-white">AP (Keeper) Status</h2>
          <p className="text-sm text-white/50">View AP balances, vault holdings, and health status</p>
        </div>
        <span className="text-accent text-2xl">{expanded ? '−' : '+'}</span>
      </button>

      {expanded && (
        <div className="border-t border-white/10">
          <APBalanceCard />
        </div>
      )}
    </div>
  )
}
