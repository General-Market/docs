'use client'

import { useCallback, useMemo } from 'react'
import type { BitmapEditor } from '@/hooks/vision/useBitmapEditor'

interface BitmapOverlayProps {
  sourceId: string
  sourceName: string
  markets: { id: string; symbol: string }[]
  bitmapEditor: BitmapEditor
}

export function BitmapOverlay({ sourceId, sourceName, markets, bitmapEditor }: BitmapOverlayProps) {
  const marketIds = useMemo(() => markets.map(m => m.id), [markets])
  const counts = bitmapEditor.getCounts(sourceId, marketIds)

  const handleCellClick = useCallback(
    (e: React.MouseEvent, marketId: string) => {
      e.stopPropagation()
      bitmapEditor.toggleCell(marketId)
    },
    [bitmapEditor],
  )

  return (
    <>
      {/* Header */}
      <div className="back-header">
        <h4>{sourceName}</h4>
        <span className="back-count">{markets.length}</span>
      </div>

      {/* Bitmap grid */}
      <div className="bitmap-grid">
        {markets.map(m => {
          const cellState = bitmapEditor.state[m.id] ?? 'empty'
          const cellClass =
            cellState === 'up' ? 'b-up' : cellState === 'down' ? 'b-dn' : 'b-empty'
          const label = m.symbol.length > 3 ? m.symbol.slice(0, 3) : m.symbol
          return (
            <div
              key={m.id}
              className={`bitmap-cell ${cellClass}`}
              title={`${m.symbol} (${cellState})`}
              onClick={e => handleCellClick(e, m.id)}
            >
              {label}
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div className="back-footer">
        <span className="bf-up">{counts.up} UP</span>
        <span className="bf-dn">{counts.down} DN</span>
        <span className="bf-empty">{markets.length - counts.up - counts.down} unset</span>
      </div>
    </>
  )
}
