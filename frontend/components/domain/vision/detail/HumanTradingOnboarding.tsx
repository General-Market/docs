'use client'

import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// ── Apple tokens ─────────────────────────────────────────────────────────────

const APPLE_BLUE = '#0071E3'
const APPLE_BLUE_DEEP = '#0066CC'
const APPLE_GREEN = '#28CD41'
const APPLE_RED = '#FF3B30'
const APPLE_AMBER = '#F5A623'
const APPLE_TEXT = '#1D1D1F'
const APPLE_TEXT_SECONDARY = '#86868B'
const APPLE_BG = '#FBFBFD'
const APPLE_PANEL = '#FFFFFF'
const APPLE_CHIP_BG = '#F5F5F7'
const APPLE_LINE = 'rgba(0,0,0,0.06)'
const EASE_OUT = [0.25, 0.1, 0.3, 1] as const
const EASE_DEFAULT = [0.4, 0, 0.6, 1] as const
const FONT_DISPLAY = 'var(--apple-font-display), "SF Pro Display", -apple-system, BlinkMacSystemFont, "Inter", "Helvetica Neue", Arial, sans-serif'
const FONT_TEXT = 'var(--apple-font-text), "SF Pro Text", -apple-system, BlinkMacSystemFont, "Inter", "Helvetica Neue", Arial, sans-serif'

// ── Steps ────────────────────────────────────────────────────────────────────

export type HumanStepId =
  | 'connect'
  | 'fund'
  | 'pick'
  | 'stake'
  | 'lock'
  | 'committed'
  | 'done'

interface StepDef {
  id: HumanStepId
  title: string
  body: string
  cta: string
  targets?: string[]
  nearestOf?: string
}

const STEPS: readonly StepDef[] = [
  {
    id: 'connect',
    title: 'Connect your wallet',
    body: 'You’ll trade from this address. Sealed bets — nobody sees the picks but you.',
    cta: 'Connect wallet',
    targets: [
      '[data-onboarding-target="connect-wallet"]',
      '[data-onboarding-target="wallet-connect"]',
    ],
  },
  {
    id: 'fund',
    title: 'Claim test funds',
    body: 'One drop. 1 000 USDC plus a sip of GM gas. Enough to play.',
    cta: 'Claim funds',
    targets: ['[data-onboarding-target="wallet-balance"]'],
  },
  {
    id: 'pick',
    title: 'Pick UP or DOWN',
    body: 'For each market in the round. The arrow keeps you near the closest one.',
    cta: 'Find the markets',
    nearestOf: '[data-onboarding-target="market-card"]',
  },
  {
    id: 'stake',
    title: 'Set your stake',
    body: 'Split across every pick. $10 on a 7-market round is $1.43 each.',
    cta: 'Open the stake',
    targets: ['[data-onboarding-target="stake-row"]'],
  },
  {
    id: 'lock',
    title: 'Lock it in',
    body: 'Validate to seal the bets on-chain. Reveal happens when the round closes.',
    cta: 'Validate picks',
    targets: ['[data-onboarding-target="validate-button"]'],
  },
] as const

// ── State derivation ─────────────────────────────────────────────────────────

export interface HumanTradingOnboardingProps {
  /** Wallet status for step gating. */
  isConnected: boolean
  /** USDC + GM balance state — when both are non-zero we count funding as done. */
  hasFunds: boolean
  /** Number of UP/DOWN picks the user has committed to in the local picks map. */
  picksCount: number
  /** Total tradable markets in the active batch (e.g. 7 for defillama-bridges). */
  marketCount: number
  /** Whether the user has hit Validate at least once for this round. */
  isCommitted: boolean
  /** Whether a pending approve/commit/publish is in flight. */
  isProcessing: boolean
  /** Round is open and the user can still pick / lock in. */
  isBettingOpen: boolean
  /** Stable source id — used as the persistence namespace. */
  sourceId: string
}

function deriveStep(p: HumanTradingOnboardingProps): HumanStepId {
  if (p.isCommitted) return 'committed'
  if (p.isProcessing) return 'lock'
  if (!p.isConnected) return 'connect'
  if (!p.hasFunds) return 'fund'
  // Treat picks as the next checkpoint until every market is chosen
  if (p.marketCount > 0 && p.picksCount < p.marketCount) return 'pick'
  // All picked but round closed — let the user wait
  if (!p.isBettingOpen) return 'pick'
  return 'lock'
}

// ── Pointer that follows DOM targets ─────────────────────────────────────────

interface PointerProps {
  selectors?: readonly string[]
  nearestOf?: string
}

function pickFirstVisible(selectors: readonly string[]): Element | null {
  if (typeof document === 'undefined') return null
  for (const sel of selectors) {
    const matches = document.querySelectorAll(sel)
    for (const el of matches) {
      const r = el.getBoundingClientRect()
      if (r.width > 0 && r.height > 0) return el
    }
  }
  return null
}

function pickRotating(selector: string, rotateMs = 1500): Element | null {
  if (typeof document === 'undefined' || typeof window === 'undefined') return null
  const all = Array.from(document.querySelectorAll(selector))
  if (all.length === 0) return null
  const vw = window.innerWidth
  const vh = window.innerHeight
  const visible: Element[] = []
  for (const el of all) {
    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) continue
    if (r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw) visible.push(el)
  }
  if (visible.length === 0) return all[0] ?? null
  const idx = Math.floor(Date.now() / rotateMs) % visible.length
  return visible[idx]
}

function Pointer({ selectors, nearestOf }: PointerProps) {
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [vp, setVp] = useState<{ vw: number; vh: number } | null>(null)

  useEffect(() => {
    let raf = 0
    let observed: Element | null = null
    const ro = new ResizeObserver(() => schedule())

    const tick = () => {
      raf = 0
      const el = nearestOf
        ? pickRotating(nearestOf)
        : selectors && selectors.length > 0
          ? pickFirstVisible(selectors)
          : null
      if (!el) {
        setRect(null)
        if (observed) { ro.unobserve(observed); observed = null }
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

    const schedule = () => { if (!raf) raf = requestAnimationFrame(tick) }
    schedule()
    ro.observe(document.documentElement)
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
  }, [selectors?.join('|') ?? '', nearestOf ?? ''])

  if (!rect || !vp) return null

  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2
  const onScreen = rect.bottom > 0 && rect.top < vp.vh && rect.right > 0 && rect.left < vp.vw

  let posX: number, posY: number
  if (onScreen) {
    posX = Math.min(Math.max(cx, 28), vp.vw - 28)
    posY = Math.max(rect.top - 30, 28)
  } else {
    // Project the target direction onto the viewport edge
    const margin = 56
    const screenCx = vp.vw / 2
    const screenCy = vp.vh / 2
    const dx = cx - screenCx
    const dy = cy - screenCy
    const halfW = vp.vw / 2 - margin
    const halfH = vp.vh / 2 - margin
    let edgeX = 0, edgeY = 0
    if (Math.abs(dy) * halfW > Math.abs(dx) * halfH) {
      edgeY = dy > 0 ? halfH : -halfH
      edgeX = dy === 0 ? 0 : (dx * halfH) / Math.abs(dy)
    } else {
      edgeX = dx > 0 ? halfW : -halfW
      edgeY = dx === 0 ? 0 : (dy * halfW) / Math.abs(dx)
    }
    posX = screenCx + edgeX
    posY = screenCy + edgeY
  }

  const angleDeg = (Math.atan2(cy - posY, cx - posX) * 180) / Math.PI
  const dist = Math.hypot(cx - posX, cy - posY)
  const isNarrow = vp.vw < 480

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, x: posX, y: posY }}
      exit={{ opacity: 0 }}
      transition={{
        opacity: { duration: 0.32, ease: EASE_OUT },
        x: { type: 'spring', stiffness: 220, damping: 26, mass: 0.7 },
        y: { type: 'spring', stiffness: 220, damping: 26, mass: 0.7 },
      }}
      className="fixed left-0 top-0 z-[60] pointer-events-none"
    >
      <div style={{ transform: 'translate(-50%, -50%)' }}>
        <div
          style={{
            transform: `rotate(${angleDeg}deg)`,
            transition: `transform 280ms cubic-bezier(0.25, 0.1, 0.3, 1)`,
          }}
        >
          <motion.div
            animate={{ scale: [1, 1.08, 1] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
            style={{
              width: isNarrow ? 36 : 42,
              height: isNarrow ? 36 : 42,
              borderRadius: '50%',
              background: APPLE_PANEL,
              boxShadow: '0 8px 28px rgba(0,113,227,0.32), 0 2px 6px rgba(0,0,0,0.06)',
              border: `1.5px solid ${APPLE_BLUE}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width={isNarrow ? 16 : 18} height={isNarrow ? 16 : 18} viewBox="0 0 24 24" fill="none">
              <path
                d="M5 12 L19 12 M13 6 L19 12 L13 18"
                stroke={APPLE_BLUE}
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </motion.div>
        </div>
      </div>
      {/* Distance debug — sanity check that pointer is alive without polluting UI */}
      {process.env.NODE_ENV === 'development' && dist < 0 ? null : null}
    </motion.div>
  )
}

// ── Per-step demo animations ─────────────────────────────────────────────────

function ConnectAnim() {
  return (
    <svg width="120" height="64" viewBox="0 0 120 64" fill="none">
      {/* Wallet body */}
      <rect x="14" y="22" width="58" height="28" rx="6" fill="#EAF4FE" stroke={APPLE_BLUE} strokeWidth="1.5" />
      <rect x="14" y="28" width="58" height="3" fill={APPLE_BLUE} opacity="0.18" />
      <circle cx="64" cy="38" r="3" fill={APPLE_BLUE} />
      {/* Cable + plug */}
      <motion.g
        initial={{ x: 26 }}
        animate={{ x: [26, 0, 0, 26] }}
        transition={{ duration: 2.6, repeat: Infinity, times: [0, 0.45, 0.8, 1], ease: EASE_OUT }}
      >
        <path d="M76 38 H102" stroke={APPLE_TEXT_SECONDARY} strokeWidth="1.5" strokeLinecap="round" />
        <rect x="98" y="34" width="8" height="8" rx="1.5" fill={APPLE_TEXT} />
      </motion.g>
      {/* Spark when plugged in */}
      <motion.g
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: [0, 1, 1, 0], scale: [0.6, 1.1, 1, 0.6] }}
        transition={{ duration: 2.6, repeat: Infinity, times: [0.4, 0.5, 0.75, 0.85], ease: EASE_OUT }}
      >
        <circle cx="76" cy="38" r="6" fill={APPLE_BLUE} opacity="0.18" />
        <circle cx="76" cy="38" r="3" fill={APPLE_BLUE} />
      </motion.g>
    </svg>
  )
}

function FundAnim() {
  return (
    <svg width="120" height="64" viewBox="0 0 120 64" fill="none">
      {/* Tap */}
      <path d="M44 6 H82 V14 H66 V22" stroke={APPLE_TEXT} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="40" y="2" width="46" height="6" rx="1.5" fill={APPLE_TEXT} />
      {/* Coins falling, staggered */}
      {[0, 0.5, 1.0].map((delay, i) => (
        <motion.g
          key={i}
          initial={{ y: 0, opacity: 0 }}
          animate={{ y: [0, 26, 30], opacity: [0, 1, 0] }}
          transition={{ duration: 1.4, delay, repeat: Infinity, ease: [0.6, 0, 0.7, 1] }}
        >
          <circle cx="66" cy="24" r="5.5" fill={APPLE_BLUE} />
          <text x="66" y="27" textAnchor="middle" fontSize="7" fontFamily={FONT_TEXT} fontWeight="700" fill="#fff">$</text>
        </motion.g>
      ))}
      {/* Receiver bowl */}
      <path d="M50 52 Q66 60 82 52" stroke={APPLE_TEXT} strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M50 52 V46" stroke={APPLE_TEXT} strokeWidth="2" strokeLinecap="round" />
      <path d="M82 52 V46" stroke={APPLE_TEXT} strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function PickAnim() {
  return (
    <svg width="120" height="64" viewBox="0 0 120 64" fill="none">
      {/* UP chip */}
      <motion.g
        animate={{ opacity: [1, 1, 0.32, 0.32, 1], scale: [1.05, 1.05, 1, 1, 1.05] }}
        transition={{ duration: 2.8, repeat: Infinity, times: [0, 0.45, 0.55, 0.95, 1], ease: 'easeInOut' }}
        style={{ originX: '0.25', originY: '0.5' }}
      >
        <rect x="12" y="18" width="42" height="28" rx="6" fill="#E8F7EA" stroke={APPLE_GREEN} strokeWidth="1.5" />
        <path d="M33 38 L33 24 M27 30 L33 24 L39 30" stroke={APPLE_GREEN} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        <text x="33" y="56" textAnchor="middle" fontSize="9" fontFamily={FONT_TEXT} fontWeight="600" fill={APPLE_GREEN} letterSpacing="0.5">UP</text>
      </motion.g>
      {/* DOWN chip */}
      <motion.g
        animate={{ opacity: [0.32, 0.32, 1, 1, 0.32], scale: [1, 1, 1.05, 1.05, 1] }}
        transition={{ duration: 2.8, repeat: Infinity, times: [0, 0.45, 0.55, 0.95, 1], ease: 'easeInOut' }}
        style={{ originX: '0.75', originY: '0.5' }}
      >
        <rect x="66" y="18" width="42" height="28" rx="6" fill="#FDECEB" stroke={APPLE_RED} strokeWidth="1.5" />
        <path d="M87 24 L87 38 M81 32 L87 38 L93 32" stroke={APPLE_RED} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        <text x="87" y="56" textAnchor="middle" fontSize="9" fontFamily={FONT_TEXT} fontWeight="600" fill={APPLE_RED} letterSpacing="0.5">DOWN</text>
      </motion.g>
    </svg>
  )
}

function StakeAnim() {
  const values = [1, 5, 10, 25, 50]
  const [activeIdx, setActiveIdx] = useState(2)
  useEffect(() => {
    const id = window.setInterval(() => setActiveIdx(i => (i + 1) % values.length), 700)
    return () => window.clearInterval(id)
  }, [])
  return (
    <div className="flex items-center justify-center gap-1.5" style={{ height: 64 }}>
      {values.map((v, i) => {
        const active = i === activeIdx
        return (
          <motion.div
            key={v}
            animate={{ scale: active ? 1.12 : 0.96 }}
            transition={{ duration: 0.35, ease: EASE_OUT }}
            style={{
              padding: '5px 11px',
              borderRadius: 980,
              background: active ? APPLE_BLUE : APPLE_PANEL,
              color: active ? '#FFFFFF' : APPLE_TEXT_SECONDARY,
              fontFamily: FONT_TEXT,
              fontSize: 12,
              fontWeight: 500,
              letterSpacing: '-0.016em',
              border: `1px solid ${active ? APPLE_BLUE : APPLE_LINE}`,
              boxShadow: active ? '0 4px 14px rgba(0,113,227,0.32)' : 'none',
              transition: `background 300ms ${EASE_DEFAULT[0]} ${EASE_DEFAULT[1]} ${EASE_DEFAULT[2]} ${EASE_DEFAULT[3]}`,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            ${v}
          </motion.div>
        )
      })}
    </div>
  )
}

function LockAnim() {
  return (
    <svg width="120" height="64" viewBox="0 0 120 64" fill="none">
      {/* Lock body */}
      <rect x="48" y="28" width="24" height="22" rx="3" fill="#EAF4FE" stroke={APPLE_BLUE} strokeWidth="1.5" />
      {/* Hasp opens & closes */}
      <motion.path
        d="M52 28 V22 Q52 14 60 14 Q68 14 68 22 V28"
        stroke={APPLE_BLUE}
        strokeWidth="1.8"
        fill="none"
        strokeLinecap="round"
        animate={{ y: [0, -2, -2, 0] }}
        transition={{ duration: 2.4, repeat: Infinity, times: [0, 0.4, 0.7, 1], ease: EASE_OUT }}
      />
      {/* Keyhole */}
      <circle cx="60" cy="37" r="2" fill={APPLE_BLUE} />
      <rect x="59" y="37" width="2" height="6" fill={APPLE_BLUE} />
      {/* Checkmark appears when locked */}
      <motion.g
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0, 1, 1, 0] }}
        transition={{ duration: 2.4, repeat: Infinity, times: [0, 0.45, 0.55, 0.85, 1], ease: 'easeInOut' }}
      >
        <circle cx="92" cy="32" r="11" fill={APPLE_GREEN} />
        <path d="M86.5 32.5 L91 37 L98 28" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </motion.g>
    </svg>
  )
}

function CommittedAnim() {
  return (
    <svg width="120" height="64" viewBox="0 0 120 64" fill="none">
      <motion.g
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: EASE_OUT }}
      >
        <circle cx="60" cy="32" r="22" fill={APPLE_GREEN} />
        <path d="M48 32 L56 40 L72 24" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </motion.g>
      {/* Soft rings */}
      <motion.circle
        cx="60"
        cy="32"
        r="22"
        stroke={APPLE_GREEN}
        strokeWidth="1.5"
        fill="none"
        opacity="0.4"
        animate={{ scale: [1, 1.5, 1.5], opacity: [0.4, 0, 0] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
        style={{ originX: '60px', originY: '32px' }}
      />
    </svg>
  )
}

const ANIM_BY_STEP: Record<HumanStepId, () => ReactElement> = {
  connect: ConnectAnim,
  fund: FundAnim,
  pick: PickAnim,
  stake: StakeAnim,
  lock: LockAnim,
  committed: CommittedAnim,
  done: CommittedAnim,
}

// ── Progress dots ────────────────────────────────────────────────────────────

function ProgressDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: total }).map((_, i) => {
        const state = i < current ? 'done' : i === current ? 'active' : 'pending'
        return (
          <motion.span
            key={i}
            animate={{ width: state === 'active' ? 16 : 5, opacity: state === 'pending' ? 0.3 : 1 }}
            transition={{ duration: 0.32, ease: EASE_OUT }}
            style={{
              height: 5,
              borderRadius: 999,
              background:
                state === 'done' ? APPLE_BLUE
                : state === 'active' ? APPLE_BLUE
                : APPLE_TEXT_SECONDARY,
              display: 'inline-block',
            }}
          />
        )
      })}
    </div>
  )
}

// ── The widget ───────────────────────────────────────────────────────────────

const DISMISS_KEY = 'human-trading-onboarding:dismissed'

export function HumanTradingOnboarding(props: HumanTradingOnboardingProps) {
  const stepId = useMemo(() => deriveStep(props), [props])
  const stepIndex = useMemo(() => STEPS.findIndex(s => s.id === stepId), [stepId])
  const def = useMemo(() => STEPS.find(s => s.id === stepId) ?? STEPS[0], [stepId])

  // Dismissal — session-scoped per browser. The committed/done state of an
  // active session is informative even after the user closes the panel; the
  // toast at the top of the page already confirms "your bets are sealed".
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem(DISMISS_KEY) === '1'
  })

  const [collapsed, setCollapsed] = useState(false)

  // Re-open when the page-level state regresses (user disconnects wallet, new
  // round opens). Without this the panel stays hidden after a successful first
  // pass through the tutorial — that's fine for the same session, but a fresh
  // tab on a new round should ask whether the user wants the guide again.
  // For now we keep it simple: dismissed sticks until the user clears storage.

  const dismiss = useCallback(() => {
    setDismissed(true)
    try { window.localStorage.setItem(DISMISS_KEY, '1') } catch { /* ignore */ }
  }, [])

  const Anim = ANIM_BY_STEP[stepId]

  // Auto-collapse once committed — the success state is brief and a full
  // panel taking screen real estate after the user finishes feels heavy.
  useEffect(() => {
    if (stepId === 'committed' || stepId === 'done') {
      const t = window.setTimeout(() => setCollapsed(true), 2600)
      return () => window.clearTimeout(t)
    }
  }, [stepId])

  if (dismissed) return null
  if (stepId === 'done') return null

  const isTerminal = stepId === 'committed'
  const pointerSelectors = !isTerminal ? def.targets : undefined
  const pointerNearestOf = !isTerminal ? def.nearestOf : undefined
  const hasPointer = (pointerSelectors?.length ?? 0) > 0 || !!pointerNearestOf

  // STEPS already excludes `committed` — that step is handled separately
  // as the terminal celebration. Don't subtract again here.
  const visibleTotal = STEPS.length
  const visibleCurrent = stepIndex < 0 ? 0 : Math.min(stepIndex, visibleTotal - 1)

  return (
    <>
      {hasPointer && (
        <AnimatePresence>
          <Pointer key={stepId} selectors={pointerSelectors} nearestOf={pointerNearestOf} />
        </AnimatePresence>
      )}

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 12 }}
        transition={{ duration: 0.45, ease: EASE_OUT }}
        style={{
          position: 'fixed',
          bottom: 'max(20px, calc(env(safe-area-inset-bottom) + 14px))',
          right: 'max(16px, calc(env(safe-area-inset-right) + 12px))',
          width: 'min(92vw, 320px)',
          zIndex: 50,
        }}
      >
        <div
          style={{
            background: 'rgba(255,255,255,0.86)',
            backdropFilter: 'saturate(180%) blur(20px)',
            WebkitBackdropFilter: 'saturate(180%) blur(20px)',
            border: `1px solid ${APPLE_LINE}`,
            borderRadius: 18,
            boxShadow: '0 18px 48px rgba(0,0,0,0.12), 0 6px 16px rgba(0,0,0,0.06)',
            overflow: 'hidden',
          }}
        >
          {/* Header strip */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              borderBottom: `1px solid ${APPLE_LINE}`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <ProgressDots current={visibleCurrent} total={visibleTotal} />
              <span
                style={{
                  fontFamily: FONT_TEXT,
                  fontSize: 11,
                  fontWeight: 500,
                  color: APPLE_TEXT_SECONDARY,
                  letterSpacing: '+0.011em',
                  textTransform: 'uppercase',
                }}
              >
                {isTerminal ? 'Locked in' : `Step ${visibleCurrent + 1} of ${visibleTotal}`}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button
                onClick={() => setCollapsed(c => !c)}
                aria-label={collapsed ? 'Expand tutorial' : 'Collapse tutorial'}
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 999,
                  border: 'none',
                  background: 'transparent',
                  color: APPLE_TEXT_SECONDARY,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: `background 200ms ${EASE_DEFAULT[0]} ${EASE_DEFAULT[1]} ${EASE_DEFAULT[2]} ${EASE_DEFAULT[3]}`,
                }}
                onMouseEnter={e => { e.currentTarget.style.background = APPLE_CHIP_BG }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path
                    d={collapsed ? 'M3 4.5 L6 7.5 L9 4.5' : 'M3 7.5 L6 4.5 L9 7.5'}
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              <button
                onClick={dismiss}
                aria-label="Dismiss tutorial"
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 999,
                  border: 'none',
                  background: 'transparent',
                  color: APPLE_TEXT_SECONDARY,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: `background 200ms ${EASE_DEFAULT[0]} ${EASE_DEFAULT[1]} ${EASE_DEFAULT[2]} ${EASE_DEFAULT[3]}`,
                }}
                onMouseEnter={e => { e.currentTarget.style.background = APPLE_CHIP_BG }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
              >
                <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                  <path d="M2 2 L9 9 M9 2 L2 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </div>

          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.div
                key="body"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.32, ease: EASE_OUT }}
                style={{ overflow: 'hidden' }}
              >
                {/* Animated demo */}
                <div
                  style={{
                    height: 84,
                    background: 'linear-gradient(180deg, rgba(248,248,250,0.6) 0%, rgba(245,245,247,1) 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderBottom: `1px solid ${APPLE_LINE}`,
                  }}
                >
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={stepId}
                      initial={{ opacity: 0, scale: 0.92 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.92 }}
                      transition={{ duration: 0.42, ease: EASE_OUT }}
                    >
                      <Anim />
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* Title + body */}
                <div style={{ padding: '14px 16px 10px' }}>
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={`title-${stepId}`}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.32, ease: EASE_OUT }}
                    >
                      <h3
                        style={{
                          fontFamily: FONT_DISPLAY,
                          fontSize: 17,
                          fontWeight: 600,
                          color: APPLE_TEXT,
                          letterSpacing: '-0.016em',
                          lineHeight: 1.25,
                          margin: 0,
                        }}
                      >
                        {isTerminal ? 'Your picks are sealed' : def.title}
                      </h3>
                      <p
                        style={{
                          fontFamily: FONT_TEXT,
                          fontSize: 13,
                          color: APPLE_TEXT_SECONDARY,
                          marginTop: 4,
                          marginBottom: 0,
                          lineHeight: 1.5,
                          letterSpacing: '-0.005em',
                        }}
                      >
                        {isTerminal
                          ? 'Wait for the round to close. The reveal happens on-chain.'
                          : def.body}
                      </p>
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* CTA */}
                {!isTerminal && (
                  <div style={{ padding: '0 16px 16px' }}>
                    <PrimaryButton
                      onClick={() => {
                        // The CTA defers to the in-page target: clicking it
                        // scrolls the user toward the live element rather
                        // than firing the action itself. The Validate / Pick
                        // / Connect buttons on the page are the canonical
                        // affordances; the tutorial just makes them easier
                        // to find.
                        const el = pointerNearestOf
                          ? pickRotating(pointerNearestOf)
                          : pointerSelectors
                            ? pickFirstVisible(pointerSelectors)
                            : null
                        if (el) {
                          el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                        }
                      }}
                      label={def.cta}
                    />
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </>
  )
}

function PrimaryButton({ onClick, label, disabled }: { onClick: () => void; label: string; disabled?: boolean }) {
  const [hover, setHover] = useState(false)
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: 36,
        borderRadius: 980,
        border: 'none',
        background: disabled ? APPLE_CHIP_BG : (hover ? APPLE_BLUE_DEEP : APPLE_BLUE),
        color: disabled ? APPLE_TEXT_SECONDARY : '#FFFFFF',
        fontFamily: FONT_TEXT,
        fontSize: 14,
        fontWeight: 500,
        letterSpacing: '-0.005em',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background 200ms cubic-bezier(0.4, 0, 0.6, 1)',
        boxShadow: disabled ? 'none' : '0 6px 18px rgba(0,113,227,0.28)',
      }}
    >
      {label}
    </button>
  )
}
