'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const INITIAL_ERROR: Record<string, string> = {
  invalid: 'The link you used has an invalid code. Enter it manually below.',
  throttled: 'Too many attempts. Wait a few minutes and try again.',
  network: 'Connection failed. Try again.',
}

export function UnlockForm({
  slug,
  title,
  initialError,
}: {
  slug: string
  title: string
  initialError?: string
}) {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(
    initialError ? INITIAL_ERROR[initialError] ?? null : null,
  )
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch(`/room/${encodeURIComponent(slug)}/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      if (res.ok) {
        router.refresh()
      } else if (res.status === 429) {
        setError('Too many attempts. Wait a few minutes.')
      } else {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        setError(body.error ?? 'Code rejected.')
      }
    } catch {
      setError('Network error. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

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

      <div className="relative z-10 w-full max-w-md">
        <div
          className="rounded-2xl border border-white/15 bg-white/8 p-8 md:p-10 space-y-7 shadow-2xl"
          style={{
            backdropFilter: 'saturate(180%) blur(20px)',
            WebkitBackdropFilter: 'saturate(180%) blur(20px)',
            backgroundColor: 'rgba(255,255,255,0.08)',
          }}
        >
          <div className="text-center space-y-2">
            <p className="text-[12px] uppercase tracking-[0.18em] text-white/60">
              General Market
            </p>
            <h1 className="text-[28px] font-semibold tracking-tight text-white">
              {title}
            </h1>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <label className="block">
              <span className="block text-[12px] font-medium text-white/70 mb-2 uppercase tracking-wider">
                Access code
              </span>
              <input
                type="text"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="ABCD-EFGH-IJKL"
                required
                disabled={submitting}
                className="w-full rounded-xl border border-white/20 bg-black/30 px-4 py-3 text-[17px] font-mono tracking-wider text-white placeholder:text-white/30 focus:outline-none focus:border-white/60 focus:ring-2 focus:ring-white/20 disabled:opacity-50"
              />
            </label>

            {error && (
              <p className="text-[14px] text-red-300">{error}</p>
            )}

            <button
              type="submit"
              disabled={submitting || code.length === 0}
              className="w-full rounded-full bg-white text-black py-3 text-[15px] font-medium hover:bg-white/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting ? 'Unlocking…' : 'Unlock'}
            </button>
          </form>

          <p className="text-center text-[12px] text-white/50">
            This link is personal. Don&apos;t share it.
          </p>
        </div>
      </div>
    </main>
  )
}
