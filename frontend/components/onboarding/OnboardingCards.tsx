'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { SpringBackdrop, SpringModal, glass, ModalClose } from '@/components/ui/spring'
import { Card1Block } from './Card1Block'
import { Card2Leak } from './Card2Leak'
import { Card3Liquidity } from './Card3Liquidity'

const STORAGE_KEY = 'gm-onboarding-seen-v1'
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
      // localStorage may be unavailable (private mode, etc.) — fail open and skip the tour.
    }
  }, [])

  const close = useCallback(() => {
    setOpen(false)
    try {
      window.localStorage.setItem(STORAGE_KEY, new Date().toISOString())
    } catch {
      // ignore
    }
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
      if (e.key === 'Escape') close()
      else if (e.key === 'ArrowRight') {
        if (step === TOTAL - 1) close()
        else next()
      } else if (e.key === 'ArrowLeft') prev()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, step, next, prev, close])

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

  const node = (
    <AnimatePresence>
      {open && (
        <SpringBackdrop
          className={glass.backdrop}
          onClick={close}
          style={{
            position: 'fixed',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(245, 245, 247, 0.7)',
            zIndex: 60,
            padding: 'clamp(12px, 3vw, 32px)',
          }}
        >
          <SpringModal
            className="relative"
            style={{
              width: '100%',
              maxWidth: 1068,
              maxHeight: 'min(92dvh, 820px)',
              background: 'var(--apple-bg)',
              borderRadius: 28,
              boxShadow: '0 30px 80px rgba(0,0,0,0.18), 0 8px 24px rgba(0,0,0,0.06)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <header
              className="flex items-center justify-between px-5 py-4 md:px-6"
              style={{ borderBottom: '1px solid var(--apple-divider)' }}
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
                          ? 'var(--apple-text)'
                          : i < step
                            ? 'rgba(29,29,31,0.45)'
                            : 'rgba(29,29,31,0.18)',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  />
                ))}
              </div>

              <button
                onClick={close}
                style={{
                  fontFamily: 'var(--apple-font-text)',
                  fontSize: 'var(--apple-fs-14)',
                  color: 'var(--apple-text-secondary)',
                  background: 'transparent',
                  border: 'none',
                  padding: '6px 10px',
                  borderRadius: 999,
                  cursor: 'pointer',
                }}
                onMouseDown={(e) => e.preventDefault()}
              >
                Skip
              </button>
            </header>

            <div className="relative flex-1 overflow-hidden">
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
                      if (step === TOTAL - 1) close()
                      else next()
                    } else if (info.offset.x > threshold) prev()
                  }}
                  className="absolute inset-0 overflow-y-auto"
                  style={{ touchAction: 'pan-y' }}
                >
                  {cards[step](open)}
                </motion.div>
              </AnimatePresence>
            </div>

            <footer
              className="flex items-center justify-between gap-3 px-5 py-4 md:px-6"
              style={{ borderTop: '1px solid var(--apple-divider)' }}
            >
              <button
                onClick={prev}
                disabled={step === 0}
                style={{
                  fontFamily: 'var(--apple-font-text)',
                  fontSize: 'var(--apple-fs-14)',
                  letterSpacing: 'var(--apple-track-tight)',
                  color: step === 0 ? 'rgba(29,29,31,0.25)' : 'var(--apple-text)',
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
                  color: 'var(--apple-text-secondary)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {step + 1} / {TOTAL}
              </span>

              <button
                onClick={() => {
                  if (step === TOTAL - 1) close()
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
                {step === TOTAL - 1 ? 'Done' : 'Next'}
              </button>
            </footer>

            <div className="absolute top-3 right-3 hidden">
              <ModalClose onClick={close} />
            </div>
          </SpringModal>
        </SpringBackdrop>
      )}
    </AnimatePresence>
  )

  return createPortal(node, document.body)
}
