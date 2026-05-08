'use client'

import { useState, useCallback } from 'react'
import type { BitmapEditor } from '@/hooks/vision/useBitmapEditor'
import DeployAgentModal from './DeployAgentModal'
import { useTranslations } from 'next-intl'

interface Strategy {
  id: string
  name: string
  description: string
  badge: string
  apply: (marketIds: string[]) => Record<string, 'up' | 'down'>
}

function useStrategies(): Strategy[] {
  const t = useTranslations('vision')
  return [
  {
    id: 'momentum',
    name: t('strategy_list_items.momentum_name'),
    description: t('strategy_list_items.momentum_description'),
    badge: t('strategy_list_items.momentum_badge'),
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
    name: t('strategy_list_items.contrarian_name'),
    description: t('strategy_list_items.contrarian_description'),
    badge: t('strategy_list_items.contrarian_badge'),
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
}

interface StrategyListProps {
  bitmapEditor: BitmapEditor
  sourceId: string
  marketIds: string[]
}

export default function StrategyList({ bitmapEditor, sourceId, marketIds }: StrategyListProps) {
  const t = useTranslations('vision')
  const STRATEGIES = useStrategies()
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
        <h3 className="text-[9px] font-bold tracking-[0.08em] text-[#999] uppercase mb-1.5">
          {t('common_labels.strategies')}
        </h3>
        <div className="flex gap-1.5">
          {STRATEGIES.map((strategy) => (
            <button
              key={strategy.id}
              type="button"
              onClick={() => handleApply(strategy)}
              disabled={marketIds.length === 0}
              className="flex-1 rounded-md border border-border-light bg-[var(--surface)] px-2 py-1.5 hover:border-[#999] disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-left fluid-press"
            >
              <p className="text-label font-semibold text-black truncate">{strategy.name}</p>
              <p className="text-[9px] text-text-muted truncate">{strategy.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* AI agent deploy buttons — compact grid */}
      <div>
        <h3 className="text-[9px] font-bold tracking-[0.08em] text-[#999] uppercase mb-1.5">
          {t('common_labels.deploy_with_ai_agent')}
        </h3>
        <div className="grid grid-cols-2 gap-1.5">
          {/* Claude Code */}
          <button type="button" onClick={() => setSelectedAgent('claude-code')} className="flex items-center gap-2 rounded-md border border-[#18181B] px-2 py-1.5 text-label font-bold text-[#52525b] hover:bg-[#18181B] hover:text-white transition-colors fluid-press">
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="12" fill="#CC785C"/>
              <path d="M14.2 6.5L8.5 17.5h2.6l1.1-2.3h4.3l1.1 2.3H20L14.2 6.5zm-.5 6.7l1.3-2.8 1.3 2.8h-2.6z" fill="#fff"/>
            </svg>
            Claude Code
          </button>
          {/* Codex */}
          <button type="button" onClick={() => setSelectedAgent('codex')} className="flex items-center gap-2 rounded-md border border-[#18181B] px-2 py-1.5 text-label font-bold text-[#52525b] hover:bg-[#18181B] hover:text-white transition-colors fluid-press">
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none">
              <rect width="24" height="24" rx="5" fill="#000"/>
              <path d="M7 7h10v2H7zM7 11h7v2H7zM7 15h10v2H7z" fill="#10A37F"/>
            </svg>
            Codex
          </button>
          {/* Cursor */}
          <button type="button" onClick={() => setSelectedAgent('cursor')} className="flex items-center gap-2 rounded-md border border-[#18181B] px-2 py-1.5 text-label font-bold text-[#52525b] hover:bg-[#18181B] hover:text-white transition-colors fluid-press">
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none">
              <rect width="24" height="24" rx="5" fill="#18181B"/>
              <path d="M7 5v14l4-4h6L7 5z" fill="#fff"/>
            </svg>
            Cursor
          </button>
          {/* Gemini CLI */}
          <button type="button" onClick={() => setSelectedAgent('gemini-cli')} className="flex items-center gap-2 rounded-md border border-[#18181B] px-2 py-1.5 text-label font-bold text-[#52525b] hover:bg-[#18181B] hover:text-white transition-colors fluid-press">
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none">
              <rect width="24" height="24" rx="5" fill="#1A73E8"/>
              <path d="M12 4l2.5 6.5L21 12l-6.5 1.5L12 20l-2.5-6.5L3 12l6.5-1.5z" fill="#fff"/>
            </svg>
            Gemini CLI
          </button>
        </div>
      </div>

      {selectedAgent && (
        <DeployAgentModal
          agentId={selectedAgent}
          onClose={() => setSelectedAgent(null)}
          sourceId={sourceId}
        />
      )}
    </div>
  )
}
