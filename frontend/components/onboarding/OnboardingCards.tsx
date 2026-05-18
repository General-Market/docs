'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Card1Block } from './Card1Block'
import { Card2Leak } from './Card2Leak'
import { Card3Liquidity } from './Card3Liquidity'

const STORAGE_KEY = 'gm-onboarding-seen-v2'
const TOTAL = 3

export function OnboardingCards() {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)
  const [direction, setDirection] = useState(1)
  const [mounted, setMounted] = useState(false)
  const reduced = useReducedMotion()

  useEffect(() => {
    setMounted(true)
    if (typeof window === 'undefined') return
    try {
      const seen = window.localStorage.getItem(STORAGE_KEY)
      if (!seen) {
        const t = setTimeout(() => setOpen(true), 350)
        return () => clearTimeout(t)
      }
    } catch {
      // localStorage unavailable — skip the tour silently.
    }
  }, [])

  const persistSeen = useCallback(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, new Date().toISOString())
    } catch {
      // ignore
    }
  }, [])

  const dismissPermanent = useCallback(() => {
    persistSeen()
    setOpen(false)
  }, [persistSeen])

  const dismissTemporary = useCallback(() => {
    setOpen(false)
  }, [])

  const next = useCallback(() => {
    setDirection(1)
    setStep((s) => Math.min(s + 1, TOTAL - 1))
  }, [])

  const prev = useCallback(() => {
    setDirection(-1)
    setStep((s) => Math.max(s - 1, 0))
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismissTemporary()
      else if (e.key === 'ArrowRight') {
        if (step === TOTAL - 1) dismissPermanent()
        else next()
      } else if (e.key === 'ArrowLeft') prev()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, step, next, prev, dismissTemporary, dismissPermanent])

  useEffect(() => {
    if (!open) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [open])

  const cards = useMemo(
    () => [
      (active: boolean) => <Card1Block active={active} />,
      (active: boolean) => <Card2Leak active={active} />,
      (active: boolean) => <Card3Liquidity active={active} />,
    ],
    [],
  )

  if (!mounted || typeof document === 'undefined') return null

  const isLast = step === TOTAL - 1

  const node = (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.32, ease: [0.4, 0, 0.2, 1] }}
          className="fixed inset-0 z-[60] overflow-hidden bg-black"
          onClick={dismissTemporary}
        >
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
            className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/55 to-black/75"
            aria-hidden="true"
          />

          <div
            className="relative h-full w-full flex items-center justify-center"
            style={{ padding: 'clamp(16px, 4vw, 40px)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Welcome to General Market"
              initial={reduced ? false : { opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={reduced ? undefined : { opacity: 0, scale: 0.96, y: 12 }}
              transition={{ type: 'spring', stiffness: 260, damping: 28, mass: 1 }}
              className="relative w-full"
              style={{
                maxWidth: 1068,
                maxHeight: 'min(92dvh, 820px)',
                borderRadius: 28,
                border: '1px solid rgba(255,255,255,0.14)',
                backgroundColor: 'rgba(20,20,22,0.55)',
                backdropFilter: 'saturate(180%) blur(28px)',
                WebkitBackdropFilter: 'saturate(180%) blur(28px)',
                boxShadow: '0 40px 100px rgba(0,0,0,0.45), 0 12px 32px rgba(0,0,0,0.25)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <header
                className="flex items-center justify-between px-5 py-4 md:px-6"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
              >
                <div className="flex items-center gap-2">
                  {Array.from({ length: TOTAL }).map((_, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setDirection(i > step ? 1 : -1)
                        setStep(i)
                      }}
                      aria-label={`Go to card ${i + 1}`}
                      className="transition-all"
                      style={{
                        width: i === step ? 22 : 6,
                        height: 6,
                        borderRadius: 999,
                        background:
                          i === step
                            ? 'rgba(255,255,255,0.95)'
                            : i < step
                              ? 'rgba(255,255,255,0.45)'
                              : 'rgba(255,255,255,0.18)',
                        border: 'none',
                        cursor: 'pointer',
                      }}
                    />
                  ))}
                </div>

                <button
                  onClick={dismissPermanent}
                  aria-label="Close onboarding and don't show again"
                  className="flex items-center justify-center transition-colors"
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 999,
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: 'rgba(255,255,255,0.7)',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.12)'
                    e.currentTarget.style.color = 'rgba(255,255,255,0.95)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
                    e.currentTarget.style.color = 'rgba(255,255,255,0.7)'
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </header>

              <div
                className="relative flex-1 overflow-y-auto"
                style={{ minHeight: 'min(72dvh, 600px)' }}
              >
                <AnimatePresence initial={false} mode="wait" custom={direction}>
                  <motion.div
                    key={step}
                    custom={direction}
                    initial={reduced ? false : { opacity: 0, x: direction * 24 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={reduced ? undefined : { opacity: 0, x: -direction * 24 }}
                    transition={{ duration: 0.35, ease: [0.25, 0.1, 0.3, 1] }}
                    drag={reduced ? false : 'x'}
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={0.18}
                    onDragEnd={(_, info) => {
                      const threshold = 80
                      if (info.offset.x < -threshold) {
                        if (isLast) dismissPermanent()
                        else next()
                      } else if (info.offset.x > threshold) prev()
                    }}
                    style={{ touchAction: 'pan-y' }}
                  >
                    {cards[step](open)}
                  </motion.div>
                </AnimatePresence>
              </div>

              <footer
                className="flex items-center justify-between gap-3 px-5 py-4 md:px-6"
                style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}
              >
                <button
                  onClick={prev}
                  disabled={step === 0}
                  style={{
                    fontFamily: 'var(--apple-font-text)',
                    fontSize: 'var(--apple-fs-14)',
                    letterSpacing: 'var(--apple-track-tight)',
                    color: step === 0 ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.85)',
                    background: 'transparent',
                    border: 'none',
                    padding: '10px 14px',
                    borderRadius: 999,
                    cursor: step === 0 ? 'default' : 'pointer',
                  }}
                >
                  Back
                </button>

                <span
                  style={{
                    fontFamily: 'var(--apple-font-text)',
                    fontSize: 'var(--apple-fs-12)',
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    color: 'rgba(255,255,255,0.5)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {step + 1} / {TOTAL}
                </span>

                <button
                  onClick={() => {
                    if (isLast) dismissPermanent()
                    else next()
                  }}
                  style={{
                    fontFamily: 'var(--apple-font-text)',
                    fontSize: 'var(--apple-fs-14)',
                    letterSpacing: 'var(--apple-track-tight)',
                    color: '#fff',
                    background: 'var(--apple-accent)',
                    border: 'none',
                    padding: '10px 22px',
                    borderRadius: 999,
                    cursor: 'pointer',
                    fontWeight: 500,
                  }}
                >
                  {isLast ? 'Got it' : 'Next'}
                </button>
              </footer>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )

  return createPortal(node, document.body)
}
