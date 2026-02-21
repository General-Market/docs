'use client'

import { APBalanceCard } from './APBalanceCard'

interface APBalanceSectionProps {
  expanded: boolean
  onToggle: () => void
}

export function APBalanceSection({ expanded, onToggle }: APBalanceSectionProps) {
  return (
    <div>
      {!expanded && (
        <button
          onClick={onToggle}
          className="w-full bg-card rounded-xl shadow-card border border-border-light p-4 flex justify-between items-center text-left hover:shadow-card-hover transition-shadow"
        >
          <div>
            <h2 className="text-lg font-semibold text-text-primary">AP (Keeper) Status</h2>
            <p className="text-sm text-text-secondary">View AP balances, vault holdings, and health status</p>
          </div>
          <span className="text-text-muted text-2xl">+</span>
        </button>
      )}

      {expanded && (
        <div>
          <APBalanceCard />
        </div>
      )}
    </div>
  )
}
