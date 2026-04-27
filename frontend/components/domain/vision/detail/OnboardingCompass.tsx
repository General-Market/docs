'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { OnboardingState, OnboardingStep } from '@/hooks/useOnboarding'

const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1]

interface StepDef {
  id: OnboardingStep
  number: number
  title: string
  description: string
  action: string
  /** CSS selector for the on-page element this step points at, if any. */
  target?: string
}

const STEP_DEFS: StepDef[] = [
  {
    id: 'wallet',
    number: 1,
    title: 'Connect Wallet',
    description: 'Install MetaMask if needed, then connect to the Index network.',
    action: 'CONNECT WALLET',
  },
  {
    id: 'faucet',
    number: 2,
    title: 'Claim Test Funds',
    description: '1,000 USDC + gas. One click. Enough to start.',
    action: 'CLAIM FAUCET',
  },
  {
    id: 'vault',
    number: 3,
    title: 'Join a Vault',
    description: 'Deposit into a vault. Your money trades automatically.',
    action: 'GO TO VAULTS',
    target: '[data-onboarding-target="vault"]',
  },
  {
    id: 'bot',
    number: 4,
    title: 'Deploy Your Bot',
    description: 'Go further. Build your own strategy with AI.',
    action: 'DEPLOY BOT',
  },
]

/* ─────────────────────────────────────────────
   CompassPointer — viewport-edge arrow that
   jumps to the target when it enters the screen.
   ───────────────────────────────────────────── */

interface CompassPointerProps {
  selector: string
}

interface ViewportInfo {
  vw: number
  vh: number
}

function CompassPointer({ selector }: CompassPointerProps) {
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [vp, setVp] = useState<ViewportInfo | null>(null)

  useEffect(() => {
    let raf = 0
    let lastEl: Element | null = null

    const tick = () => {
      raf = 0
      const el = document.querySelector(selector)
      if (!el) {
        setRect(null)
        lastEl = null
        return
      }
      lastEl = el
      const r = el.getBoundingClientRect()
      setRect(r)
      setVp({ vw: window.innerWidth, vh: window.innerHeight })
    }

    const schedule = () => {
      if (raf) return
      raf = requestAnimationFrame(tick)
    }

    schedule()

    const ro = new ResizeObserver(schedule)
    ro.observe(document.documentElement)
    if (lastEl) ro.observe(lastEl)

    // Re-poll occasionally — target may mount after first render.
    const poll = window.setInterval(() => {
      const el = document.querySelector(selector)
      if (el && el !== lastEl) {
        lastEl = el
        ro.observe(el)
      }
      schedule()
    }, 500)

    window.addEventListener('scroll', schedule, true)
    window.addEventListener('resize', schedule)

    return () => {
      if (raf) cancelAnimationFrame(raf)
      ro.disconnect()
      window.clearInterval(poll)
      window.removeEventListener('scroll', schedule, true)
      window.removeEventListener('resize', schedule)
    }
  }, [selector])

  if (!rect || !vp) return null

  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2

  // Any portion of the target inside the viewport counts as on-screen.
  const onScreen =
    rect.bottom > 0 && rect.top < vp.vh && rect.right > 0 && rect.left < vp.vw

  if (onScreen) {
    // Floating arrow above the target's top edge, bouncing down at it.
    const top = Math.max(8, rect.top - 12)
    const left = Math.min(Math.max(cx, 24), vp.vw - 24)
    return (
      <motion.div
        key="on"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.8 }}
        transition={{ duration: 0.35, ease: EASE_OUT_EXPO }}
        className="fixed pointer-events-none z-[60]"
        style={{ left, top, transform: 'translate(-50%, -100%)' }}
      >
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
          className="flex flex-col items-center"
        >
          <div className="px-2.5 py-1 mb-1 bg-white text-black text-[10px] font-black tracking-[0.06em] shadow-[0_4px_16px_rgba(0,0,0,0.35)] whitespace-nowrap">
            LOOK HERE
          </div>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="drop-shadow-[0_2px_6px_rgba(0,0,0,0.4)]">
            <path d="M12 4 L12 18 M5 12 L12 19 L19 12" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </motion.div>
      </motion.div>
    )
  }

  // Off-screen — project the line from viewport center to target center onto
  // the viewport rectangle, with a margin so the arrow stays clear of edges
  // and corner UI (the compass widget itself).
  const margin = 56
  const screenCx = vp.vw / 2
  const screenCy = vp.vh / 2

  const dx = cx - screenCx
  const dy = cy - screenCy
  const halfW = Math.max(vp.vw / 2 - margin, 1)
  const halfH = Math.max(vp.vh / 2 - margin, 1)

  let edgeX = 0
  let edgeY = 0
  if (Math.abs(dy) * halfW > Math.abs(dx) * halfH) {
    // Hits top/bottom edge first.
    edgeY = dy > 0 ? halfH : -halfH
    edgeX = dy === 0 ? 0 : (dx * halfH) / Math.abs(dy)
  } else {
    edgeX = dx > 0 ? halfW : -halfW
    edgeY = dx === 0 ? 0 : (dy * halfW) / Math.abs(dx)
  }

  const angleRad = Math.atan2(dy, dx)
  // Arrow SVG points to the right by default; rotate by angleRad.
  const angleDeg = (angleRad * 180) / Math.PI

  // Avoid camping right on top of the bottom-right widget (~bottom-4 right-4
  // 280-wide). Push arrow up if it lands inside that box.
  const widgetTop = vp.vh - 200
  const widgetLeft = vp.vw - 320
  let posX = screenCx + edgeX
  let posY = screenCy + edgeY
  if (posX > widgetLeft && posY > widgetTop) {
    posY = widgetTop - 8
  }

  return (
    <motion.div
      key="off"
      initial={{ opacity: 0, scale: 0.7 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.7 }}
      transition={{ duration: 0.35, ease: EASE_OUT_EXPO }}
      className="fixed pointer-events-none z-[60]"
      style={{ left: posX, top: posY, transform: 'translate(-50%, -50%)' }}
    >
      <motion.div
        animate={{ scale: [1, 1.18, 1] }}
        transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
        style={{ transform: `rotate(${angleDeg}deg)` }}
        className="flex items-center justify-center w-11 h-11 rounded-full bg-white text-black shadow-[0_6px_24px_rgba(0,0,0,0.45)]"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M4 12 L20 12 M13 5 L20 12 L13 19" stroke="black" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </motion.div>
    </motion.div>
  )
}

/* ─────────────────────────────────────────────
   OnboardingCompass — corner checklist widget
   ───────────────────────────────────────────── */

interface OnboardingCompassProps {
  state: OnboardingState
  onVaultDeposit: () => void
  onBotDeploy: () => void
}

export function OnboardingCompass({ state, onVaultDeposit, onBotDeploy }: OnboardingCompassProps) {
  const [collapsed, setCollapsed] = useState(false)

  const handleAction = useCallback(() => {
    switch (state.currentStep) {
      case 'wallet':
        state.connectWallet()
        break
      case 'faucet':
        state.claimFaucet()
        break
      case 'vault':
        onVaultDeposit()
        break
      case 'bot':
        onBotDeploy()
        break
    }
  }, [state, onVaultDeposit, onBotDeploy])

  if (!state.isActive) return null

  const currentDef = STEP_DEFS.find(s => s.id === state.currentStep)!
  const pointerSelector = currentDef.target

  return (
    <>
      {pointerSelector && (
        <AnimatePresence>
          <CompassPointer key={pointerSelector} selector={pointerSelector} />
        </AnimatePresence>
      )}

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        transition={{ duration: 0.5, ease: EASE_OUT_EXPO }}
        className={[
          'fixed z-50',
          // Mobile: full width minus side margins, anchored bottom.
          'left-3 right-3 bottom-3',
          // Desktop: collapse to a fixed-width card in the bottom-right.
          'sm:left-auto sm:right-4 sm:bottom-4 sm:w-[300px]',
        ].join(' ')}
      >
        <div className="relative bg-terminal-dark border border-white/[0.1] shadow-[0_12px_40px_rgba(0,0,0,0.5)] overflow-hidden">
          {/* Progress bar */}
          <div className="h-[2px] bg-white/[0.04]">
            <motion.div
              className="h-full bg-white/70"
              initial={{ width: 0 }}
              animate={{ width: `${(state.stepIndex / state.totalSteps) * 100}%` }}
              transition={{ duration: 0.6, ease: EASE_OUT_EXPO }}
            />
          </div>

          {/* Header strip */}
          <div className="flex items-center justify-between px-3.5 py-2 border-b border-white/[0.06]">
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-bold tracking-[0.16em] text-white/40 uppercase">
                Tutorial
              </span>
              <span className="text-[9px] font-mono text-white/25">
                {state.stepIndex + 1}/{state.totalSteps}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCollapsed(c => !c)}
                className="text-[9px] font-bold tracking-[0.06em] text-white/30 hover:text-white/70 transition-colors"
                aria-label={collapsed ? 'Expand tutorial' : 'Hide tutorial'}
              >
                {collapsed ? 'OPEN' : 'HIDE'}
              </button>
              <button
                onClick={state.dismiss}
                className="text-[9px] font-bold tracking-[0.06em] text-white/30 hover:text-white/70 transition-colors"
                aria-label="Dismiss tutorial"
              >
                CLOSE
              </button>
            </div>
          </div>

          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.div
                key="body"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3, ease: EASE_OUT_EXPO }}
              >
                {/* Checklist */}
                <ul className="px-3.5 pt-3 pb-1 space-y-1.5">
                  {STEP_DEFS.map((def) => {
                    const isDone = state.completed[def.id]
                    const isCurrent = state.currentStep === def.id
                    return (
                      <li
                        key={def.id}
                        className={[
                          'flex items-center gap-2 text-[11px] font-bold tracking-[0.02em] transition-colors',
                          isDone
                            ? 'text-white/45 line-through decoration-white/20'
                            : isCurrent
                              ? 'text-white'
                              : 'text-white/30',
                        ].join(' ')}
                      >
                        <span
                          className={[
                            'inline-flex items-center justify-center w-4 h-4 shrink-0 text-[9px] font-mono',
                            isDone
                              ? 'bg-emerald-400/15 text-emerald-300'
                              : isCurrent
                                ? 'bg-white/15 text-white'
                                : 'bg-white/[0.04] text-white/30',
                          ].join(' ')}
                        >
                          {isDone ? (
                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                          ) : (
                            def.number
                          )}
                        </span>
                        <span className="truncate">{def.title}</span>
                      </li>
                    )
                  })}
                </ul>

                {/* Current step detail + CTA */}
                <div className="px-3.5 pt-2 pb-3.5 space-y-2.5">
                  <p className="text-[11px] text-white/45 leading-snug">
                    {currentDef.description}
                  </p>
                  <button
                    onClick={handleAction}
                    disabled={state.currentStep === 'faucet' && state.faucetLoading}
                    className="w-full px-3 py-2.5 bg-white text-black text-[11px] font-black tracking-[0.06em] hover:bg-white/90 active:bg-white/80 transition-colors disabled:opacity-50 disabled:cursor-wait"
                  >
                    {state.currentStep === 'faucet' && state.faucetLoading
                      ? 'CLAIMING…'
                      : currentDef.action}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </>
  )
}
