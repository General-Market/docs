'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

export function AutoUnlock({ code }: { code: string }) {
  const router = useRouter()
  const fired = useRef(false)

  useEffect(() => {
    if (fired.current) return
    fired.current = true
    ;(async () => {
      try {
        const res = await fetch(`/room/unlock`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        })
        if (res.ok) {
          router.replace(`/room`)
        } else if (res.status === 429) {
          router.replace(`/room?error=throttled`)
        } else {
          router.replace(`/room?error=invalid`)
        }
      } catch {
        router.replace(`/room?error=network`)
      }
    })()
  }, [code, router])

  return (
    <main className="fixed inset-0 flex items-center justify-center px-6 overflow-hidden bg-black">
      <video
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        className="absolute inset-0 w-full h-full object-cover"
        aria-hidden="true"
      >
        <source src="/room/bg-loop.mp4" type="video/mp4" />
      </video>
      <div
        className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/40 to-black/60"
        aria-hidden="true"
      />
      <div
        className="relative z-10 rounded-2xl border border-white/15 px-8 py-6 flex items-center gap-4 shadow-2xl"
        style={{
          backdropFilter: 'saturate(180%) blur(20px)',
          WebkitBackdropFilter: 'saturate(180%) blur(20px)',
          backgroundColor: 'rgba(255,255,255,0.08)',
        }}
      >
        <div className="h-5 w-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
        <p className="text-[15px] text-white/80">Unlocking the room…</p>
      </div>
    </main>
  )
}
