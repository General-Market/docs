'use client'

import {
  motion,
  useReducedMotion,
  AnimatePresence,
  type Transition,
  type HTMLMotionProps,
} from 'framer-motion'
import { useRef, type ReactNode } from 'react'

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
    return <div className={className}>{children}</div>
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


// ── SpringModal ─────────────────────────────────────────────
// Modal entrance with scale + translateY spring.
// Pairs with SpringBackdrop for the overlay.
//
// Usage:
//   <SpringBackdrop onClick={onClose} />
//   <SpringModal className="modal-box">...</SpringModal>

type SpringModalProps = Omit<HTMLMotionProps<'div'>, 'initial' | 'animate' | 'exit' | 'transition'> & {
  children: ReactNode
}

export function SpringModal({ children, className, ...rest }: SpringModalProps) {
  const reduced = useReducedMotion()

  return (
    <motion.div
      className={className}
      initial={reduced ? false : { opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={reduced ? undefined : { opacity: 0, scale: 0.95, y: 10 }}
      transition={springs.entrance}
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
      initial={reduced ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={reduced ? undefined : { opacity: 0 }}
      transition={{ duration: 0.25 }}
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
// Page entrance wrapper. First load: instant (no CLS).
// Subsequent navigations: real spring entrance.
// Used by template.tsx.

let hasInitialized = false

interface SpringPageProps {
  children: ReactNode
  className?: string
}

export function SpringPage({ children, className }: SpringPageProps) {
  const reduced = useReducedMotion()
  const isFirstMount = useRef(!hasInitialized)

  if (isFirstMount.current) {
    hasInitialized = true
    isFirstMount.current = false
    return <div className={className}>{children}</div>
  }

  if (reduced) {
    return <div className={className}>{children}</div>
  }

  return (
    <motion.div
      initial={{ opacity: 0.5, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springs.page}
      className={className}
    >
      {children}
    </motion.div>
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
