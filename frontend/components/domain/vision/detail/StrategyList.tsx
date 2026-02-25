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
        {/* Claude Code */}
        <button
          type="button"
          className="w-full flex items-center gap-2.5 rounded-lg border-2 border-[#18181B] px-3 py-2.5 text-[13px] font-bold text-[#52525b] hover:bg-[#18181B] hover:text-white transition-colors"
        >
          <span className="w-5 h-5 rounded-full bg-[#D97706] flex items-center justify-center text-[8px] font-black text-white leading-none shrink-0">
            C
          </span>
          Deploy with Claude Code
        </button>

        {/* Cursor */}
        <button
          type="button"
          className="w-full flex items-center gap-2.5 rounded-lg border-2 border-[#18181B] px-3 py-2.5 text-[13px] font-bold text-[#52525b] hover:bg-[#18181B] hover:text-white transition-colors"
        >
          <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor"><rect width="24" height="24" rx="4" fill="#000"/><path d="M7 6l10 6-10 6V6z" fill="#fff"/></svg>
          Deploy with Cursor Agent
        </button>

        {/* GitHub Copilot */}
        <button
          type="button"
          className="w-full flex items-center gap-2.5 rounded-lg border-2 border-[#18181B] px-3 py-2.5 text-[13px] font-bold text-[#52525b] hover:bg-[#18181B] hover:text-white transition-colors"
        >
          <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.009-.866-.013-1.7-2.782.603-3.369-1.342-3.369-1.342-.454-1.155-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z"/></svg>
          Deploy with Copilot
        </button>

        {/* OpenAI Codex */}
        <button
          type="button"
          className="w-full flex items-center gap-2.5 rounded-lg border-2 border-[#18181B] px-3 py-2.5 text-[13px] font-bold text-[#52525b] hover:bg-[#18181B] hover:text-white transition-colors"
        >
          <span className="w-5 h-5 rounded-full bg-[#10A37F] flex items-center justify-center text-[9px] font-black text-white leading-none shrink-0">
            O
          </span>
          Deploy with Codex CLI
        </button>

        {/* Windsurf */}
        <button
          type="button"
          className="w-full flex items-center gap-2.5 rounded-lg border-2 border-[#18181B] px-3 py-2.5 text-[13px] font-bold text-[#52525b] hover:bg-[#18181B] hover:text-white transition-colors"
        >
          <span className="w-5 h-5 rounded-full bg-[#0EA5E9] flex items-center justify-center text-[9px] font-black text-white leading-none shrink-0">
            W
          </span>
          Deploy with Windsurf
        </button>
      </div>
    </div>
  )
}
