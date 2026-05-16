'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

export function AutoUnlock({ slug, code }: { slug: string; code: string }) {
  const router = useRouter()
  const fired = useRef(false)

  useEffect(() => {
    if (fired.current) return
    fired.current = true
    ;(async () => {
      try {
        const res = await fetch(`/room/${encodeURIComponent(slug)}/unlock`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        })
        if (res.ok) {
          router.replace(`/room/${encodeURIComponent(slug)}`)
        } else if (res.status === 429) {
          router.replace(`/room/${encodeURIComponent(slug)}?error=throttled`)
        } else {
          router.replace(`/room/${encodeURIComponent(slug)}?error=invalid`)
        }
      } catch {
        router.replace(`/room/${encodeURIComponent(slug)}?error=network`)
      }
    })()
  }, [slug, code, router])

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center space-y-4">
        <div className="inline-block h-6 w-6 rounded-full border-2 border-neutral-300 border-t-black animate-spin" />
        <p className="text-[15px] text-neutral-600">Unlocking the room…</p>
      </div>
    </main>
  )
}
