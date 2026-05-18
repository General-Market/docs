'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { formatUnits } from 'viem'
import type { FloorBatch } from '@/hooks/vision/useFloorStream'
import { getAddressUrl } from '@/lib/utils/explorer'
import { VISION_ADDRESS } from '@/lib/vision/constants'

const PROOF_URL = getAddressUrl(VISION_ADDRESS, 'l3')

interface Props {
  batch: FloorBatch
}

const RING_RADIUS = 19
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

function formatPool(weiStr: string): string {
  try {
    const n = Number(formatUnits(BigInt(weiStr || '0'), 18))
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
    if (n >= 10_000) return `$${(n / 1_000).toFixed(0)}k`
    if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`
    return `$${n.toFixed(0)}`
  } catch {
    return '$0'
  }
}

function statusLabel(status: FloorBatch['status']): string {
  if (status === 'betting') return 'Open'
  if (status === 'locked') return 'Locked'
  if (status === 'settling') return 'Settling'
  if (status === 'settled') return 'Settled'
  return '·'
}

function statusTint(status: FloorBatch['status']): { bg: string; fg: string } {
  if (status === 'betting') return { bg: 'rgba(0,113,227,0.10)', fg: '#0071e3' }
  if (status === 'locked' || status === 'settling')
    return { bg: 'rgba(0,0,0,0.06)', fg: '#6e6e73' }
  if (status === 'settled') return { bg: 'rgba(0,0,0,0.04)', fg: '#86868b' }
  return { bg: 'rgba(0,0,0,0.04)', fg: '#86868b' }
}

/**
 * Source logo. Mirrors the treatment used in the homepage search bar:
 * tries /source-imgs/icons/{id}.png, falls back to a first-letter chip.
 * Keeps both UIs visually consistent.
 */
function SourceLogo({
  sourceId,
  name,
  brand,
}: {
  sourceId: string
  name: string
  brand: string
}) {
  const [broken, setBroken] = useState(false)
  if (!broken) {
    return (
      <Image
        src={`/source-imgs/icons/${sourceId}.png`}
        alt=""
        width={28}
        height={28}
        className="absolute left-1/2 top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full object-cover"
        unoptimized
        onError={() => setBroken(true)}
      />
    )
  }
  return (
    <span
      className="absolute left-1/2 top-1/2 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full font-semibold"
      style={{
        background: '#f5f5f7',
        color: brand || '#1d1d1f',
        fontSize: 12,
        letterSpacing: '-0.01em',
      }}
      aria-hidden
    >
      {(name || sourceId).charAt(0).toUpperCase()}
    </span>
  )
}

export function SourceBatchCard({ batch }: Props) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000))
  useEffect(() => {
    const i = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000)
    return () => clearInterval(i)
  }, [])

  const remaining = batch.bettingEnd ? Math.max(0, batch.bettingEnd - now) : 0
  const total = batch.tickDuration || 1
  const progress = total > 0 ? Math.min(1, Math.max(0, 1 - remaining / total)) : 0
  const dashOffset = RING_CIRCUMFERENCE * (1 - progress)

  const min = Math.floor(remaining / 60)
  const sec = remaining % 60
  const countdownText = batch.bettingEnd ? `${min}:${String(sec).padStart(2, '0')}` : '—:—'

  const pool = formatPool(batch.tvlStr)
  const pulsing = remaining > 0 && remaining <= 10
  const pulseDuration = remaining <= 1 ? '0.5s' : remaining <= 5 ? '0.8s' : '1.2s'
  const status = statusLabel(batch.status)
  const tint = statusTint(batch.status)

  return (
    <a
      href={PROOF_URL}
      target="_blank"
      rel="noopener noreferrer"
      title="Verify on the L3 explorer"
      className="group relative flex cursor-pointer items-center gap-3 rounded-[14px] bg-white px-3 py-2.5 no-underline hover:bg-[#fafafa]"
      style={{
        border: '1px solid var(--apple-border)',
        animation: pulsing ? `floorCardPulse ${pulseDuration} ease-in-out infinite` : undefined,
        boxShadow: 'var(--apple-shadow-card)',
        transition:
          'transform 240ms cubic-bezier(0.25,0.1,0.3,1), box-shadow 240ms cubic-bezier(0.25,0.1,0.3,1), background-color 200ms ease',
      }}
    >
      <div className="relative h-11 w-11 shrink-0">
        <svg className="absolute inset-0" viewBox="0 0 44 44" aria-hidden>
          <circle
            cx="22"
            cy="22"
            r={RING_RADIUS}
            fill="none"
            stroke="rgba(0,0,0,0.06)"
            strokeWidth="2"
          />
          <circle
            cx="22"
            cy="22"
            r={RING_RADIUS}
            fill="none"
            stroke={batch.sourceBrandBg || '#1d1d1f'}
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray={RING_CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
            transform="rotate(-90 22 22)"
            style={{ transition: 'stroke-dashoffset 1s linear' }}
          />
        </svg>
        <SourceLogo
          sourceId={batch.sourceId}
          name={batch.sourceName}
          brand={batch.sourceBrandBg}
        />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span
            className="truncate text-[14px] font-medium tracking-[-0.014em] text-[#1d1d1f]"
            style={{ fontFamily: 'var(--apple-font-text)' }}
          >
            {batch.sourceName}
          </span>
          <span
            className="shrink-0 tabular-nums text-[12px] text-[#6e6e73]"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {countdownText}
          </span>
        </div>
        <div className="mt-1 flex items-center justify-between gap-2">
          <span className="tabular-nums text-[13px] font-medium text-[#1d1d1f]">{pool}</span>
          <span
            className="inline-flex items-center rounded-[980px] px-2 py-[2px] text-[10px] font-semibold tracking-[0.04em]"
            style={{ background: tint.bg, color: tint.fg }}
          >
            {status}
          </span>
        </div>
      </div>
    </a>
  )
}
