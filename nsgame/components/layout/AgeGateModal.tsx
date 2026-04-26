'use client'

import { useCallback, useEffect, useState } from 'react'
import { Link } from '@/i18n/routing'
import { useDialogA11y } from '@/hooks/useDialogA11y'

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
  const [showAffirmation, setShowAffirmation] = useState(false)

  useEffect(() => {
    if (!readConfirmation()) setVisible(true)
  }, [])

  const leave = useCallback(() => {
    // Send the visitor somewhere harmless. The protocol does not care.
    if (typeof window !== 'undefined') {
      window.location.href = 'https://www.google.com'
    }
  }, [])

  const dialogRef = useDialogA11y(visible, leave)

  if (!visible) return null

  const enter = () => {
    writeConfirmation()
    setVisible(false)
  }

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="age-gate-title"
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-zinc-950/40 backdrop-blur-xl"
    >
      <div className="w-full max-w-md rounded-md border border-zinc-800 bg-zinc-950/90 backdrop-blur-md shadow-2xl shadow-black/60 p-6 sm:p-7">
        <h2
          id="age-gate-title"
          className="text-[20px] sm:text-[22px] font-bold tracking-tight text-zinc-50 leading-tight mb-3"
        >
          You are about to enter an adult product.
        </h2>
        <p className="text-[14px] text-zinc-400 leading-relaxed mb-5">
          Markets on adult performers, signals from adult-tube and cam-room
          platforms. We do not check ID. The honesty is yours.
        </p>

        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
          <button
            onClick={leave}
            className="px-5 py-2.5 rounded-sm text-[13px] font-medium tracking-tight border border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-100 transition-colors"
          >
            Leave
          </button>
          <button
            onClick={enter}
            className="px-5 py-2.5 rounded-sm text-[13px] font-semibold tracking-tight bg-emerald-400 text-zinc-950 hover:bg-emerald-300 transition-colors"
          >
            Enter
          </button>
        </div>

        <button
          type="button"
          onClick={() => setShowAffirmation(v => !v)}
          aria-expanded={showAffirmation}
          className="mt-5 text-[11px] text-zinc-500 underline underline-offset-2 hover:text-zinc-300 transition-colors"
        >
          {showAffirmation ? 'Hide what you are affirming' : 'What you are affirming'}
        </button>

        {showAffirmation ? (
          <p className="mt-3 text-[12px] text-zinc-400 leading-relaxed">
            That you are at least 18, or the age of majority in your
            jurisdiction (whichever is greater); that you consent to seeing
            adult-platform metrics referenced; and that you are accessing
            nsgame voluntarily, for your own use. See the{' '}
            <Link
              href="/legal/age-gate"
              className="underline hover:text-zinc-200 transition-colors"
            >
              Age Verification
            </Link>{' '}
            and{' '}
            <Link
              href="/trust/subject-removal-policy"
              className="underline hover:text-zinc-200 transition-colors"
            >
              Subject Removal
            </Link>{' '}
            policies.
          </p>
        ) : null}
      </div>
    </div>
  )
}
