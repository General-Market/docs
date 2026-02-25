'use client'

import { useCallback } from 'react'
import type { BitmapEditor } from '@/hooks/vision/useBitmapEditor'

interface Strategy {
  id: string
  name: string
  description: string
  badge: string
  apply: (marketIds: string[]) => Record<string, 'up' | 'down'>
}

const STRATEGIES: Strategy[] = [
  {
    id: 'momentum',
    name: 'Momentum Follower',
    description: 'Follow recent price trends',
    badge: 'Premade',
    apply: (marketIds) => {
      const result: Record<string, 'up' | 'down'> = {}
      for (const id of marketIds) {
        let hash = 0
        for (let i = 0; i < id.length; i++) {
          hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0
        }
        result[id] = hash % 2 === 0 ? 'up' : 'down'
      }
      return result
    },
  },
  {
    id: 'contrarian',
    name: 'Contrarian',
    description: 'Bet against the crowd',
    badge: 'Premade',
    apply: (marketIds) => {
      const result: Record<string, 'up' | 'down'> = {}
      for (const id of marketIds) {
        let hash = 0
        for (let i = 0; i < id.length; i++) {
          hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0
        }
        result[id] = hash % 2 === 0 ? 'down' : 'up'
      }
      return result
    },
  },
]

interface StrategyListProps {
  bitmapEditor: BitmapEditor
  sourceId: string
  marketIds: string[]
}

export default function StrategyList({ bitmapEditor, sourceId, marketIds }: StrategyListProps) {
  const handleApply = useCallback(
    (strategy: Strategy) => {
      bitmapEditor.applyStrategy(() => {
        return strategy.apply(marketIds)
      })
    },
    [bitmapEditor, marketIds],
  )

  return (
    <div className="mt-6">
      <h3 className="text-[10px] font-bold tracking-[0.12em] text-[#999] uppercase mb-3">
        Strategies
      </h3>

      <div className="space-y-2">
        {STRATEGIES.map((strategy) => (
          <button
            key={strategy.id}
            type="button"
            onClick={() => handleApply(strategy)}
            disabled={marketIds.length === 0}
            className="w-full flex items-center justify-between rounded-lg border border-border-light bg-[var(--surface)] px-3 py-2.5 hover:border-[#999] disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-left"
          >
            <div className="min-w-0 mr-3">
              <p className="text-[13px] font-semibold text-black truncate">
                {strategy.name}
              </p>
              <p className="text-[11px] text-text-muted truncate">
                {strategy.description}
              </p>
            </div>
            <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.06em] text-text-muted bg-white px-2 py-0.5 rounded">
              {strategy.badge}
            </span>
          </button>
        ))}
      </div>

      {/* AI agent deploy buttons */}
      <h3 className="text-[10px] font-bold tracking-[0.12em] text-[#999] uppercase mb-3 mt-6">
        Deploy with AI Agent
      </h3>
      <div className="space-y-2">
        {/* Claude Code — Anthropic spark */}
        <button
          type="button"
          className="w-full flex items-center gap-2.5 rounded-lg border-2 border-[#18181B] px-3 py-2.5 text-[13px] font-bold text-[#52525b] hover:bg-[#18181B] hover:text-white transition-colors"
        >
          <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="12" fill="#CC785C"/>
            <path d="M14.2 6.5L8.5 17.5h2.6l1.1-2.3h4.3l1.1 2.3H20L14.2 6.5zm-.5 6.7l1.3-2.8 1.3 2.8h-2.6z" fill="#fff"/>
          </svg>
          Deploy with Claude Code
        </button>

        {/* Cursor — angular cursor pointer */}
        <button
          type="button"
          className="w-full flex items-center gap-2.5 rounded-lg border-2 border-[#18181B] px-3 py-2.5 text-[13px] font-bold text-[#52525b] hover:bg-[#18181B] hover:text-white transition-colors"
        >
          <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none">
            <rect width="24" height="24" rx="5" fill="#18181B"/>
            <path d="M7 5v14l4-4h6L7 5z" fill="#fff"/>
          </svg>
          Deploy with Cursor
        </button>

        {/* Windsurf — wave mark */}
        <button
          type="button"
          className="w-full flex items-center gap-2.5 rounded-lg border-2 border-[#18181B] px-3 py-2.5 text-[13px] font-bold text-[#52525b] hover:bg-[#18181B] hover:text-white transition-colors"
        >
          <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none">
            <rect width="24" height="24" rx="5" fill="#00B4D8"/>
            <path d="M4 14c2-3 4-3 6 0s4 3 6 0 4-3 6 0" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
            <path d="M4 10c2-3 4-3 6 0s4 3 6 0 4-3 6 0" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity=".5"/>
          </svg>
          Deploy with Windsurf
        </button>

        {/* Devin — Cognition purple */}
        <button
          type="button"
          className="w-full flex items-center gap-2.5 rounded-lg border-2 border-[#18181B] px-3 py-2.5 text-[13px] font-bold text-[#52525b] hover:bg-[#18181B] hover:text-white transition-colors"
        >
          <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none">
            <rect width="24" height="24" rx="5" fill="#7C3AED"/>
            <circle cx="12" cy="12" r="4" fill="none" stroke="#fff" strokeWidth="2"/>
            <circle cx="12" cy="12" r="1.5" fill="#fff"/>
            <path d="M12 4v3M12 17v3M4 12h3M17 12h3" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          Deploy with Devin
        </button>

        {/* Cline — terminal prompt */}
        <button
          type="button"
          className="w-full flex items-center gap-2.5 rounded-lg border-2 border-[#18181B] px-3 py-2.5 text-[13px] font-bold text-[#52525b] hover:bg-[#18181B] hover:text-white transition-colors"
        >
          <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none">
            <rect width="24" height="24" rx="5" fill="#22C55E"/>
            <path d="M7 8l4 4-4 4" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M13 16h4" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/>
          </svg>
          Deploy with Cline
        </button>
      </div>
    </div>
  )
}
