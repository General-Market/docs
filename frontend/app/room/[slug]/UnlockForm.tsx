'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function UnlockForm({ slug, title }: { slug: string; title: string }) {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
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
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center space-y-2">
          <p className="text-[13px] uppercase tracking-[0.14em] text-neutral-500">
            General Market
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block">
            <span className="block text-[13px] font-medium text-neutral-700 mb-2">
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
              className="w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-[17px] font-mono tracking-wider placeholder:text-neutral-400 focus:outline-none focus:border-black focus:ring-2 focus:ring-black/10 disabled:opacity-50"
            />
          </label>

          {error && (
            <p className="text-[14px] text-red-600">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting || code.length === 0}
            className="w-full rounded-full bg-black text-white py-3 text-[15px] font-medium hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Unlocking…' : 'Unlock'}
          </button>
        </form>

        <p className="text-center text-[13px] text-neutral-500">
          This link is personal. Don't share it.
        </p>
      </div>
    </main>
  )
}
