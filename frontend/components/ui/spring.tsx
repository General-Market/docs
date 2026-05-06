'use client'

import {
  motion,
  useReducedMotion,
  useMotionValue,
  useSpring,
  useTransform,
  AnimatePresence,
  type Transition,
  type HTMLMotionProps,
} from 'framer-motion'
import { useRef, useEffect, useState, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'

// ── Apple-style page transition easings ─────────────────────
// apple.com uses cubic-bezier (not spring) for cross-page
// transitions — predictable, brand-consistent. Springs are
// reserved for in-app physics (presses, hover, modals).

const appleEnter = [0.32, 0.72, 0, 1] as const
const appleExit  = [0.4, 0, 0.6, 1] as const

// ── Spring Configs ──────────────────────────────────────────
// Named presets. Every animation in the app pulls from here.
// Adjusting one value adjusts every component that uses it.

export const springs = {
  /** Buttons, toggles — snappy with slight overshoot */
  press: { type: 'spring', stiffness: 400, damping: 25, mass: 0.8 } as const,

  /** Cards, rows — medium response, natural settle */
  hover: { type: 'spring', stiffness: 300, damping: 22, mass: 0.9 } as const,

  /** Modals, drawers — slower, more dramatic entrance */
  entrance: { type: 'spring', stiffness: 260, damping: 28, mass: 1.0 } as const,

  /** Expand/collapse — softer, no overshoot on height */
  expand: { type: 'spring', stiffness: 200, damping: 28, mass: 1.0 } as const,

  /** Tab indicators — fast, precise, slight bounce */
  indicator: { type: 'spring', stiffness: 500, damping: 30, mass: 0.6 } as const,

  /** Financial values — smooth, no overshoot, institutional */
  number: { type: 'spring', stiffness: 80, damping: 20, mass: 0.6 } as const,

  /** Page transitions — gentle, wide entrance */
  page: { type: 'spring', stiffness: 220, damping: 26, mass: 1.0 } as const,
} satisfies Record<string, Transition>


// ── SpringPress ─────────────────────────────────────────────
// Wraps any clickable element. Scales down on press with real
// spring physics — velocity-aware, interruptible.
//
// Usage: <SpringPress><button>Click</button></SpringPress>

type SpringPressProps = Omit<HTMLMotionProps<'div'>, 'whileTap' | 'transition'> & {
  children: ReactNode
  scale?: number
  disabled?: boolean
}

export function SpringPress({ children, className, scale = 0.94, disabled, ...rest }: SpringPressProps) {
  const reduced = useReducedMotion()

  if (reduced || disabled) {
    return <div className={className}>{children}</div>
  }

  return (
    <motion.div
      className={className}
      whileTap={{ scale }}
      transition={springs.press}
      {...rest}
    >
      {children}
    </motion.div>
  )
}


// ── SpringHover ─────────────────────────────────────────────
// Wraps hoverable elements (cards, rows). Lifts on hover with
// shadow depth. Inherits velocity on interruption — rapidly
// hovering in/out produces natural motion, not restarts.
//
// Usage: <SpringHover lift={-3}><Card /></SpringHover>

type SpringHoverProps = Omit<HTMLMotionProps<'div'>, 'whileHover' | 'whileTap' | 'transition'> & {
  children: ReactNode
  lift?: number
  shadow?: boolean
}

export function SpringHover({ children, className, lift = -3, shadow = true, ...rest }: SpringHoverProps) {
  const reduced = useReducedMotion()

  if (reduced) {
    return <div className={className}>{children}</div>
  }

  const hoverState = {
    y: lift,
    ...(shadow ? { boxShadow: '0 8px 24px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.04)' } : {}),
  }

  return (
    <motion.div
      className={className}
      whileHover={hoverState}
      whileTap={{ y: 0 }}
      transition={springs.hover}
      {...rest}
    >
      {children}
    </motion.div>
  )
}


// ── SpringRow ───────────────────────────────────────────────
// Table/list row with inset left border on hover.
// Uses real spring — interrupting a hover-out mid-flight
// produces natural deceleration, not a hard reset.
//
// Usage: <SpringRow onClick={fn}>row content</SpringRow>

type SpringRowProps = Omit<HTMLMotionProps<'div'>, 'whileHover' | 'whileTap' | 'transition'> & {
  children: ReactNode
}

export function SpringRow({ children, className, ...rest }: SpringRowProps) {
  const reduced = useReducedMotion()

  if (reduced) {
    // Strip motion-specific props so a plain <div> receives only valid HTML attributes
    const {
      initial: _, animate: _a, exit: _e, variants: _v, layout: _l,
      layoutId: _li, onAnimationStart: _oas, onAnimationComplete: _oac,
      style: motionStyle, ...htmlProps
    } = rest as Record<string, unknown>
    // Convert MotionStyle to CSSProperties (safe: values are plain in reduced-motion)
    const style = motionStyle as React.CSSProperties | undefined
    return <div className={className} style={style} {...htmlProps}>{children}</div>
  }

  return (
    <motion.div
      className={className}
      whileHover={{
        backgroundColor: 'rgba(0, 0, 0, 0.015)',
        boxShadow: 'inset 3px 0 0 var(--foreground, #000)',
      }}
      whileTap={{
        backgroundColor: 'rgba(0, 0, 0, 0.03)',
      }}
      transition={springs.hover}
      {...rest}
    >
      {children}
    </motion.div>
  )
}


// ── SpringExpand ────────────────────────────────────────────
// Animated height expansion. Content measures itself —
// no fixed heights needed. Spring-based with AnimatePresence
// for proper mount/unmount transitions.
//
// Usage:
//   <SpringExpand isOpen={expanded}>
//     <div>Content that appears</div>
//   </SpringExpand>

interface SpringExpandProps {
  children: ReactNode
  isOpen: boolean
  className?: string
}

export function SpringExpand({ children, isOpen, className }: SpringExpandProps) {
  const reduced = useReducedMotion()

  if (reduced) {
    return isOpen ? <div className={className}>{children}</div> : null
  }

  return (
    <AnimatePresence initial={false}>
      {isOpen && (
        <motion.div
          className={className}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={springs.expand}
          style={{ overflow: 'hidden' }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}


// ── Glass Modal Tokens ──────────────────────────────────────
// Shared class strings for the glass overlay modal system.
// Import these in any modal file for consistent styling.

export const glass = {
  /** Modal backdrop — Apple-style frosted overlay */
  backdrop: 'fixed inset-0 glass-overlay flex items-center justify-center z-50 p-4',
  /** Modal panel — heavy blur + saturation, 78% opacity. Uses dvh so the
   *  panel shrinks with the mobile URL bar, and pads safe-area-inset-bottom
   *  so iOS notch/home-indicator does not eat content. */
  modal: 'glass-panel rounded-2xl shadow-2xl max-h-[85dvh] overflow-y-auto pb-[env(safe-area-inset-bottom)]',
  /** Subtle section surface */
  section: 'glass-surface rounded-xl',
  input: 'w-full bg-white/80 border border-black/10 rounded-lg px-4 py-3 text-text-primary text-lg font-mono tabular-nums placeholder:text-text-muted/60 focus:border-black/25 focus:ring-2 focus:ring-black/20 focus:outline-none transition-colors disabled:opacity-50',
  inputSm: 'w-full bg-white/80 border border-black/10 rounded-lg px-4 py-2 text-text-primary font-mono tabular-nums placeholder:text-text-muted/60 focus:border-black/25 focus:ring-2 focus:ring-black/20 focus:outline-none transition-colors',
  success: 'bg-emerald-50/80 border border-emerald-200/60 rounded-xl',
  error: 'bg-red-50/80 border border-red-200/60 rounded-xl',
  warning: 'bg-amber-50/80 border border-amber-200/60 rounded-xl',
  ctaUp: 'w-full py-4 bg-color-up text-white font-medium rounded-xl hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all fluid-press',
  ctaDown: 'w-full py-4 bg-color-down text-white font-medium rounded-xl hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all fluid-press',
  ctaSecondary: 'w-full py-3 bg-black/[0.04] text-text-primary font-medium rounded-xl border border-black/[0.06] hover:bg-black/[0.07] transition-colors',
  cancel: 'w-full text-center text-sm text-text-muted hover:text-text-primary py-2 transition-colors',
  label: 'text-xs font-medium uppercase tracking-[0.08em] text-text-muted',
  spinner: 'w-5 h-5 border-2 border-black/10 border-t-black/60 rounded-full animate-spin',
} as const


// ── ModalClose ──────────────────────────────────────────────
// Proper close button — round, subtle, accessible.

interface ModalCloseProps {
  onClick: () => void
  className?: string
}

export function ModalClose({ onClick, className }: ModalCloseProps) {
  const t = useTranslations('common')
  return (
    <button
      onClick={onClick}
      className={`w-11 h-11 flex items-center justify-center rounded-full bg-black/5 hover:bg-black/10 text-text-muted hover:text-text-primary transition-colors ${className ?? ''}`}
      aria-label={t('aria.close')}
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  )
}


// ── SpringModal ─────────────────────────────────────────────
// Modal entrance with scale + translateY spring.
// Pairs with SpringBackdrop for the overlay.
//
// Usage:
//   <SpringBackdrop className={glass.backdrop} onClick={onClose}>
//     <SpringModal className={`${glass.modal} max-w-md w-full`}>...</SpringModal>
//   </SpringBackdrop>

type SpringModalProps = Omit<HTMLMotionProps<'div'>, 'initial' | 'animate' | 'exit' | 'transition'> & {
  children: ReactNode
}

export function SpringModal({ children, className, ...rest }: SpringModalProps) {
  const reduced = useReducedMotion()

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      className={className}
      initial={reduced ? false : { opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={reduced ? undefined : { opacity: 0, scale: 0.95, y: 10 }}
      transition={springs.entrance}
      onClick={(e) => e.stopPropagation()}
      {...rest}
    >
      {children}
    </motion.div>
  )
}

type SpringBackdropProps = Omit<HTMLMotionProps<'div'>, 'initial' | 'animate' | 'exit' | 'transition'>

export function SpringBackdrop({ className, ...rest }: SpringBackdropProps) {
  const reduced = useReducedMotion()

  return (
    <motion.div
      className={className}
      initial={reduced ? false : {
        opacity: 0,
        backdropFilter: 'blur(0px) saturate(100%)',
      }}
      animate={{
        opacity: 1,
        backdropFilter: 'blur(24px) saturate(180%)',
        transition: {
          opacity: { duration: 0.22, ease: appleEnter },
          backdropFilter: { duration: 0.34, ease: appleEnter },
        },
      }}
      exit={reduced ? undefined : {
        opacity: 0,
        backdropFilter: 'blur(0px) saturate(100%)',
        transition: { duration: 0.22, ease: appleExit },
      }}
      {...rest}
    />
  )
}


// ── SpringDrawer ────────────────────────────────────────────
// Slide-from-right drawer with spring physics.
//
// Usage:
//   <SpringDrawer from="right"><Content /></SpringDrawer>

type SpringDrawerProps = Omit<HTMLMotionProps<'div'>, 'initial' | 'animate' | 'exit' | 'transition'> & {
  children: ReactNode
  from?: 'right' | 'left' | 'bottom'
}

export function SpringDrawer({ children, className, from = 'right', ...rest }: SpringDrawerProps) {
  const reduced = useReducedMotion()
  const initial = reduced
    ? false
    : from === 'bottom'
      ? { y: '100%' }
      : from === 'left'
        ? { x: '-100%' }
        : { x: '100%' }

  const exit = reduced
    ? undefined
    : from === 'bottom'
      ? { y: '100%' }
      : from === 'left'
        ? { x: '-100%' }
        : { x: '100%' }

  return (
    <motion.div
      className={className}
      initial={initial}
      animate={from === 'bottom' ? { y: 0 } : { x: 0 }}
      exit={exit}
      transition={springs.entrance}
      {...rest}
    >
      {children}
    </motion.div>
  )
}


// ── SpringTabs ──────────────────────────────────────────────
// Animated tab indicator that springs to the active tab.
// Uses layoutId for shared element animation — the underline
// morphs between positions instead of fading.
//
// Usage:
//   <SpringTabs className="flex gap-0">
//     {tabs.map(tab => (
//       <SpringTab key={tab.id} isActive={active === tab.id} onClick={() => set(tab.id)}>
//         {tab.label}
//       </SpringTab>
//     ))}
//   </SpringTabs>

interface SpringTabsProps {
  children: ReactNode
  className?: string
}

export function SpringTabs({ children, className }: SpringTabsProps) {
  return <div className={className}>{children}</div>
}

interface SpringTabProps {
  children: ReactNode
  isActive: boolean
  className?: string
  activeClass?: string
  inactiveClass?: string
  layoutId?: string
  onClick?: () => void
}

export function SpringTab({
  children,
  isActive,
  className,
  activeClass = 'text-text-primary',
  inactiveClass = 'text-text-muted hover:text-text-secondary',
  layoutId = 'tab-indicator',
  onClick,
}: SpringTabProps) {
  const reduced = useReducedMotion()

  return (
    <button
      onClick={onClick}
      className={`relative ${className ?? ''} ${isActive ? activeClass : inactiveClass}`}
    >
      {children}
      {isActive && (
        <motion.div
          className="absolute bottom-0 left-0 right-0 h-0.5 bg-text-primary"
          layoutId={layoutId}
          transition={reduced ? { duration: 0 } : springs.indicator}
        />
      )}
    </button>
  )
}


// ── SpringPage ──────────────────────────────────────────────
// Cross-page transition wrapper. MUST be mounted in a stable
// parent (layout.tsx) — never in template.tsx, which remounts
// per route and prevents the outgoing page from finishing exit.
//
// Behavior:
//   - First mount: no entrance (avoids hydration jolt + CLS)
//   - Subsequent navigations: outgoing page exits, incoming
//     enters — cross-fade with light scale + brief blur,
//     keyed by pathname.

interface SpringPageProps {
  children: ReactNode
  className?: string
}

export function SpringPage({ children, className }: SpringPageProps) {
  const reduced = useReducedMotion()
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  if (reduced) {
    return <div className={className}>{children}</div>
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        className={className}
        initial={mounted ? { opacity: 0, scale: 0.992, y: 6, filter: 'blur(4px)' } : false}
        animate={{
          opacity: 1,
          scale: 1,
          y: 0,
          filter: 'blur(0px)',
          transition: {
            opacity: { duration: 0.28, ease: appleEnter },
            scale:   { duration: 0.34, ease: appleEnter },
            y:       { duration: 0.34, ease: appleEnter },
            filter:  { duration: 0.22, ease: appleEnter },
          },
        }}
        exit={{
          opacity: 0,
          scale: 0.996,
          y: -2,
          filter: 'blur(2px)',
          transition: { duration: 0.18, ease: appleExit },
        }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}


// ── SpringCard ──────────────────────────────────────────────
// Card with spring lift + border darken on hover.
// Interruptible — hovering out mid-lift produces natural fall.
//
// Usage: <SpringCard className="border rounded-lg p-4"><Content /></SpringCard>

type SpringCardProps = Omit<HTMLMotionProps<'div'>, 'whileHover' | 'whileTap' | 'transition'> & {
  children: ReactNode
}

export function SpringCard({ children, className, ...rest }: SpringCardProps) {
  const reduced = useReducedMotion()

  if (reduced) {
    return <div className={className}>{children}</div>
  }

  return (
    <motion.div
      className={className}
      whileHover={{
        y: -2,
        boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
      }}
      whileTap={{ y: 0 }}
      transition={springs.hover}
      {...rest}
    >
      {children}
    </motion.div>
  )
}


// ── SpringNumber ────────────────────────────────────────────
// Animated numerical display with spring interpolation.
// When the value changes, the displayed number glides to the
// new value. Financial data that breathes — not jumps.
//
// Usage:
//   <SpringNumber value={1234.56} format={n => `$${n.toFixed(2)}`} />
//   <SpringNumber value={nav} format={n => `$${n.toFixed(4)}`} className="font-mono" />

interface SpringNumberProps {
  value: number
  format?: (n: number) => string
  className?: string
}

export function SpringNumber({ value, format, className }: SpringNumberProps) {
  const reduced = useReducedMotion()
  const mv = useMotionValue(value)
  const spring = useSpring(mv, springs.number)
  const display = useTransform(spring, (v: number) => format ? format(v) : v.toFixed(2))

  useEffect(() => {
    mv.set(value)
  }, [value, mv])

  if (reduced) {
    return <span className={className}>{format ? format(value) : value.toFixed(2)}</span>
  }

  return <motion.span className={className}>{display}</motion.span>
}
