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

  return (
    <div
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <HeroCard feature={active} side={side} />

      {features.length > 1 && (
        <div
          className="pointer-events-none absolute inset-x-0 bottom-4 z-30 flex justify-center sm:bottom-5"
          aria-hidden={false}
        >
          <div
            className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5"
            style={{
              background: 'rgba(255,255,255,0.78)',
              backdropFilter: 'saturate(180%) blur(10px)',
              WebkitBackdropFilter: 'saturate(180%) blur(10px)',
              border: '1px solid rgba(0,0,0,0.06)',
            }}
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
                    width: isActive ? 22 : 6,
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
        </div>
      )}
    </div>
  )
}
