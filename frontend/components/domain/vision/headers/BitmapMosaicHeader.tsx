'use client'

import { useRef, useEffect, useMemo } from 'react'

interface BitmapMosaicHeaderProps {
  marketIds: string[]
}

/** Hash string to number */
function hashStr(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

/** Map a market ID to RGB based on synthetic change */
function marketRGB(id: string): [number, number, number] {
  const h = hashStr(id)
  const change = ((h % 1600) - 800) / 100 // -8 to +8
  const intensity = Math.min(Math.abs(change) / 8, 1)

  if (change >= 0) {
    // Green: from pale (#e0f5e0) to deep (#16A34A)
    const r = Math.round(224 - intensity * 202)
    const g = Math.round(245 - intensity * 82)
    const b = Math.round(224 - intensity * 150)
    return [r, g, b]
  } else {
    // Red: from pale (#f5e0e0) to deep (#DC2626)
    const r = Math.round(245 - intensity * 25)
    const g = Math.round(224 - intensity * 186)
    const b = Math.round(224 - intensity * 186)
    return [r, g, b]
  }
}

export function BitmapMosaicHeader({ marketIds }: BitmapMosaicHeaderProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Pre-compute pixel colors
  const pixelColors = useMemo(() => {
    return marketIds.map((id) => marketRGB(id))
  }, [marketIds])

  // Compute grid dimensions
  const count = marketIds.length
  const cols = Math.ceil(Math.sqrt(count * 5)) // wider
  const rows = Math.ceil(count / cols)
  const pixelSize = Math.max(2, Math.min(
    Math.floor(300 / cols),
    Math.floor(60 / Math.max(rows, 1))
  ))

  const canvasWidth = cols * pixelSize
  const canvasHeight = rows * pixelSize

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear
    ctx.clearRect(0, 0, canvasWidth, canvasHeight)

    // Animate: draw pixels one by one with slight delay via requestAnimationFrame
    let frame = 0
    const pixelsPerFrame = Math.max(1, Math.ceil(count / 30)) // finish in ~30 frames

    function drawBatch() {
      if (!ctx) return
      const start = frame * pixelsPerFrame
      const end = Math.min(start + pixelsPerFrame, count)

      for (let i = start; i < end; i++) {
        const col = i % cols
        const row = Math.floor(i / cols)
        const [r, g, b] = pixelColors[i]
        ctx.fillStyle = `rgb(${r},${g},${b})`
        ctx.fillRect(col * pixelSize, row * pixelSize, pixelSize - 1, pixelSize - 1)
      }

      frame++
      if (end < count) {
        requestAnimationFrame(drawBatch)
      }
    }

    requestAnimationFrame(drawBatch)
  }, [pixelColors, cols, rows, pixelSize, count, canvasWidth, canvasHeight])

  return (
    <div className="h-16 bg-surface rounded mb-3 flex items-center justify-center overflow-hidden">
      <canvas
        ref={canvasRef}
        width={canvasWidth}
        height={canvasHeight}
        className="rounded"
        style={{ imageRendering: 'pixelated' }}
      />
    </div>
  )
}
