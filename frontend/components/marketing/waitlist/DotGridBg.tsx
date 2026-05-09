'use client'

import { motion, useReducedMotion } from 'framer-motion'

const ACCENT = '#0052FF'
const FIELD_ALPHA = 'rgba(0,82,255,0.20)'
const STEP = 14

type Band = {
  y: string
  widthVw: number
  duration: number
  delay: number
  rows: 1 | 2 | 3
}

const BANDS: Band[] = [
  { y: '5%',  widthVw: 64, duration: 32, delay: 0, rows: 2 },
  { y: '10%', widthVw: 42, duration: 26, delay: 6, rows: 1 },
  { y: '22%', widthVw: 36, duration: 28, delay: 2, rows: 2 },
  { y: '63%', widthVw: 32, duration: 30, delay: 4, rows: 2 },
  { y: '85%', widthVw: 58, duration: 36, delay: 1, rows: 2 },
  { y: '92%', widthVw: 46, duration: 30, delay: 5, rows: 1 },
]

export function DotGridBg() {
  const reduced = useReducedMotion()
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      style={{ background: '#F0F2F4' }}
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `radial-gradient(circle, ${FIELD_ALPHA} 1px, transparent 1.4px)`,
          backgroundSize: `${STEP}px ${STEP}px`,
        }}
      />

      {BANDS.map((band, i) => (
        <motion.div
          key={i}
          className="absolute"
          initial={{ x: 0 }}
          animate={reduced ? undefined : { x: `calc(100vw + ${band.widthVw}vw)` }}
          transition={{
            duration: band.duration,
            delay: band.delay,
            repeat: Infinity,
            ease: 'linear',
          }}
          style={{
            top: band.y,
            left: `-${band.widthVw}vw`,
            width: `${band.widthVw}vw`,
            height: band.rows * STEP,
            backgroundImage: `radial-gradient(circle, ${ACCENT} 1.4px, transparent 1.8px)`,
            backgroundSize: `${STEP}px ${STEP}px`,
            maskImage:
              'linear-gradient(to right, transparent 0%, #000 18%, #000 82%, transparent 100%)',
            WebkitMaskImage:
              'linear-gradient(to right, transparent 0%, #000 18%, #000 82%, transparent 100%)',
            willChange: 'transform',
          }}
        />
      ))}

      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 30%, rgba(240,242,244,0.55) 100%)',
        }}
      />
    </div>
  )
}
