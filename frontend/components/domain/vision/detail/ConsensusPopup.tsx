'use client'

import { useRef, useEffect } from 'react'
import { SpringModal } from '@/components/ui/spring'
import { useTranslations } from 'next-intl'

interface ConsensusPopupProps {
  marketId: string
  onClose: () => void
}

interface ConsensusEntry {
  batchId: number
  direction: 'UP' | 'DN'
  confidence: number
}

// Mock data for consensus history until real API is wired
const MOCK_ENTRIES: ConsensusEntry[] = [
  { batchId: 142, direction: 'UP', confidence: 87 },
  { batchId: 141, direction: 'DN', confidence: 63 },
  { batchId: 140, direction: 'UP', confidence: 91 },
  { batchId: 139, direction: 'UP', confidence: 74 },
  { batchId: 138, direction: 'DN', confidence: 56 },
]

export function ConsensusPopup({ marketId, onClose }: ConsensusPopupProps) {
  const t = useTranslations('vision')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  return (
    <SpringModal
      ref={ref}
      className="absolute z-50 top-full left-0 mt-1 glass-panel rounded-xl shadow-2xl p-3 w-[220px]"
    >
      <div className="text-micro font-bold uppercase tracking-[0.08em] text-text-muted mb-0.5">
        Consensus History
      </div>
      <div className="text-label font-mono text-text-secondary truncate mb-2">
        {marketId}
      </div>
      <div className="text-[9px] font-semibold uppercase tracking-[0.08em] text-text-muted mb-1.5">
        Last 5 batches
      </div>
      <div className="space-y-1">
        {MOCK_ENTRIES.map((entry) => (
          <div
            key={entry.batchId}
            className="flex items-center justify-between py-1 px-1.5 rounded-lg text-label bg-black/[0.03]"
          >
            <span className="font-mono text-text-muted">#{entry.batchId}</span>
            <span
              className={`font-bold ${
                entry.direction === 'UP' ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {entry.direction}
            </span>
            <span className="font-mono text-text-secondary">{entry.confidence}%</span>
          </div>
        ))}
      </div>
    </SpringModal>
  )
}
