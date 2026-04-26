'use client'

import { useEffect, useState } from 'react'
import { Link } from '@/i18n/routing'

const STORAGE_KEY = 'nsgame_cookie_consent'

type Consent = 'accept' | 'reject' | 'custom'

interface CustomConsent {
  essential: true
  preferences: boolean
  analytics: boolean
}

interface StoredConsent {
  decision: Consent
  custom?: CustomConsent
  ts: number
}

function readConsent(): StoredConsent | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as StoredConsent
  } catch {
    return null
  }
}

function writeConsent(decision: Consent, custom?: CustomConsent) {
  const payload: StoredConsent = { decision, ts: Date.now() }
  if (custom) payload.custom = custom
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch {
    /* localStorage unavailable — let it pass */
  }
}

export function CookieBanner() {
  const [visible, setVisible] = useState(false)
  const [showCustom, setShowCustom] = useState(false)
  const [prefs, setPrefs] = useState({ preferences: true, analytics: false })

  useEffect(() => {
    const existing = readConsent()
    if (!existing) setVisible(true)
  }, [])

  if (!visible) return null

  const accept = () => {
    writeConsent('accept', { essential: true, preferences: true, analytics: true })
    setVisible(false)
  }
  const reject = () => {
    writeConsent('reject', { essential: true, preferences: false, analytics: false })
    setVisible(false)
  }
  const saveCustom = () => {
    writeConsent('custom', { essential: true, ...prefs })
    setVisible(false)
  }

  return (
    <aside
      role="region"
      aria-label="Cookie preferences"
      aria-labelledby="cookie-banner-title"
      className="fixed inset-x-0 bottom-0 z-[60] border-t border-zinc-800 bg-zinc-950/95 backdrop-blur-md"
    >
      <h2 id="cookie-banner-title" className="sr-only">
        Cookie preferences
      </h2>
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
        <p className="flex-1 min-w-[200px] text-[12px] sm:text-[13px] text-zinc-400 leading-snug">
          Cookies. Essential to run, preferences to remember, analytics to
          see what is broken.{' '}
          <Link
            href="/legal/cookie-policy"
            className="text-emerald-400 hover:text-emerald-300 underline underline-offset-2"
          >
            Cookie Policy
          </Link>
          .
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCustom(v => !v)}
            aria-expanded={showCustom}
            className="text-[12px] text-zinc-500 underline underline-offset-2 hover:text-zinc-200 transition-colors"
          >
            {showCustom ? 'less' : 'more'}
          </button>
          <button
            onClick={accept}
            className="px-3 py-1.5 rounded-sm text-[12px] font-semibold tracking-tight bg-emerald-400 text-zinc-950 hover:bg-emerald-300 transition-colors"
          >
            Accept
          </button>
        </div>

        {showCustom ? (
          <div className="basis-full border-t border-zinc-800 pt-3 mt-1 space-y-2">
            <label className="flex items-center gap-3 text-[12px] text-zinc-400">
              <input type="checkbox" checked disabled className="accent-emerald-500" />
              <span>
                <strong className="text-zinc-200 font-medium">Essential</strong> — required.
              </span>
            </label>
            <label className="flex items-center gap-3 text-[12px] text-zinc-400 cursor-pointer">
              <input
                type="checkbox"
                checked={prefs.preferences}
                onChange={e => setPrefs(p => ({ ...p, preferences: e.target.checked }))}
                className="accent-emerald-500"
              />
              <span>
                <strong className="text-zinc-200 font-medium">Preferences</strong> — theme, last board, gate state.
              </span>
            </label>
            <label className="flex items-center gap-3 text-[12px] text-zinc-400 cursor-pointer">
              <input
                type="checkbox"
                checked={prefs.analytics}
                onChange={e => setPrefs(p => ({ ...p, analytics: e.target.checked }))}
                className="accent-emerald-500"
              />
              <span>
                <strong className="text-zinc-200 font-medium">Analytics</strong> — PostHog, aggregated.
              </span>
            </label>
            <div className="flex gap-2 pt-1">
              <button
                onClick={reject}
                className="px-3 py-1.5 rounded-sm text-[12px] font-medium tracking-tight border border-zinc-800 text-zinc-300 hover:border-zinc-600 hover:text-zinc-100 transition-colors"
              >
                Reject all
              </button>
              <button
                onClick={saveCustom}
                className="px-3 py-1.5 rounded-sm text-[12px] font-semibold tracking-tight bg-emerald-400 text-zinc-950 hover:bg-emerald-300 transition-colors"
              >
                Save preferences
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </aside>
  )
}
