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
    <div
      role="dialog"
      aria-labelledby="cookie-banner-title"
      className="fixed inset-x-0 bottom-0 z-[60] px-4 pb-4 sm:px-6 sm:pb-6 pointer-events-none"
    >
      <div className="mx-auto max-w-3xl pointer-events-auto rounded-md border border-zinc-800 bg-zinc-950/95 backdrop-blur-md shadow-xl shadow-black/40 p-5 sm:p-6">
        <h2
          id="cookie-banner-title"
          className="text-[15px] font-semibold text-zinc-50 tracking-tight"
        >
          Cookies, briefly.
        </h2>
        <p className="mt-2 text-[13px] text-zinc-400 leading-relaxed">
          The website uses cookies. Three categories, no euphemism.{' '}
          <strong className="text-zinc-200 font-medium">Essential</strong> for the site to work,{' '}
          <strong className="text-zinc-200 font-medium">Preferences</strong> so we stop asking,{' '}
          <strong className="text-zinc-200 font-medium">Analytics</strong> so we see what is broken.
          The chain knows what your wallet does. The website knows almost nothing else.{' '}
          <Link
            href="/legal/cookie-policy"
            className="text-emerald-400 hover:text-emerald-300 underline underline-offset-2"
          >
            Cookie Policy
          </Link>
          .
        </p>

        {showCustom ? (
          <div className="mt-4 space-y-2 border-t border-zinc-800 pt-4">
            <label className="flex items-center gap-3 text-[13px] text-zinc-400">
              <input type="checkbox" checked disabled className="accent-emerald-500" />
              <span>
                <strong className="text-zinc-200 font-medium">Essential</strong> — required.
              </span>
            </label>
            <label className="flex items-center gap-3 text-[13px] text-zinc-400 cursor-pointer">
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
            <label className="flex items-center gap-3 text-[13px] text-zinc-400 cursor-pointer">
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
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-2 justify-end">
          {showCustom ? (
            <button
              onClick={saveCustom}
              className="px-4 py-2 rounded-sm text-[12px] font-semibold tracking-tight bg-emerald-400 text-zinc-950 hover:bg-emerald-300 transition-colors"
            >
              Save preferences
            </button>
          ) : (
            <>
              <button
                onClick={() => setShowCustom(true)}
                className="px-4 py-2 rounded-sm text-[12px] font-medium tracking-tight text-zinc-400 hover:text-zinc-100 transition-colors"
              >
                Customize
              </button>
              <button
                onClick={reject}
                className="px-4 py-2 rounded-sm text-[12px] font-medium tracking-tight border border-zinc-800 text-zinc-300 hover:border-zinc-600 hover:text-zinc-100 transition-colors"
              >
                Reject
              </button>
              <button
                onClick={accept}
                className="px-4 py-2 rounded-sm text-[12px] font-semibold tracking-tight bg-emerald-400 text-zinc-950 hover:bg-emerald-300 transition-colors"
              >
                Accept
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
