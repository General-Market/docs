'use client'

import { useEffect, useRef } from 'react'

// Pure ambient broll. Two instances sit flush to the viewport edges on
// xl+, sticky just under the NavBar, mirrored across each other so the
// pair reads as one composed image instead of duplicate footage.

const SIDEBAR_VIDEO = '/source-video/tubes.mp4'

// Module-level sync — both videos share one src but buffer
// independently. Keep the first-mounted as master, nudge the others
// back if they drift more than 100ms.
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

export interface BrollSidebarProps {
  side: 'left' | 'right'
}

export function BrollSidebar({ side }: BrollSidebarProps) {
  const videoRef = useSyncedVideoRef()

  return (
    <aside
      aria-hidden
      className="hidden xl:block w-[260px] shrink-0 sticky top-14 self-start h-[calc(100vh-3.5rem)] overflow-hidden"
    >
      <video
        ref={videoRef}
        src={SIDEBAR_VIDEO}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        className="absolute inset-0 h-full w-full object-cover"
        style={{ transform: side === 'right' ? 'scaleX(-1)' : undefined }}
      />
    </aside>
  )
}
