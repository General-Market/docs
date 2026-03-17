'use client'

import { useRef, useEffect } from 'react'

interface ConsensusPopupProps {
  marketId: string
  onClose: () => void
}


export function ConsensusPopup({ marketId, onClose }: ConsensusPopupProps) {
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
    <div
      ref={ref}
      className="absolute z-50 top-full left-0 mt-1 bg-white border border-border-light rounded-md shadow-card p-3 w-[220px] animate-scale-in"
    >
      <div className="text-micro font-bold uppercase tracking-[0.08em] text-text-muted mb-0.5">
        Consensus History
      </div>
      <div className="text-label font-mono text-text-secondary truncate mb-2">
        {marketId}
      </div>
      <div className="py-3 text-center">
        <p className="text-micro text-text-muted font-mono">No consensus rounds recorded yet.</p>
      </div>
    </div>
  )
}
