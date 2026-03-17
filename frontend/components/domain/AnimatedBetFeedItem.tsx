'use client'

import { motion } from 'framer-motion'
import { BetFeedItem } from './BetFeedItem'
import type { RecentBetEvent } from '@/hooks/useRecentBets'

interface AnimatedBetFeedItemProps {
  /** The bet event to display */
  event: RecentBetEvent
  /** True for items added via SSE, false for initial load */
  isNew: boolean
  /** User prefers reduced motion */
  prefersReducedMotion: boolean
  /** Mobile viewport (< 768px) */
  isMobile: boolean
}

/**
 * Standard animation variants for regular portfolios
 * AC2: Fade in from top (opacity 0→1), slide down (y: -20→0)
 */
const standardVariants = {
  initial: { opacity: 0, y: -20 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: 'easeOut' as const }
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.2 }
  }
}

/**
 * Enhanced animation variants for mega portfolios (>= 20K markets)
 * AC3: Stronger pulse animation with slight scale effect
 */
const megaVariants = {
  initial: { opacity: 0, y: -20, scale: 0.98 },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.35, ease: 'easeOut' as const }
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.2 }
  }
}

/**
 * AnimatedBetFeedItem component
 *
 * Wraps BetFeedItem in Framer Motion for smooth animations.
 * AC2: New bet item fades in from top with slide down animation
 * AC3: Mega portfolios (>= 20K) show enhanced pulse animation
 * AC4: Uses framer-motion for all animations
 * AC7: Animations disabled on mobile or when prefers-reduced-motion
 *
 * @param event - The bet event to display
 * @param isNew - Whether this item was just added via SSE
 * @param prefersReducedMotion - User accessibility preference
 * @param isMobile - Whether viewport is mobile width
 */
export function AnimatedBetFeedItem({
  event,
  isNew,
  prefersReducedMotion,
  isMobile
}: AnimatedBetFeedItemProps) {
  const isMegaPortfolio = event.portfolioSize >= 20000
  const shouldAnimate = isNew && !prefersReducedMotion && !isMobile

  // AC7: Disable animations when not appropriate
  if (!shouldAnimate) {
    return <BetFeedItem event={event} />
  }

  // Determine which CSS pulse class to use
  // AC2: Background pulses red briefly (0.5s)
  // AC3: Stronger pulse for mega portfolios
  const pulseClass = isMegaPortfolio ? 'animate-pulse-red-strong-bet' : 'animate-pulse-red-bet'

  return (
    <motion.div
      initial="initial"
      animate="animate"
      exit="exit"
      variants={isMegaPortfolio ? megaVariants : standardVariants}
      layout
      className={pulseClass}
    >
      <BetFeedItem event={event} />
    </motion.div>
  )
}
