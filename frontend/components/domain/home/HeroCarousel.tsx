'use client'

import { useEffect, useState } from 'react'
import { HeroCard } from './HeroCard'
import type { Coverage } from './AssetCard'
import type { SourceFeed } from '@/lib/vision/adapters'

type HeroSpec = {
  sourceId: string
  displayName: string
  meta: string
  series: number[]
  coverage: Coverage
  assetName?: string
  assetValue?: string
  hrefOverride?: string
}

interface Props {
  features: HeroSpec[]
  side: SourceFeed[]
  /** Auto-advance interval in ms. Set to 0 to disable. Defaults to 7000. */
  intervalMs?: number
}

export function HeroCarousel({ features, side, intervalMs = 7000 }: Props) {
  const [i, setI] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (paused || intervalMs <= 0 || features.length < 2) return
    const t = setInterval(() => {
      setI((prev) => (prev + 1) % features.length)
    }, intervalMs)
    return () => clearInterval(t)
  }, [paused, intervalMs, features.length])

  const active = features[i] ?? features[0]
  if (!active) return null

  const dots =
    features.length > 1 ? (
      <div
        className="flex items-center gap-2"
        role="tablist"
        aria-label="Featured sources"
      >
        {features.map((f, idx) => {
          const isActive = idx === i
          return (
            <button
              key={f.sourceId}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-label={`Show ${f.displayName}`}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setI(idx)
              }}
              className="transition-all"
              style={{
                width: 6,
                height: 6,
                borderRadius: 999,
                background: isActive ? 'var(--apple-text)' : 'rgba(0,0,0,0.22)',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                transitionTimingFunction: 'var(--apple-ease-default)',
                transitionDuration: '300ms',
              }}
            />
          )
        })}
      </div>
    ) : null

  return (
    <div
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <HeroCard feature={active} side={side} dots={dots} />
    </div>
  )
}
