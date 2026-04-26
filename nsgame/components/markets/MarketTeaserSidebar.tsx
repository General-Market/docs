'use client'

import { useEffect, useMemo, useRef } from 'react'
import type { UpcomingSlot } from '@/lib/markets/hooks'
import {
  deriveYesPct,
  pctToDecimalOdd,
  useMarketStatesBatch,
} from '@/lib/markets/hooks'
import { useNowSecs } from './CountdownTimer'

// Side rail. Three teasers stack against an ambient broll, then a CTA
// pinned at the bottom. Lifted in shape from frontend's SourceSidebar:
// fixed aspect, video flush, cards floated over a dim gradient. The
// content is nsgame's own — pairs, avatars, parimutuel odds.

const SIDEBAR_VIDEO = '/source-video/tubes.mp4'

// Two sidebars share one src but buffer independently. Keep the first
// mounted as master; nudge the others back if they drift more than
// 100ms. Imperceptible seeks, synced loops.
const syncedVideos = new Set<HTMLVideoElement>()
let syncIntervalId: ReturnType<typeof setInterval> | null = null

function ensureSyncLoop() {
  if (syncIntervalId !== null) return
  syncIntervalId = setInterval(() => {
    if (syncedVideos.size < 2) {
      if (syncIntervalId !== null) clearInterval(syncIntervalId)
      syncIntervalId = null
      return
    }
    const videos = Array.from(syncedVideos)
    const master = videos.find(v => v.readyState >= 2)
    if (!master) return
    const t = master.currentTime
    for (const v of videos) {
      if (v === master || v.readyState < 2) continue
      if (Math.abs(v.currentTime - t) > 0.1) v.currentTime = t
    }
  }, 500)
}

function useSyncedVideoRef() {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const video = ref.current
    if (!video) return
    syncedVideos.add(video)
    ensureSyncLoop()
    return () => {
      syncedVideos.delete(video)
    }
  }, [])
  return ref
}

export interface MarketTeaserSidebarProps {
  /** All upcoming slots — the sidebar picks its own slice. */
  slots: UpcomingSlot[]
  /** Which rail this instance occupies. Mirrors the broll. */
  side: 'left' | 'right'
  /** Click handler for any teaser card / the bottom CTA. */
  onSelect?: (slot: UpcomingSlot) => void
  className?: string
}

// Stars only on the rails. Cams settle every two minutes — the cadence
// is too tight to read as a teaser, and the avatars repeat. Xvideos
// (stars board) gives a longer dwell and a bigger pool of headshots.
const TEASERS_PER_SIDE = 5

function pickTeasers(slots: UpcomingSlot[], side: 'left' | 'right'): UpcomingSlot[] {
  const now = Math.floor(Date.now() / 1000)
  const open = slots
    .filter(s => s.board === 'stars' && s.closeTime > now)
    .slice()
    .sort((a, b) => a.closeTime - b.closeTime)
  return side === 'left'
    ? open.slice(0, TEASERS_PER_SIDE)
    : open.slice(TEASERS_PER_SIDE, TEASERS_PER_SIDE * 2)
}

function formatDateTime(unixSecs: number): { date: string; time: string } {
  const d = new Date(unixSecs * 1000)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  const hh = String(d.getHours()).padStart(2, '0')
  const mn = String(d.getMinutes()).padStart(2, '0')
  return { date: `${dd}.${mm}.${yyyy}`, time: `${hh}:${mn}` }
}

function formatOdd(m: number | null): string {
  if (m === null || !Number.isFinite(m)) return '—'
  if (m >= 100) return m.toFixed(0)
  return m.toFixed(2)
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '··'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase()
}

interface SideAvatarProps {
  slug: string
  name: string
  side: 'a' | 'b'
}

function SideAvatar({ slug, name, side }: SideAvatarProps) {
  const ringTone = side === 'a' ? 'ring-emerald-400/50' : 'ring-rose-400/50'
  return (
    <span
      className={[
        'relative inline-flex h-10 w-10 shrink-0 overflow-hidden rounded-full ring-2',
        ringTone,
      ].join(' ')}
      aria-hidden
    >
      <img
        src={`/models/${slug}.jpg`}
        alt=""
        loading="lazy"
        decoding="async"
        className="h-full w-full object-cover"
        onError={(e) => {
          const img = e.currentTarget
          img.style.display = 'none'
          const fallback = img.nextElementSibling as HTMLElement | null
          if (fallback) fallback.style.display = 'flex'
        }}
      />
      <span
        className="absolute inset-0 hidden items-center justify-center bg-zinc-800 text-[11px] font-semibold tracking-tight text-zinc-300"
      >
        {initials(name)}
      </span>
    </span>
  )
}

interface TeaserCardProps {
  slot: UpcomingSlot
  yesOdd: number | null
  noOdd: number | null
  onClick: () => void
}

function TeaserCard({ slot, yesOdd, noOdd, onClick }: TeaserCardProps) {
  const { date, time } = formatDateTime(slot.closeTime)

  return (
    <button
      type="button"
      onClick={onClick}
      className="group block w-full rounded-lg border border-zinc-800/80 bg-zinc-950/80 p-3 text-left backdrop-blur-md transition-colors duration-150 hover:border-zinc-700 hover:bg-zinc-900/80"
    >
      <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-2">
        <div className="flex min-w-0 flex-col items-center gap-1.5 text-center">
          <SideAvatar slug={slot.slugA} name={slot.displayA} side="a" />
          <span className="w-full truncate text-[11px] font-bold leading-tight tracking-tight text-zinc-100">
            {slot.displayA}
          </span>
        </div>

        <div className="flex flex-col items-center justify-start pt-2 text-center">
          <span className="font-mono text-[10px] tabular-nums text-zinc-500">{date}</span>
          <span className="font-mono text-[14px] font-bold tabular-nums leading-tight text-zinc-100">{time}</span>
        </div>

        <div className="flex min-w-0 flex-col items-center gap-1.5 text-center">
          <SideAvatar slug={slot.slugB} name={slot.displayB} side="b" />
          <span className="w-full truncate text-[11px] font-bold leading-tight tracking-tight text-zinc-100">
            {slot.displayB}
          </span>
        </div>
      </div>

      <div className="mt-2.5 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <span className="inline-flex h-7 w-full items-center justify-center rounded-md bg-emerald-500/15 text-[13px] font-bold tabular-nums text-emerald-200 ring-1 ring-emerald-400/30 group-hover:bg-emerald-500/25">
          {formatOdd(yesOdd)}
        </span>
        <span aria-hidden className="text-[10px] text-zinc-600">vs</span>
        <span className="inline-flex h-7 w-full items-center justify-center rounded-md bg-rose-500/15 text-[13px] font-bold tabular-nums text-rose-200 ring-1 ring-rose-400/30 group-hover:bg-rose-500/25">
          {formatOdd(noOdd)}
        </span>
      </div>
    </button>
  )
}

export function MarketTeaserSidebar({
  slots,
  side,
  onSelect,
  className = '',
}: MarketTeaserSidebarProps) {
  const videoRef = useSyncedVideoRef()

  // Re-tick at minute granularity so the soonest-closing filter doesn't
  // freeze on a stale boundary while the user is staring at the rail.
  const now = useNowSecs()
  const teasers = useMemo(() => pickTeasers(slots, side), [slots, side, now])

  // Pull live pool sizes for the teasers in one batched RPC call. Empty
  // pdas filter cheaply when there are no teasers (all slots are closed).
  const pdas = useMemo(() => teasers.map(t => t.marketPda), [teasers])
  const states = useMemo(() => pdas, [pdas])
  const stateMap = useMarketStatesBatch(states)

  if (teasers.length === 0) {
    // No open slots in this slice — render nothing so the layout collapses
    // to the existing 3-column grid. The CalendarPageClient handles spacing.
    return null
  }

  const handleSelect = (slot: UpcomingSlot) => {
    if (onSelect) onSelect(slot)
  }

  return (
    <aside
      className={[
        'w-[260px] shrink-0 hidden lg:block',
        className,
      ].join(' ')}
      aria-label={side === 'left' ? 'Featured fights — left' : 'Featured fights — right'}
    >
      <div className="sticky top-20 self-start">
        <div className="relative h-[calc(100vh-6rem)] overflow-hidden rounded-xl border border-zinc-800/60 bg-zinc-950">
          {/* Ambient broll. Mirrored on the right rail so the two read
              as a matched pair instead of duplicate footage. */}
          <video
            ref={videoRef}
            src={SIDEBAR_VIDEO}
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            aria-hidden
            className="absolute inset-0 h-full w-full object-cover opacity-50"
            style={{ transform: side === 'right' ? 'scaleX(-1)' : undefined }}
          />

          {/* Dim gradient. Cards have to read against the broll without
              the video being murdered by a flat black layer. */}
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/55 to-black/85"
          />

          {/* Tall rail, three cards centered against the broll — empty
              space above and below carries the video instead of the
              cards crowding the top edge. */}
          <div className="relative flex h-full flex-col justify-center gap-3 p-3">
            {teasers.map(slot => {
              const state = stateMap[slot.marketPda] ?? null
              // Same three-tier prior as the row pill — pool first, then
              // audience baseline, then 50/50. Empty devnet markets stop
              // showing "—" and start showing a real number.
              const yesPct = deriveYesPct(state, slot.audienceA, slot.audienceB)
              const yesOdd = pctToDecimalOdd(yesPct)
              const noOdd = pctToDecimalOdd(100 - yesPct)
              return (
                <TeaserCard
                  key={slot.marketPda}
                  slot={slot}
                  yesOdd={yesOdd}
                  noOdd={noOdd}
                  onClick={() => handleSelect(slot)}
                />
              )
            })}

            <button
              type="button"
              onClick={() => {
                const first = teasers[0]
                if (first) handleSelect(first)
              }}
              className="mt-1 inline-flex w-full items-center justify-center rounded-lg bg-sky-400 px-4 py-3 text-[15px] font-extrabold uppercase tracking-[0.12em] text-sky-950 transition-colors duration-150 hover:bg-sky-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
            >
              Bet now
            </button>
          </div>
        </div>
      </div>
    </aside>
  )
}
