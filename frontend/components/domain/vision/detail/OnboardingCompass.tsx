'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence, useDragControls, useMotionValue } from 'framer-motion'
import type { OnboardingState, OnboardingStep } from '@/hooks/useOnboarding'

const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1]

/* Inject the sway keyframes once. Animating amplitude via a CSS variable
   means changing distance (during scroll) doesn't restart the keyframe
   sequence — the needle just swings wider or narrower. */
const SWAY_STYLE_ID = 'compass-sway-style'

function ensureSwayStyles() {
  if (typeof document === 'undefined') return
  if (document.getElementById(SWAY_STYLE_ID)) return
  const style = document.createElement('style')
  style.id = SWAY_STYLE_ID
  style.textContent = `
    @keyframes compass-sway {
      0%   { transform: translateX(calc(var(--sway-amp, 0px) * -1)); }
      50%  { transform: translateX(var(--sway-amp, 0px)); }
      100% { transform: translateX(calc(var(--sway-amp, 0px) * -1)); }
    }
  `
  document.head.appendChild(style)
}

interface StepDef {
  id: OnboardingStep
  number: number
  title: string
  description: string
  action: string
  /**
   * Selector priority list. The pointer locks onto the first selector whose
   * element is in the DOM, so opening a modal/panel with a more specific
   * target re-aims the arrow without a state change.
   */
  targets?: string[]
  /**
   * Multi-match selector. The pointer scans every match and picks the one
   * nearest to the viewport center each tick, so as the user scrolls the
   * arrow always lands on the closest candidate.
   */
  nearestOf?: string
}

const STEP_DEFS: StepDef[] = [
  {
    id: 'select',
    number: 1,
    title: 'Pick a Market',
    description: 'Tap any market to dive in. The arrow follows the closest one.',
    action: 'FIND CLOSEST',
    nearestOf: '[data-onboarding-target="market-card"]',
  },
  {
    id: 'wallet',
    number: 2,
    title: 'Connect Wallet',
    description: 'Install MetaMask if needed, then connect to the Index network.',
    action: 'CONNECT WALLET',
    targets: [
      '[data-onboarding-target="wallet-connect"]',
      '[data-onboarding-target="widget"]',
    ],
  },
  {
    id: 'faucet',
    number: 3,
    title: 'Claim Test Funds',
    description: '1,000 USDC + gas. One click. Enough to start.',
    action: 'CLAIM FAUCET',
    targets: ['[data-onboarding-target="widget"]'],
  },
  {
    id: 'vault',
    number: 4,
    title: 'Join a Vault',
    description: 'Type an amount, then deposit. Your money trades automatically.',
    action: 'GO TO VAULTS',
    targets: [
      '[data-onboarding-target="vault-input"]',
      '[data-onboarding-target="vault-action"]',
      '[data-onboarding-target="vault"]',
    ],
  },
  {
    id: 'bot',
    number: 5,
    title: 'Deploy Your Bot',
    description: 'Go further. Build your own strategy with AI.',
    action: 'DEPLOY BOT',
    targets: ['[data-onboarding-target="widget"]'],
  },
]

/* ─────────────────────────────────────────────
   CompassPointer — single arrow that always
   rotates to point at the active target and
   jumps from viewport edge to over the target
   when it scrolls into view.
   ───────────────────────────────────────────── */

interface CompassPointerProps {
  /** Selector priority list. First match in the DOM wins. */
  selectors?: string[]
  /**
   * Multi-match selector. Every tick, the pointer picks whichever match is
   * closest to the viewport center — used when "the right target" is
   * whatever the user is currently looking at (e.g., the nearest market
   * card on a scrolling grid).
   */
  nearestOf?: string
}

interface ViewportInfo {
  vw: number
  vh: number
}

function pickTarget(selectors: string[]): Element | null {
  // Iterate every match per selector before advancing. The codebase has
  // mobile + desktop copies of the same form sharing target attributes;
  // querySelector (singular) would always return the first DOM match,
  // and on the wrong viewport that copy is display:none with a zero rect.
  // Falling through to the next selector entirely meant the arrow
  // landed on a much weaker target (e.g. a wrapper section) instead of
  // the layout-appropriate copy. querySelectorAll fixes that.
  for (const sel of selectors) {
    const matches = document.querySelectorAll(sel)
    for (const el of matches) {
      const r = el.getBoundingClientRect()
      // Skip zero-size elements — they're hidden / not yet laid out.
      if (r.width > 0 && r.height > 0) return el
    }
  }
  return null
}

function pickNearest(selector: string): Element | null {
  if (typeof document === 'undefined' || typeof window === 'undefined') return null
  const all = Array.from(document.querySelectorAll(selector))
  if (all.length === 0) return null
  const cx = window.innerWidth / 2
  const cy = window.innerHeight / 2
  let best: Element | null = null
  let bestDist = Infinity
  for (const el of all) {
    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) continue
    const ex = r.left + r.width / 2
    const ey = r.top + r.height / 2
    const d = Math.hypot(ex - cx, ey - cy)
    if (d < bestDist) {
      bestDist = d
      best = el
    }
  }
  return best
}

/**
 * Rotation period for {@link pickRotating}. Lives at module scope so the
 * arrow's tick loop and the corner widget's CTA agree on which card is
 * "current" when the click fires.
 */
const ROTATE_PERIOD_MS = 1500

/**
 * Picks one of the visible matches, cycling deterministically through the
 * set every {@link ROTATE_PERIOD_MS}. The arrow's Y position naturally
 * varies as the chosen card changes, so the user reads it as "look around
 * the grid" rather than "stuck on the centered one." Falls back to
 * {@link pickNearest} if nothing is visible (no cards in viewport yet).
 */
function pickRotating(selector: string, rotateMs: number = ROTATE_PERIOD_MS): Element | null {
  if (typeof document === 'undefined' || typeof window === 'undefined') return null
  const all = Array.from(document.querySelectorAll(selector))
  if (all.length === 0) return null
  const vw = window.innerWidth
  const vh = window.innerHeight
  const visible: Element[] = []
  for (const el of all) {
    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) continue
    if (r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw) {
      visible.push(el)
    }
  }
  if (visible.length === 0) return pickNearest(selector)
  const idx = Math.floor(Date.now() / rotateMs) % visible.length
  return visible[idx]
}

/**
 * Bottom edge of the page's sticky header in viewport coordinates. This is
 * the wall the arrow refuses to cross — anything pinned to the top of the
 * page would obscure the bubble otherwise.
 */
function getHeaderBottom(): number {
  if (typeof document === 'undefined') return 0
  const header = document.querySelector('header')
  if (!header) return 0
  // Only respect the header if it's actually pinned to the top right now.
  // (When the page is at the top, the topbar above it gives the header a
  // bigger bottom edge but the arrow can still sit above the page content.)
  const r = header.getBoundingClientRect()
  return r.bottom > 0 && r.top <= 0 ? r.bottom : Math.max(r.bottom, 0)
}

function CompassPointer({ selectors, nearestOf }: CompassPointerProps) {
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [vp, setVp] = useState<ViewportInfo | null>(null)

  useEffect(() => {
    let raf = 0
    let observed: Element | null = null
    const ro = new ResizeObserver(() => schedule())

    const tick = () => {
      raf = 0
      const el = nearestOf
        ? pickRotating(nearestOf)
        : selectors && selectors.length > 0
          ? pickTarget(selectors)
          : null
      if (!el) {
        setRect(null)
        if (observed) {
          ro.unobserve(observed)
          observed = null
        }
        return
      }
      if (el !== observed) {
        if (observed) ro.unobserve(observed)
        ro.observe(el)
        observed = el
      }
      setRect(el.getBoundingClientRect())
      setVp({ vw: window.innerWidth, vh: window.innerHeight })
    }

    const schedule = () => {
      if (raf) return
      raf = requestAnimationFrame(tick)
    }

    schedule()
    ro.observe(document.documentElement)

    // Re-poll occasionally — modals/panels may mount or unmount and we want
    // the selector to re-evaluate without waiting for a scroll event.
    // In rotating (nearestOf) mode we tick faster so the rotation cadence
    // — which switches targets every {@link ROTATE_PERIOD_MS} — feels
    // sharp instead of laggy.
    const poll = window.setInterval(schedule, nearestOf ? 220 : 400)

    window.addEventListener('scroll', schedule, true)
    window.addEventListener('resize', schedule)

    return () => {
      if (raf) cancelAnimationFrame(raf)
      ro.disconnect()
      window.clearInterval(poll)
      window.removeEventListener('scroll', schedule, true)
      window.removeEventListener('resize', schedule)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectors?.join('|') ?? '', nearestOf ?? ''])

  if (!rect || !vp) return null

  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2

  // Any portion of the target inside the viewport counts as on-screen.
  const onScreen =
    rect.bottom > 0 && rect.top < vp.vh && rect.right > 0 && rect.left < vp.vw

  // ── Position the arrow ──
  let posX: number
  let posY: number
  let mode: 'on' | 'off'

  if (onScreen) {
    mode = 'on'
    posX = Math.min(Math.max(cx, 28), vp.vw - 28)
    posY = Math.max(rect.top - 28, 28)
  } else {
    mode = 'off'
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
      edgeY = dy > 0 ? halfH : -halfH
      edgeX = dy === 0 ? 0 : (dx * halfH) / Math.abs(dy)
    } else {
      edgeX = dx > 0 ? halfW : -halfW
      edgeY = dx === 0 ? 0 : (dy * halfW) / Math.abs(dx)
    }
    posX = screenCx + edgeX
    posY = screenCy + edgeY

    // Don't camp on top of the floating widget. Query its actual rect — on
    // mobile it's near full-width, on desktop it's a 300px card. The old
    // hardcoded 220x330 numbers always said "you're inside the widget" on
    // narrow viewports, dragging the arrow up unnecessarily.
    const widgetEl = document.querySelector('[data-onboarding-target="widget"]')
    if (widgetEl) {
      const wr = widgetEl.getBoundingClientRect()
      if (
        posX > wr.left - 12 &&
        posX < wr.right + 12 &&
        posY > wr.top - 12 &&
        posY < wr.bottom + 12
      ) {
        posY = wr.top - 12
      }
    }
  }

  // Bubble drops on narrow viewports. The page is small enough that the
  // rotating arrow alone reads as direction; stacking a label on top of
  // the arrow on a 375-wide screen wastes vertical space and crowds the
  // header.
  const isNarrow = vp.vw < 480
  const bubbleHeight = isNarrow ? 0 : 22
  const bubbleOffset = isNarrow ? 0 : 38

  // Repulsion floor — the page header is a wall. The arrow's center must
  // stay at least (header bottom + arrow radius + bubble height + buffer)
  // below the top of the viewport, so the bubble can sit above the arrow
  // without crossing the header. Spring transition on the position layer
  // (below) makes that boundary read as elastic push, not a hard snap.
  const headerBottom = getHeaderBottom()
  const arrowRadius = isNarrow ? 18 : 22
  const repulsionBuffer = 10
  const minPosY = headerBottom + arrowRadius + bubbleOffset + bubbleHeight + repulsionBuffer
  if (posY < minPosY) posY = minPosY

  // Clamp X so neither the arrow nor the bubble can spill off-screen on
  // narrow viewports.
  const xMargin = arrowRadius + 8
  posX = Math.min(Math.max(posX, xMargin), vp.vw - xMargin)

  // Rotation: angle from arrow position to the actual target center.
  // Recomputed every frame as the user scrolls; the rotation layer below
  // applies a slow ease-out so the arrow trails like a real compass needle.
  const angleRad = Math.atan2(cy - posY, cx - posX)
  const angleDeg = (angleRad * 180) / Math.PI

  // Distance to target. We use this to scale the horizontal sway amplitude:
  // a far target produces wider needle swings, a close target settles down.
  const dist = Math.hypot(cx - posX, cy - posY)
  const swayAmp = Math.min(Math.max(dist / 70, 4), 22)

  // Inject the sway keyframes once.
  ensureSwayStyles()

  return (
    <>
      {/* On-screen bubble — sits 36px above the arrow, never rotates so the
          text stays upright. Dropped on narrow viewports (mobile) and
          while the target is offscreen so the edge cursor reads as
          direction-only. */}
      {mode === 'on' && !isNarrow && (
        <motion.div
          key="bubble"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, x: posX, y: Math.max(posY - 38, 8) }}
          exit={{ opacity: 0 }}
          transition={{
            opacity: { duration: 0.3, ease: EASE_OUT_EXPO },
            x: { type: 'spring', stiffness: 220, damping: 26, mass: 0.7 },
            y: { type: 'spring', stiffness: 220, damping: 26, mass: 0.7 },
          }}
          className="fixed pointer-events-none z-[60] left-0 top-0"
        >
          <div
            className="px-2.5 py-1 bg-white text-black text-[10px] font-black tracking-[0.06em] shadow-[0_4px_16px_rgba(0,0,0,0.35)] whitespace-nowrap"
            style={{ transform: 'translate(-50%, -100%)' }}
          >
            LOOK HERE
          </div>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, x: posX, y: posY }}
        exit={{ opacity: 0 }}
        transition={{
          opacity: { duration: 0.35, ease: EASE_OUT_EXPO },
          x: { type: 'spring', stiffness: 200, damping: 24, mass: 0.8 },
          y: { type: 'spring', stiffness: 200, damping: 24, mass: 0.8 },
        }}
        className="fixed pointer-events-none z-[60] left-0 top-0"
      >
        {/* Center-anchor — the framer x/y translate places this div's
            top-left at (posX, posY); we want its child centered there. */}
        <div style={{ transform: 'translate(-50%, -50%)' }}>
        {/* Sway layer — CSS keyframe animation reads --sway-amp every cycle.
            Updating the variable as distance changes widens/narrows the
            swing without restarting the animation. */}
        <div
          style={{
            ['--sway-amp' as never]: `${swayAmp.toFixed(1)}px`,
            animation: 'compass-sway 2.6s ease-in-out infinite',
            willChange: 'transform',
          }}
        >
          {/* Rotation layer — slow ease-out transition so the needle trails
              the user's scroll instead of snapping. Inline style so it
              composes cleanly with the parent (sway) and child (pulse)
              transforms. */}
          <div
            style={{
              transform: `rotate(${angleDeg}deg)`,
              transition: 'transform 280ms cubic-bezier(0.16, 1, 0.3, 1)',
              willChange: 'transform',
            }}
          >
            {/* Pulse layer — scale only. Smaller circle on narrow screens
                so the arrow doesn't dominate a 375-wide viewport. */}
            <motion.div
              animate={{ scale: mode === 'on' ? [1, 1.1, 1] : [1, 1.16, 1] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
              className={[
                'flex items-center justify-center rounded-full bg-white text-black shadow-[0_6px_24px_rgba(0,0,0,0.45)]',
                isNarrow ? 'w-9 h-9' : 'w-11 h-11',
              ].join(' ')}
            >
              <svg
                width={isNarrow ? 18 : 22}
                height={isNarrow ? 18 : 22}
                viewBox="0 0 24 24"
                fill="none"
              >
                <path
                  d="M4 12 L20 12 M13 5 L20 12 L13 19"
                  stroke="black"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </motion.div>
          </div>
        </div>
        </div>
      </motion.div>
    </>
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

// Drag offsets are session-only — every page load starts the widget at
// its base bottom-left anchor. The earlier "remember where I parked it"
// behavior outlived its usefulness: a single drag could permanently
// strand the card at the top of the viewport on every subsequent visit,
// and users (reasonably) read that as a bug rather than a feature.
//
// Drag itself still works inside a session; reloading resets.

export function OnboardingCompass({ state, onVaultDeposit, onBotDeploy }: OnboardingCompassProps) {
  const [collapsed, setCollapsed] = useState(false)

  // Drag state — offset from the base bottom-left anchor, session-only.
  // Both motion values start at 0 every page load; the user can still
  // drag the widget anywhere they like and clampToViewport keeps it on
  // canvas during the session, but the position resets on reload.
  const dragX = useMotionValue(0)
  const dragY = useMotionValue(0)
  const dragControls = useDragControls()
  const containerRef = useRef<HTMLDivElement>(null)

  const handleAction = useCallback(() => {
    switch (state.currentStep) {
      case 'select': {
        // Commit to whichever card the arrow is currently aimed at. The
        // arrow uses the same rotating picker, so click and pointer agree.
        const el = pickRotating('[data-onboarding-target="market-card"]')
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        break
      }
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

  /**
   * Clamp the current drag offset against the actual rendered rect of the
   * widget so the entire card always fits in the viewport (12 px margin).
   * Runs on drag-end and on viewport resize. The earlier "80 px visible"
   * version produced ugly half-states where only the CTA peeked over the
   * header on a small viewport — now the widget is always fully visible.
   */
  const clampToViewport = useCallback(() => {
    if (typeof window === 'undefined') return false
    const el = containerRef.current
    if (!el) return false
    const rect = el.getBoundingClientRect()
    const margin = 12
    const vw = window.innerWidth
    const vh = window.innerHeight
    let adjX = 0
    let adjY = 0
    if (rect.right > vw - margin) adjX = (vw - margin) - rect.right
    else if (rect.left < margin) adjX = margin - rect.left
    if (rect.bottom > vh - margin) adjY = (vh - margin) - rect.bottom
    else if (rect.top < margin) adjY = margin - rect.top
    if (adjX) dragX.set(dragX.get() + adjX)
    if (adjY) dragY.set(dragY.get() + adjY)
    return !!(adjX || adjY)
  }, [dragX, dragY])

  const handleDragEnd = useCallback(() => {
    clampToViewport()
  }, [clampToViewport])

  // Clamp to viewport on resize and orientation changes so dragging the
  // widget into a corner doesn't strand it when the viewport shrinks.
  // No persistence — drag offsets reset on reload.
  useEffect(() => {
    if (typeof window === 'undefined') return
    let raf = 0
    const run = () => {
      raf = 0
      clampToViewport()
    }
    const schedule = () => {
      if (raf) return
      raf = requestAnimationFrame(run)
    }
    window.addEventListener('resize', schedule)
    window.addEventListener('orientationchange', schedule)
    return () => {
      if (raf) cancelAnimationFrame(raf)
      window.removeEventListener('resize', schedule)
      window.removeEventListener('orientationchange', schedule)
    }
  }, [clampToViewport])

  if (!state.isActive) return null

  const currentDef = STEP_DEFS.find(s => s.id === state.currentStep)!
  const pointerSelectors = currentDef.targets ?? []
  const pointerNearestOf = currentDef.nearestOf
  const hasPointer = pointerSelectors.length > 0 || !!pointerNearestOf
  const ctaDisabled = state.currentStep === 'faucet' && state.faucetLoading

  return (
    <>
      {hasPointer && (
        <AnimatePresence>
          <CompassPointer
            key={state.currentStep}
            selectors={pointerSelectors.length > 0 ? pointerSelectors : undefined}
            nearestOf={pointerNearestOf}
          />
        </AnimatePresence>
      )}

      <motion.div
        ref={containerRef}
        drag
        dragListener={false}
        dragControls={dragControls}
        dragMomentum={false}
        dragElastic={0}
        onDragEnd={handleDragEnd}
        // Entrance is opacity-only. We can't animate y here without
        // colliding with the dragY motion value driving style.y — the
        // animation would briefly snap y to 0 on mount and the saved
        // drag offset wouldn't be honored until the next user interaction.
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.45, ease: EASE_OUT_EXPO }}
        style={{ x: dragX, y: dragY }}
        // The data attribute makes the widget itself a pointer target. For
        // the faucet/bot steps the arrow tracks this element — useful once
        // the user has dragged the widget somewhere unexpected.
        data-onboarding-target="widget"
        className={[
          // Compact card anchored bottom-left; same shape on mobile so the
          // drag affordance is consistent across viewports. Drag offsets
          // (motion x/y) compose with this anchor — the user can still
          // park the widget anywhere they want and the position persists.
          'fixed z-50 w-[min(92vw,300px)]',
          'left-3 bottom-3 sm:left-4 sm:bottom-4',
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

          {/* Header strip — doubles as the drag handle. Pointer-down here
              starts a drag via dragControls; the action buttons further right
              still receive their click events because the drag only engages
              once the pointer actually moves. */}
          <div
            onPointerDown={(e) => dragControls.start(e)}
            className="flex items-center justify-between px-3.5 py-2 border-b border-white/[0.06] cursor-grab active:cursor-grabbing select-none touch-none"
          >
            <div className="flex items-center gap-2 pointer-events-none">
              {/* Drag affordance — six dots, signals the strip is grabbable. */}
              <svg width="10" height="14" viewBox="0 0 10 14" className="text-white/30 shrink-0">
                <circle cx="2" cy="3" r="1" fill="currentColor" />
                <circle cx="8" cy="3" r="1" fill="currentColor" />
                <circle cx="2" cy="7" r="1" fill="currentColor" />
                <circle cx="8" cy="7" r="1" fill="currentColor" />
                <circle cx="2" cy="11" r="1" fill="currentColor" />
                <circle cx="8" cy="11" r="1" fill="currentColor" />
              </svg>
              <span className="text-[9px] font-bold tracking-[0.16em] text-white/40 uppercase">
                Tutorial
              </span>
              <span className="text-[9px] font-mono text-white/25">
                {state.stepIndex + 1}/{state.totalSteps}
              </span>
            </div>
            <div
              className="flex items-center gap-2"
              onPointerDown={(e) => e.stopPropagation()}
            >
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
                  {/* CTA — wrapped in a relative container so the pulsing
                      halo can sit behind it without bleeding into the layout.
                      The pulse is intentionally low-key: a faint expanding
                      ring + a tiny breathing scale. Reads as "alive" without
                      stealing attention from the on-page pointer. */}
                  <div className="relative">
                    {!ctaDisabled && (
                      <motion.span
                        aria-hidden
                        className="absolute inset-0 pointer-events-none bg-white/30"
                        animate={{ opacity: [0.35, 0, 0.35], scale: [1, 1.08, 1] }}
                        transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                      />
                    )}
                    <motion.button
                      onClick={handleAction}
                      disabled={ctaDisabled}
                      animate={ctaDisabled ? { scale: 1 } : { scale: [1, 1.015, 1] }}
                      transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                      className="relative w-full px-3 py-2.5 bg-white text-black text-[11px] font-black tracking-[0.06em] hover:bg-white/90 active:bg-white/80 transition-colors disabled:opacity-50 disabled:cursor-wait"
                    >
                      {state.currentStep === 'faucet' && state.faucetLoading
                        ? 'CLAIMING…'
                        : currentDef.action}
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </>
  )
}
