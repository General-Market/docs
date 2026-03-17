'use client'

import { useState } from 'react'

export function HowItWorksButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Mobile: vertical tab on right edge */}
      <button
        onClick={() => setOpen(true)}
        className="fixed right-0 top-1/2 -translate-y-1/2 z-40 lg:hidden bg-black text-white text-label font-bold tracking-[0.08em] uppercase py-3 px-1.5 rounded-l-lg shadow-card"
        style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
      >
        How It Works
      </button>

      {/* Desktop: bottom-right corner button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 hidden lg:flex items-center gap-2 bg-black text-white text-caption font-bold uppercase tracking-[0.08em] px-4 py-2.5 rounded-md shadow-card hover:bg-brand-dark transition-colors"
      >
        ▶ How It Works
      </button>

      {/* Video modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 animate-backdrop-in"
          onClick={() => setOpen(false)}
        >
          <div
            className="relative w-full max-w-3xl mx-4 animate-modal-in"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setOpen(false)}
              className="absolute -top-10 right-0 text-white text-sm font-bold hover:opacity-80"
            >
              Close
            </button>
            <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
              <iframe
                className="absolute inset-0 w-full h-full rounded-md"
                src=""
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
