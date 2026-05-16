'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { DECK_SLIDES, DECK_TOTAL } from '@/lib/dataroom/deck-slides'

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

export function DeckPlayer({ initial }: { initial: number }) {
  const [idx, setIdx] = useState<number>(clamp(initial, 1, DECK_TOTAL))
  const [showMenu, setShowMenu] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const slide = DECK_SLIDES[idx - 1]

  const go = useCallback((next: number) => {
    const n = clamp(next, 1, DECK_TOTAL)
    setIdx(n)
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      url.searchParams.set('s', String(n))
      window.history.replaceState({}, '', url.toString())
    }
  }, [])

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0
      videoRef.current.play().catch(() => {})
    }
  }, [idx])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLElement && ['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter' || e.key === 'PageDown') {
        e.preventDefault()
        go(idx + 1)
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault()
        go(idx - 1)
      } else if (e.key === 'Home') {
        e.preventDefault()
        go(1)
      } else if (e.key === 'End') {
        e.preventDefault()
        go(DECK_TOTAL)
      } else if (e.key === 'Escape') {
        setShowMenu(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [idx, go])

  const touchStart = useRef<number | null>(null)
  function onTouchStart(e: React.TouchEvent) {
    touchStart.current = e.touches[0].clientX
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStart.current === null) return
    const delta = e.changedTouches[0].clientX - touchStart.current
    if (Math.abs(delta) > 50) {
      go(delta > 0 ? idx - 1 : idx + 1)
    }
    touchStart.current = null
  }

  return (
    <div
      className="fixed inset-0 bg-black text-white select-none overflow-hidden"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="absolute top-0 left-0 right-0 z-20 flex h-1">
        {DECK_SLIDES.map((s) => (
          <button
            key={s.n}
            onClick={() => go(s.n)}
            aria-label={`Slide ${s.n} — ${s.title}`}
            className={
              'flex-1 h-full transition-colors ' +
              (s.n < idx
                ? 'bg-white/70'
                : s.n === idx
                  ? 'bg-white'
                  : 'bg-white/15 hover:bg-white/30')
            }
          />
        ))}
      </div>

      <div className="absolute top-6 left-6 z-20 text-[12px] uppercase tracking-[0.18em] text-white/60">
        General Market
      </div>

      <div className="absolute top-6 right-6 z-20 flex items-center gap-4 text-[13px]">
        <span className="text-white/60">{slide.title}</span>
        <span className="font-mono tabular-nums text-white">
          {String(idx).padStart(2, '0')}
          <span className="text-white/40"> / {String(DECK_TOTAL).padStart(2, '0')}</span>
        </span>
        <div className="relative">
          <button
            onClick={() => setShowMenu((v) => !v)}
            className="rounded-full border border-white/20 hover:border-white/40 px-3 py-1 text-[12px] text-white/80 hover:text-white transition-colors"
          >
            Download
          </button>
          {showMenu && (
            <div
              className="absolute right-0 mt-2 w-56 rounded-xl border border-white/15 bg-neutral-950/95 backdrop-blur-md p-2 shadow-2xl"
              onMouseLeave={() => setShowMenu(false)}
            >
              <a
                href="/pitchdeck/pitch.mp4"
                download
                className="block px-3 py-2 rounded-lg text-[13px] hover:bg-white/10 transition-colors"
              >
                <div className="font-medium">Full deck (MP4)</div>
                <div className="text-[11px] text-white/50">54 seconds, with animations</div>
              </a>
              <a
                href="/pitchdeck/pitch.pdf"
                download
                className="block px-3 py-2 rounded-lg text-[13px] hover:bg-white/10 transition-colors"
              >
                <div className="font-medium">Static slides (PDF)</div>
                <div className="text-[11px] text-white/50">10 pages, no animation</div>
              </a>
            </div>
          )}
        </div>
      </div>

      <div className="absolute inset-0 flex items-center justify-center px-12 md:px-24 pt-4 pb-12">
        <video
          ref={videoRef}
          key={slide.n}
          src={slide.mp4}
          poster={slide.poster}
          autoPlay
          muted
          playsInline
          preload="auto"
          className="max-w-full max-h-full w-auto h-auto rounded-md shadow-2xl"
        />
      </div>

      <button
        onClick={() => go(idx - 1)}
        disabled={idx === 1}
        aria-label="Previous slide"
        className="absolute left-2 md:left-6 top-1/2 -translate-y-1/2 z-10 w-12 h-12 rounded-full bg-white/5 hover:bg-white/15 text-white/70 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>

      <button
        onClick={() => go(idx + 1)}
        disabled={idx === DECK_TOTAL}
        aria-label="Next slide"
        className="absolute right-2 md:right-6 top-1/2 -translate-y-1/2 z-10 w-12 h-12 rounded-full bg-white/5 hover:bg-white/15 text-white/70 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 text-[11px] text-white/40 font-mono">
        ← → space to navigate
      </div>
    </div>
  )
}
