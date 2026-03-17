'use client'

import { useState, useCallback } from 'react'
import type { BitmapEditor } from '@/hooks/vision/useBitmapEditor'
import DeployAgentModal from './DeployAgentModal'

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
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)

  const handleApply = useCallback(
    (strategy: Strategy) => {
      bitmapEditor.applyStrategy(() => {
        return strategy.apply(marketIds)
      })
    },
    [bitmapEditor, marketIds],
  )

  return (
    <div className="mt-4 space-y-3">
      {/* Strategies — compact row */}
      <div>
        <h3 className="text-[9px] font-bold tracking-[0.12em] text-[#999] uppercase mb-1.5">
          Strategies
        </h3>
        <div className="flex gap-1.5">
          {STRATEGIES.map((strategy) => (
            <button
              key={strategy.id}
              type="button"
              onClick={() => handleApply(strategy)}
              disabled={marketIds.length === 0}
              className="flex-1 rounded-md border border-border-light bg-[var(--surface)] px-2 py-1.5 hover:border-[#999] disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-left"
            >
              <p className="text-[11px] font-semibold text-black truncate">{strategy.name}</p>
              <p className="text-[9px] text-text-muted truncate">{strategy.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* AI agent deploy buttons — compact grid */}
      <div>
        <h3 className="text-[9px] font-bold tracking-[0.12em] text-[#999] uppercase mb-1.5">
          Deploy with AI Agent
        </h3>
        <div className="grid grid-cols-2 gap-1.5">
          {/* Claude Code */}
          <button type="button" onClick={() => setSelectedAgent('claude-code')} className="flex items-center gap-2 rounded-md border border-[#18181B] px-2 py-1.5 text-[11px] font-bold text-[#52525b] hover:bg-[#18181B] hover:text-white transition-colors">
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="12" fill="#CC785C"/>
              <path d="M14.2 6.5L8.5 17.5h2.6l1.1-2.3h4.3l1.1 2.3H20L14.2 6.5zm-.5 6.7l1.3-2.8 1.3 2.8h-2.6z" fill="#fff"/>
            </svg>
            Claude Code
          </button>
          {/* Cursor */}
          <button type="button" onClick={() => setSelectedAgent('cursor')} className="flex items-center gap-2 rounded-md border border-[#18181B] px-2 py-1.5 text-[11px] font-bold text-[#52525b] hover:bg-[#18181B] hover:text-white transition-colors">
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none">
              <rect width="24" height="24" rx="5" fill="#18181B"/>
              <path d="M7 5v14l4-4h6L7 5z" fill="#fff"/>
            </svg>
            Cursor
          </button>
          {/* Windsurf */}
          <button type="button" onClick={() => setSelectedAgent('windsurf')} className="flex items-center gap-2 rounded-md border border-[#18181B] px-2 py-1.5 text-[11px] font-bold text-[#52525b] hover:bg-[#18181B] hover:text-white transition-colors">
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none">
              <rect width="24" height="24" rx="5" fill="#00B4D8"/>
              <path d="M4 14c2-3 4-3 6 0s4 3 6 0 4-3 6 0" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
              <path d="M4 10c2-3 4-3 6 0s4 3 6 0 4-3 6 0" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity=".5"/>
            </svg>
            Windsurf
          </button>
          {/* Devin */}
          <button type="button" onClick={() => setSelectedAgent('devin')} className="flex items-center gap-2 rounded-md border border-[#18181B] px-2 py-1.5 text-[11px] font-bold text-[#52525b] hover:bg-[#18181B] hover:text-white transition-colors">
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none">
              <rect width="24" height="24" rx="5" fill="#7C3AED"/>
              <circle cx="12" cy="12" r="4" fill="none" stroke="#fff" strokeWidth="2"/>
              <circle cx="12" cy="12" r="1.5" fill="#fff"/>
              <path d="M12 4v3M12 17v3M4 12h3M17 12h3" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Devin
          </button>
          {/* Cline — spans full width */}
          <button type="button" onClick={() => setSelectedAgent('cline')} className="col-span-2 flex items-center gap-2 rounded-md border border-[#18181B] px-2 py-1.5 text-[11px] font-bold text-[#52525b] hover:bg-[#18181B] hover:text-white transition-colors">
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none">
              <rect width="24" height="24" rx="5" fill="#22C55E"/>
              <path d="M7 8l4 4-4 4" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M13 16h4" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
            Cline
          </button>
        </div>
      </div>

      {selectedAgent && (
        <DeployAgentModal
          agentId={selectedAgent}
          onClose={() => setSelectedAgent(null)}
        />
      )}
    </div>
  )
}
