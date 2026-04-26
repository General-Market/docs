'use client'

import { useEffect, useState } from 'react'
import { Link } from '@/i18n/routing'

const STORAGE_KEY = 'nsgame_age_confirmed'

function readConfirmation(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function writeConfirmation() {
  try {
    window.localStorage.setItem(STORAGE_KEY, '1')
  } catch {
    /* ignore */
  }
}

export function AgeGateModal() {
  const [visible, setVisible] = useState(false)
  const [affirmed, setAffirmed] = useState(false)

  useEffect(() => {
    if (!readConfirmation()) setVisible(true)
  }, [])

  if (!visible) return null

  const enter = () => {
    if (!affirmed) return
    writeConfirmation()
    setVisible(false)
  }
  const leave = () => {
    // Send the visitor somewhere harmless. The protocol does not care.
    if (typeof window !== 'undefined') {
      window.location.href = 'https://www.google.com'
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="age-gate-title"
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-zinc-950/90 backdrop-blur-sm"
    >
      <div className="w-full max-w-lg rounded-md border border-zinc-800 bg-zinc-950 shadow-2xl shadow-black/60 p-6 sm:p-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500 mb-3">
          Age affirmation
        </p>
        <h2
          id="age-gate-title"
          className="text-[22px] sm:text-[26px] font-bold tracking-tight text-zinc-50 leading-tight mb-4"
        >
          You are about to enter an adult product.
        </h2>
        <p className="text-[14px] text-zinc-400 leading-relaxed mb-3">
          The subjects of these markets are adult performers. The signals
          you bet on come from adult-tube and cam-room platforms. There is
          no version of nsgame that is not an adult product.
        </p>
        <p className="text-[14px] text-zinc-400 leading-relaxed mb-5">
          We do not check ID. We ask, and we expect an honest answer. The
          honesty is yours; the consequences of lying are also yours.
        </p>

        <label className="flex items-start gap-3 mb-6 cursor-pointer group">
          <input
            type="checkbox"
            checked={affirmed}
            onChange={e => setAffirmed(e.target.checked)}
            className="mt-1 accent-emerald-500 shrink-0"
          />
          <span className="text-[13px] text-zinc-300 leading-relaxed">
            I am at least 18 years of age, or the age of majority in the
            jurisdiction from which I am accessing this site, whichever is
            greater. I understand that nsgame's markets are settled against
            public metrics from adult-tube and cam-room platforms, and I
            consent to seeing such material referenced. I am accessing
            nsgame voluntarily, for my own use, and not on behalf of anyone
            underage.
          </span>
        </label>

        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
          <button
            onClick={leave}
            className="px-5 py-2.5 rounded-sm text-[13px] font-medium tracking-tight border border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-100 transition-colors"
          >
            Leave
          </button>
          <button
            onClick={enter}
            disabled={!affirmed}
            className="px-5 py-2.5 rounded-sm text-[13px] font-semibold tracking-tight bg-emerald-400 text-zinc-950 hover:bg-emerald-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Enter
          </button>
        </div>

        <p className="mt-6 text-[11px] text-zinc-600 leading-relaxed">
          The gate is soft. The honesty about it is not. See the{' '}
          <Link
            href="/legal/age-gate"
            className="underline hover:text-zinc-300 transition-colors"
          >
            Age Verification
          </Link>{' '}
          and{' '}
          <Link
            href="/trust/subject-removal-policy"
            className="underline hover:text-zinc-300 transition-colors"
          >
            Subject Removal
          </Link>{' '}
          policies.
        </p>
      </div>
    </div>
  )
}
