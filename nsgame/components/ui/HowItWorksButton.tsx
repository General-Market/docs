'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'

const DISMISS_KEY = 'gm-hiw-dismissed'

export function HowItWorksButton() {
  const t = useTranslations('common')
  const [open, setOpen] = useState(false)
  const [dismissed, setDismissed] = useState(true) // start hidden to avoid flash

  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISS_KEY) === '1')
  }, [])

  const dismiss = (e: React.MouseEvent) => {
    e.stopPropagation()
    setDismissed(true)
    localStorage.setItem(DISMISS_KEY, '1')
  }

  if (dismissed) return null

  return (
    <>
      {/* Mobile: vertical tab on right edge */}
      <div className="fixed right-0 top-1/2 -translate-y-1/2 z-40 lg:hidden flex flex-col items-center">
        <button
          onClick={dismiss}
          className="bg-black text-white/50 hover:text-white text-[10px] font-bold rounded-tl-lg px-1.5 py-1 transition-colors"
          aria-label={t('actions.close')}
        >
          ✕
        </button>
        <button
          onClick={() => setOpen(true)}
          className="bg-black text-white text-label font-bold tracking-[0.08em] uppercase py-3 px-1.5 rounded-bl-lg shadow-lg"
          style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
        >
          {t('actions.how_it_works')}
        </button>
      </div>

      {/* Desktop: bottom-right corner button */}
      <div className="fixed bottom-6 right-6 z-40 hidden lg:flex items-center gap-0">
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 bg-black text-white text-caption font-bold uppercase tracking-[0.08em] px-4 py-2.5 rounded-l-lg shadow-lg hover:bg-zinc-800 transition-colors"
        >
          {`\u25b6 ${t('actions.how_it_works')}`}
        </button>
        <button
          onClick={dismiss}
          className="bg-black text-white/40 hover:text-white text-[11px] font-bold px-2 py-2.5 rounded-r-lg shadow-lg border-l border-white/10 hover:bg-zinc-800 transition-colors"
          aria-label={t('actions.close')}
        >
          ✕
        </button>
      </div>

      {/* Video modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={() => setOpen(false)}
        >
          <div
            className="relative w-full max-w-3xl mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setOpen(false)}
              className="absolute -top-10 right-0 text-white text-sm font-bold hover:opacity-80"
            >
              {`\u2715 ${t('actions.close')}`}
            </button>
            <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
              <iframe
                className="absolute inset-0 w-full h-full rounded-lg"
                src="https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1"
                allow="autoplay; encrypted-media"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
