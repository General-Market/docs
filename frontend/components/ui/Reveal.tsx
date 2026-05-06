'use client'

import { motion, useReducedMotion, type HTMLMotionProps } from 'framer-motion'
import type { ReactNode } from 'react'

const appleEnter = [0.32, 0.72, 0, 1] as const

type RevealProps = Omit<
  HTMLMotionProps<'div'>,
  'initial' | 'animate' | 'whileInView' | 'viewport' | 'transition' | 'variants'
> & {
  children: ReactNode
  /** Stagger delay in seconds. Default 0. */
  delay?: number
  /** Rise distance on enter, in pixels. Default 14. */
  y?: number
  /** IntersectionObserver root margin — fires slightly before fully visible. */
  margin?: string
  /** Mask-wipe reveal — text wipes in left-to-right. Use on headings. */
  mask?: boolean
}

/**
 * Viewport-once entrance — Apple-style fade + rise with brief blur.
 * Renders nothing extra in reduced-motion mode.
 *
 * Usage:
 *   <Reveal>                     opacity + 14px rise + 4px blur
 *   <Reveal delay={0.1}>         staggered
 *   <Reveal mask>Heading</Reveal>  left-to-right text wipe
 */
export function Reveal({
  children,
  delay = 0,
  y = 14,
  margin = '-8%',
  mask = false,
  className,
  style,
  ...rest
}: RevealProps) {
  const reduced = useReducedMotion()

  if (reduced) {
    return (
      <div className={className} style={style as React.CSSProperties}>
        {children}
      </div>
    )
  }

  if (mask) {
    return (
      <motion.div
        className={className}
        style={style}
        initial={{
          opacity: 0,
          maskImage:
            'linear-gradient(90deg, #000 0%, #000 0%, transparent 8%, transparent 100%)',
        }}
        whileInView={{
          opacity: 1,
          maskImage:
            'linear-gradient(90deg, #000 0%, #000 100%, transparent 108%, transparent 200%)',
        }}
        viewport={{ once: true, margin }}
        transition={{
          opacity: { duration: 0.4, ease: appleEnter, delay },
          maskImage: { duration: 0.7, ease: appleEnter, delay },
        }}
        {...rest}
      >
        {children}
      </motion.div>
    )
  }

  return (
    <motion.div
      className={className}
      style={style}
      initial={{ opacity: 0, y, filter: 'blur(4px)' }}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={{ once: true, margin }}
      transition={{
        opacity: { duration: 0.5, ease: appleEnter, delay },
        y: { duration: 0.55, ease: appleEnter, delay },
        filter: { duration: 0.4, ease: appleEnter, delay },
      }}
      {...rest}
    >
      {children}
    </motion.div>
  )
}
