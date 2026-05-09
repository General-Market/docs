'use client'

import { motion, useReducedMotion } from 'framer-motion'
import type { CSSProperties } from 'react'

type Direction = 'right-up' | 'right-down' | 'left-up' | 'left-down'

type Props = {
  text: string
  direction?: Direction
  delay?: number
  className?: string
  style?: CSSProperties
  width?: number
  height?: number
  fontSize?: number
  color?: string
}

type Geom = {
  path: string
  head: string
  textX: number
  textY: number
  textAnchor: 'start' | 'end' | 'middle'
}

const GEOMETRY: Record<Direction, Geom> = {
  'right-up': {
    path: 'M 6 78 C 32 64, 76 52, 132 14',
    head: 'M 132 14 L 120 14 M 132 14 L 128 25',
    textX: 6,
    textY: 96,
    textAnchor: 'start',
  },
  'right-down': {
    path: 'M 6 14 C 32 28, 76 48, 132 78',
    head: 'M 132 78 L 120 78 M 132 78 L 128 67',
    textX: 6,
    textY: 12,
    textAnchor: 'start',
  },
  'left-up': {
    path: 'M 134 78 C 108 64, 64 52, 8 14',
    head: 'M 8 14 L 20 14 M 8 14 L 12 25',
    textX: 134,
    textY: 96,
    textAnchor: 'end',
  },
  'left-down': {
    path: 'M 134 14 C 108 28, 64 48, 8 78',
    head: 'M 8 78 L 20 78 M 8 78 L 12 67',
    textX: 134,
    textY: 12,
    textAnchor: 'end',
  },
}

export function CaveatArrow({
  text,
  direction = 'right-up',
  delay = 0,
  className,
  style,
  width = 160,
  height = 110,
  fontSize = 24,
  color = '#0052FF',
}: Props) {
  const reduced = useReducedMotion()
  const g = GEOMETRY[direction]

  return (
    <div className={className} style={style} aria-hidden>
      <svg
        viewBox="0 0 140 100"
        width={width}
        height={height}
        fill="none"
        overflow="visible"
      >
        <motion.path
          d={g.path}
          stroke={color}
          strokeWidth={2.4}
          strokeLinecap="round"
          initial={reduced ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.7, ease: [0.4, 0, 0.6, 1], delay }}
        />
        <motion.path
          d={g.head}
          stroke={color}
          strokeWidth={2.4}
          strokeLinecap="round"
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.18, delay: delay + 0.7 }}
        />
        <motion.text
          x={g.textX}
          y={g.textY}
          textAnchor={g.textAnchor}
          fill={color}
          style={{
            fontFamily: 'var(--font-caveat), cursive',
            fontWeight: 700,
            fontSize,
          }}
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.25, delay: delay + 0.95 }}
        >
          {text}
        </motion.text>
      </svg>
    </div>
  )
}
